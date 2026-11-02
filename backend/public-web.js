import ipaddr from 'ipaddr.js';
import { parseHTML } from 'linkedom';

export class ResearchError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function publicAddress(address) {
  try { return ipaddr.process(address).range() === 'unicast'; } catch { return false; }
}
export function publicUrl(input) {
  let url;
  try { url = new URL(input); } catch { throw new ResearchError('请输入完整的公开网页地址。'); }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port ||
      !host.includes('.') || /(^|\.)(localhost|local|internal|test|invalid|example|onion)$/.test(host) ||
      ipaddr.isValid(host.replace(/^\[|\]$/g, '')) || url.href.length > 2000) {
    throw new ResearchError('只能采集使用标准端口的公开网站，不支持本机或内网地址。');
  }
  url.hash = ''; return url;
}
export async function limitedBytes(response, limit = 2_000_000) {
  if (Number(response.headers.get('content-length')) > limit) { await response.body?.cancel(); throw new ResearchError('页面超过采集大小限制。'); }
  const reader = response.body?.getReader(); if (!reader) return new Uint8Array();
  const chunks = []; let length = 0;
  try {
    for (;;) { const {done,value} = await reader.read(); if (done) break; length += value.length;
      if (length > limit) throw new ResearchError('页面超过采集大小限制。'); chunks.push(value); }
  } finally { await reader.cancel().catch(()=>{}); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
export async function publicFetch(input, transport, options = {}) {
  let url = publicUrl(input);
  for (let hop = 0; hop < 5; hop++) {
    const response = await transport(url, options);
    if ([301,302,303,307,308].includes(response.status)) {
      const location = response.headers.get('location'); await response.body?.cancel();
      if (!location) throw new ResearchError('网页重定向没有目标地址。');
      url = publicUrl(new URL(location, url).href); continue;
    }
    return { response, url: url.href };
  }
  throw new ResearchError('网页重定向次数过多。');
}
export function extractPage(html, url) {
  const {document} = parseHTML(html);
  const title = (document.querySelector('title')?.textContent || new URL(url).hostname).trim().slice(0,200);
  const links = [...document.querySelectorAll('a[href]')].map(a=>{
    try { const target=publicUrl(new URL(a.getAttribute('href'),url).href); return {url:target.href,label:a.textContent.trim()}; } catch { return null; }
  }).filter(a=>a && new URL(a.url).origin===new URL(url).origin && a.url!==url && !new URL(a.url).search);
  document.querySelectorAll('script,style,noscript,svg,iframe,template,form,[hidden],[aria-hidden="true"]').forEach(el=>el.remove());
  document.querySelectorAll('p,h1,h2,h3,h4,li,section,div,br').forEach(el=>el.append('\n'));
  const excerpt=(document.body?.textContent || document.documentElement?.textContent || '').replace(/[\t \r]+/g,' ').replace(/\n\s*\n+/g,'\n').trim().slice(0,16000);
  return {title,excerpt,links:[...new Map(links.map(a=>[a.url,a])).values()]};
}
export async function collectPages(input, {transport, screenshot, signal, pageUrls}) {
  const target=publicUrl(input).href, startedAt=new Date().toISOString(), sources=[], failures=[];
  if(pageUrls!==undefined&&(!Array.isArray(pageUrls)||pageUrls.length>3||!pageUrls.length))throw new ResearchError('请选择 1–3 个公开页面。');
  const queue=pageUrls?[...new Set(pageUrls.map(url=>publicUrl(url).href))]:[target]; const seen=new Set();
  for (let index=0; index<queue.length && sources.length+failures.length<3; index++) {
    const requested=queue[index];
    try {
      signal?.throwIfAborted();
      const {response,url}=await publicFetch(requested,transport,{signal});
      if(!response.ok) {await response.body?.cancel();throw new ResearchError(`网页返回 HTTP ${response.status}，未采集到正文。`);}
      if(!/text\/html|application\/xhtml\+xml/i.test(response.headers.get('content-type')||'')){await response.body?.cancel();throw new ResearchError('目前只采集 HTML 页面。');}
      const page=extractPage(new TextDecoder().decode(await limitedBytes(response)),url);
      if(seen.has(url))continue; seen.add(url);
      if(page.excerpt.length<80&&!screenshot)throw new ResearchError('公开 HTML 中正文不足，可能需要浏览器渲染或登录；请补充截图和实际观察。');
      const source={id:`C${sources.length+1}`,title:page.title,url,excerpt:page.excerpt,locator:'公开页面 HTML 正文（最多 16,000 字符）',capturedAt:new Date().toISOString(),method:'自动采集 · 公开 HTML',verified:false,limitation:'仅覆盖公开页面；未登录、未操作产品、未验证用户行为或经营数据。HTML 文本可能含未显示的内容，需人工核对。'};
      if(page.excerpt.length<80)source.limitation+=' HTML 正文不足，依赖渲染截图，不能据此认定页面内容缺失。';
      sources.push(source);
      if(index===0&&!pageUrls){
        const ranked=page.links.map(a=>({...a,score:/pricing|价格|定价/i.test(a.url+' '+a.label)?3:/about|product|features|docs|产品|关于|文档/i.test(a.url+' '+a.label)?2:0})).filter(a=>a.score>0 && !/login|signin|signout|logout|checkout|delete|signup|register/i.test(a.url)).sort((a,b)=>b.score-a.score);
        queue.push(...ranked.slice(0,2).map(a=>a.url));
      }
    }catch(error){ if(signal?.aborted) throw error; failures.push({url:requested,stage:'text',message:error instanceof ResearchError?error.message:'网页访问失败或超时。可以重试，或手动补充来源。'}); }
  }
  await Promise.all(sources.slice(0,3).map(async source=>{
    if(!screenshot){source.limitation+=' 本条未自动截图，不能据此判断视觉布局。';return;}
    try{source.image=await screenshot(source.url,signal);source.method+=' + 桌面页面截图';source.locator+='；1440 × 1000 桌面视口';source.limitation+=' 截图仅为当前视口静态状态，不能证明交互行为；动态资源可能未完整加载。';}
    catch{source.limitation+=' 页面截图未完成，可手动补充。';failures.push({url:source.url,stage:'screenshot',message:'页面截图未完成，正文已保留。'});}
  }));
  signal?.throwIfAborted();
  return {startedAt,completedAt:new Date().toISOString(),sources,failures,coverage:'仅公开页面，最多三页；不包含登录后流程、真实转化率或营收数据。'};
}
