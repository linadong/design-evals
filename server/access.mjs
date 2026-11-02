import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {handleApi} from '../backend/api.js';

const cookieName='design-evals-beta';
const digest=value=>createHash('sha256').update(value).digest('hex');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const json=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const attempts=new Map(),active=new Map(),waitlistAttempts=new Map();
function configuration(env){
 try{const codes=JSON.parse(env.DESIGN_EVALS_BETA_CODES||'[]');if(!env.DESIGN_EVALS_SESSION_SECRET||env.DESIGN_EVALS_SESSION_SECRET.length<32||!Array.isArray(codes)||!codes.length||codes.some(c=>!/^\w{1,40}$/.test(c.id)||!/^[a-f0-9]{64}$/.test(c.hash)))return null;return{codes,secret:env.DESIGN_EVALS_SESSION_SECRET};}catch{return null;}
}
function session(request,config,now){
 try{const raw=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1);if(!raw)return null;const[payload,signature,extra]=raw.split('.');if(extra||!equal(signature,createHmac('sha256',config.secret).update(payload).digest('base64url')))return null;const data=JSON.parse(Buffer.from(payload,'base64url').toString());const code=config.codes.find(c=>c.id===data.id);return code&&data.hash===code.hash&&Number.isSafeInteger(data.exp)&&data.exp>now?code.id:null;}catch{return null;}
}
export async function handleBeta(request,env,dependencies={},now=Date.now()){
 const url=new URL(request.url),path=url.pathname.replace(/^\/api\/design-evals/,'');
 const config=configuration(env);if(!config)return json({error:'内测服务尚未配置，请联系 Lina。'},503);
 const secure=url.protocol==='https:'?'; Secure':'';
 const cookie=value=>`${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/api/design-evals; Max-Age=28800${secure}`;
 if(request.method!=='GET'&&request.headers.get('origin')!==url.origin)return json({error:'请从本站内测页面发起请求。'},403);
 const who=session(request,config,now);
 if(path==='/session'&&request.method==='GET')return json({authenticated:!!who});
 if(path==='/waitlist'&&request.method==='POST'){
  let body;try{const text=await request.text();if(text.length>2000)throw Error();body=JSON.parse(text);}catch{return json({error:'请输入有效的邮箱地址。'},400);}
  if(typeof body.website==='string'&&body.website.trim())return json({saved:true},202);
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
  if(email.length>254||!email||!/^[-a-z0-9.!#$%&'*+\/=?^_`{|}~]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(email))return json({error:'请输入有效的邮箱地址。'},400);
  const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';const prior=waitlistAttempts.get(ip);const rate=prior&&prior.until>now?prior:{count:0,until:now+60000};if(rate.count>=10)return json({error:'提交过于频繁，请一分钟后重试。'},429);
  if(waitlistAttempts.size>1000)waitlistAttempts.delete(waitlistAttempts.keys().next().value);waitlistAttempts.set(ip,rate);rate.count++;
  if(!dependencies.saveWaitlist)return json({error:'申请暂未保存，请稍后再试。'},503);
  const record={id:createHmac('sha256',config.secret).update('waitlist:'+email).digest('hex'),email,submittedAt:new Date(now).toISOString()};
  try{await dependencies.saveWaitlist(record,env,request);return json({saved:true},201);}catch{return json({error:'申请暂未保存，请稍后重试。'},503);}
 }
 if(path==='/unlock'&&request.method==='POST'){
  const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
  const old=attempts.get(ip);const rate=old&&old.until>now?old:{count:0,until:now+60000};
  if(rate.count>=10)return json({error:'尝试过于频繁，请一分钟后再试。'},429);
  if(attempts.size>1000)attempts.delete(attempts.keys().next().value);attempts.set(ip,rate);rate.count++;
  let body;try{const text=await request.text();if(text.length>2000)throw Error();body=JSON.parse(text);}catch{return json({error:'口令格式无效。'},400);}
  if(typeof body.code!=='string'||body.code.length>200)return json({error:'口令格式无效。'},400);
  const hashed=digest(body.code.trim());const code=config.codes.find(c=>equal(c.hash,hashed));
  if(!code)return json({error:'测试口令不正确或已停用，请检查后重试。'},401);
  attempts.delete(ip);
  const payload=Buffer.from(JSON.stringify({id:code.id,hash:code.hash,exp:now+28800000})).toString('base64url');
  const signed=payload+'.'+createHmac('sha256',config.secret).update(payload).digest('base64url');
  return json({authenticated:true},200,{'Set-Cookie':cookie(signed)});
 }
 if(path==='/logout'&&request.method==='POST')return json({authenticated:false},200,{'Set-Cookie':cookie('').replace('Max-Age=28800','Max-Age=0')});
 if(!who)return json({error:'请先输入测试口令；浏览器中的项目仍保留。'},401);
 if(!['/status','/collect','/analyze'].includes(path))return json({error:'接口不存在。'},404);
 if(path!=='/status'&&active.has(who)&&now-active.get(who)<125000)return json({error:'此口令已有一个任务正在进行，请稍后重试。'},429);
 if(path!=='/status')active.set(who,now);
 try{url.pathname='/api'+path;return await handleApi(new Request(url,request),env,dependencies);}
 finally{if(path!=='/status')active.delete(who);}
}
