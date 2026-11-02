import http from 'node:http';
import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { Readable } from 'node:stream';
import { publicUrl, publicAddress, publicFetch, limitedBytes, ResearchError } from './public-web.js';

export async function nodeTransport(url, {signal}={}) {
  publicUrl(url.href);
  const addresses=await lookup(url.hostname,{all:true});
  if(!addresses.length || addresses.some(a=>!publicAddress(a.address)))throw new ResearchError('该地址未解析到可访问的公网服务。');
  const selected=addresses.find(a=>a.family===4)||addresses[0];
  return new Promise((resolve,reject)=>{
    const req=(url.protocol==='https:'?https:http).request(url,{
      method:'GET',signal,timeout:12000,
      headers:{'User-Agent':'AuditPitch/0.4 (public-page research)','Accept':'text/html,image/*,text/css,*/*;q=0.5','Accept-Encoding':'identity'},
      lookup:(_host,options,callback)=>callback(null,options.all?[selected]:selected.address,selected.family),
    },res=>{
      const headers=new Headers();for(const [key,value]of Object.entries(res.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(', '):value);
      const status=res.statusCode;
      resolve(new Response([204,205,304].includes(status)?null:Readable.toWeb(res),{status,headers}));
    });
    req.on('timeout',()=>req.destroy(new Error('timeout')));req.on('error',reject);req.end();
  });
}

export async function captureScreenshot(url,signal) {
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const abort=()=>browser.close().catch(()=>{});signal?.addEventListener('abort',abort,{once:true});
  try {
    const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,serviceWorkers:'block',acceptDownloads:false});
    let requests=0;
    await context.routeWebSocket('**/*',socket=>socket.close());
    await context.route('**/*',async route=>{
      try {
        const request=route.request(); if(++requests>120 || request.method()!=='GET' || ['media','eventsource'].includes(request.resourceType()))return await route.abort();
        const {response}=await publicFetch(request.url(),nodeTransport,{signal});
        const headers=Object.fromEntries(response.headers);for(const name of ['set-cookie','content-length','content-encoding','transfer-encoding'])delete headers[name];
        const body=Buffer.from(await limitedBytes(response,5_000_000));
        await route.fulfill({status:response.status,headers,body});
      }catch{await route.abort().catch(()=>{});}
    });
    const page=await context.newPage();await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
    await page.waitForLoadState('networkidle',{timeout:5000}).catch(()=>{});
    if((await page.locator('body').innerText()).trim().length<80)throw new Error('No rendered content');
    const bytes=await page.screenshot({type:'jpeg',quality:68,timeout:5000});
    if(bytes.length>1_000_000)throw new Error('Screenshot too large');
    return `data:image/jpeg;base64,${bytes.toString('base64')}`;
  }finally {signal?.removeEventListener('abort',abort);await browser.close();}
}
