import {saveWaitlist} from './waitlist.mjs';
import {handleBeta} from './access.mjs';
import {nodeTransport} from '../backend/node-web.mjs';
import {remoteScreenshot} from '../backend/screenshots.js';
export default async function handler(req,res){
 try{
  const host=String(req.headers.host||'');if(!/^[a-z0-9.:-]+$/i.test(host))throw Error('Invalid host');
  const protocol=req.headers['x-forwarded-proto']==='https'?'https':'http';
  const origin=protocol+'://'+host;
  let body;
  if(!['GET','HEAD'].includes(req.method)){
   if(req.body!==undefined)body=Buffer.isBuffer(req.body)?req.body:Buffer.from(typeof req.body==='string'?req.body:JSON.stringify(req.body));
   else{const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>4400000){res.writeHead(413,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'材料过大，请缩小截图后重试。'}));return;}chunks.push(chunk);}body=Buffer.concat(chunks);}
   if(body.length>4400000){res.writeHead(413,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'材料过大，请缩小截图后重试。'}));return;}
  }
  const abort=new AbortController();res.on('close',()=>{if(!res.writableEnded)abort.abort();});
  const target=new URL(origin+req.url);if(target.pathname==='/api/design-evals'&&target.searchParams.has('route')){target.pathname+='/'+target.searchParams.get('route');target.search='';}
  const request=new Request(target,{method:req.method,headers:req.headers,signal:abort.signal,...(body?{body,duplex:'half'}:{})});
  const result=await handleBeta(request,process.env,{transport:nodeTransport,screenshot:remoteScreenshot(process.env),saveWaitlist});
  res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
 }catch{res.writeHead(502,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:'服务暂未完成请求，请稍后重试；已有项目不受影响。'}));}
}
