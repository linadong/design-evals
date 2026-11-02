import {publicUrl,limitedBytes,ResearchError} from './public-web.js';

// Credentials only go to the fixed provider endpoint, never to a researched website.
export function remoteScreenshot(env,{fetcher=fetch}={}) {
  if(!env.BROWSERLESS_TOKEN?.trim())return undefined;
  return async (target,signal)=>{
    const url=publicUrl(target).href;
    const endpoint=new URL('https://production-sfo.browserless.io/screenshot');
    endpoint.searchParams.set('token',env.BROWSERLESS_TOKEN.trim());
    const response=await fetcher(endpoint.href,{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.any([AbortSignal.timeout(35000),...(signal?[signal]:[])]),body:JSON.stringify({url,viewport:{width:1440,height:1000,deviceScaleFactor:1},gotoOptions:{waitUntil:'networkidle2',timeout:25000},options:{type:'jpeg',quality:68,fullPage:false},rejectResourceTypes:['media']})});
    if(!response.ok){await response.body?.cancel();throw new ResearchError('自动截图服务未完成，请重试或上传截图。',502);}
    if(!response.headers.get('content-type')?.startsWith('image/jpeg')){await response.body?.cancel();throw new ResearchError('截图服务未返回有效图片。',502);}
    const bytes=await limitedBytes(response,1_000_000);
    if(bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw new ResearchError('截图文件格式无效。',502);
    let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return `data:image/jpeg;base64,${btoa(binary)}`;
  };
}
