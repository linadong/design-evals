import { collectPages, limitedBytes, ResearchError } from './public-web.js';
import { analyze, modelConfig } from './analyze.js';

const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function handleApi(request,env,dependencies) {
  const url=new URL(request.url);
  if(url.pathname==='/api/status'&&request.method==='GET'){
    const config=modelConfig(env);
    return json({collection:true,screenshots:!!dependencies.screenshot,aiConfigured:!!config.apiKey&&!!config.model,provider:config.provider,model:config.model});
  }
  if(!['/api/collect','/api/analyze'].includes(url.pathname))return json({error:'接口不存在。'},404);
  if(request.method!=='POST')return json({error:'请求方式不支持。'},405);
  // Same-origin JSON writes only; no cross-origin CORS access. Sites dispatch enforces owner-private access.
  if(request.headers.get('origin')!==url.origin||!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'请从当前工作台发起请求。'},403);
  try {
    const bytes=await limitedBytes(new Response(request.body,{headers:request.headers}),url.pathname==='/api/collect'?5000:6_000_000);
    let body;try {body=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new ResearchError('请求内容无效。');}
    const signal=AbortSignal.any([request.signal,AbortSignal.timeout(url.pathname==='/api/collect'?65000:95000)]);
    const result=url.pathname==='/api/collect'?await collectPages(body.url,{...dependencies,signal,pageUrls:body.pageUrls}):await analyze(body,env,{signal,fetcher:dependencies.aiFetch});
    return json(result);
  }catch(error){return json({error:error instanceof ResearchError?error.message:'本次请求未完成，已保存的研究不受影响。'},error instanceof ResearchError?error.status:502);}
}
