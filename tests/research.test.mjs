import test from 'node:test';
import assert from 'node:assert/strict';
import { publicAddress, publicUrl, publicFetch, extractPage, collectPages, limitedBytes } from '../backend/public-web.js';
import { analyze, analysisInput } from '../backend/analyze.js';
import {remoteScreenshot} from '../backend/screenshots.js';
import { researchPanel } from '../public/research-ui.js';
import { handleApi } from '../backend/api.js';
import { insightFields, analysisBasis, adoptAnalysis, validateAnalysis, recordAnalysis, analysisHistoryFull, designFields, uniqueAnalysisSources, mergeCollectedSources, readResearchResponse, fillCompanyDraft } from '../public/research.js';
import { createProject, makeDraft, validateWorkspace, touch } from '../public/model.js';

const source={id:'E1',url:'https://example.com/',title:'Example product',excerpt:'A public page about a product and its onboarding.',limitation:'No signed-in testing',locator:'hero',capturedAt:'2026-10-29',method:'test fixture',verified:false};
const copy=Object.fromEntries(insightFields.map(k=>[k,`Fixture ${k}`]));
export const resultFixture=()=>({summary:'Test fixture, not a live AI result',company:{audience:'Designers',value:'Task support',goal:'Unknown, validate activation',journey:'Try a task',notes:'No analytics'},opportunities:[{...copy,discipline:'product',sourceIds:['E1'],english:{...copy}}]});
const input=()=>({url:source.url,focus:'First use',sources:[structuredClone(source)]});
const pending=p=>({result:resultFixture(),model:'fixture-model',createdAt:'2026-10-29',adopted:false,basis:analysisBasis(p)});

test('collector rejects private, encoded IP, credentials, non-web and nonstandard-port URLs',()=>{
  for(const url of ['file:///etc/passwd','http://127.0.0.1/','http://2130706433/','http://0x7f000001/','http://[::1]/','https://example.com:8443/','https://user:pass@example.com/','http://service.local/'])assert.throws(()=>publicUrl(url));
  for(const address of ['127.0.0.1','10.0.0.1','169.254.169.254','192.168.0.2','100.64.0.1','::1','::ffff:127.0.0.1','fc00::1','224.0.0.1'])assert.equal(publicAddress(address),false,address);
  assert.equal(publicAddress('8.8.8.8'),true);assert.equal(publicUrl('https://example.com/#hero').href,'https://example.com/');
});
test('redirect targets are revalidated before a network call and loops are bounded',async()=>{
  let calls=0;await assert.rejects(publicFetch(source.url,async()=>{calls++;return new Response(null,{status:302,headers:{location:'http://127.0.0.1/private'}});}));assert.equal(calls,1);
  calls=0;await assert.rejects(publicFetch(source.url,async()=>{calls++;return new Response(null,{status:302,headers:{location:'/loop'}});}));assert.equal(calls,5);
});
test('HTML extraction strips active content and collection preserves partial success',async()=>{
  const html='<html><head><title>Product &amp; Co</title></head><body><script>secret()</script><h1>Public product</h1><p>'+('Useful evidence. '.repeat(10))+'</p><a href="/pricing">Pricing</a><a href="https://elsewhere.com/docs">External docs</a><a href="/about">About</a></body></html>';
  const page=extractPage(html,source.url);assert.equal(page.title,'Product & Co');assert.ok(!page.excerpt.includes('secret'));assert.equal(page.links.length,2);
  const results=await collectPages(source.url,{transport:async url=>url.pathname==='/'?new Response(html,{headers:{'content-type':'text/html'}}):new Response('',{status:403})});
  assert.equal(results.sources.length,1);assert.equal(results.failures.length,2);assert.equal(results.sources[0].verified,false);assert.match(results.sources[0].limitation,/未自动截图/);
});
test('response byte limit is enforced while streaming, not only by content-length',async()=>{await assert.rejects(limitedBytes(new Response('x'.repeat(50)),20));});
test('analyzer fails clearly without credentials and never invokes a model',async()=>{
  await assert.rejects(analyze(input(),{}, {fetcher:()=>assert.fail('No service call without config')}),/尚未配置/);
});
test('provider request includes evidence, schema and privacy settings; rejects invented references',async()=>{
  let captured;const fetcher=async(_url,options)=>{captured=JSON.parse(options.body);return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(resultFixture())}]}]});};
  const response=await analyze({...input(),sources:[{...source,image:'data:image/png;base64,iVBORw0KGgo='}],notes:'PRIVATE_NOTES',drafts:'PRIVATE_DRAFT'}, {OPENAI_API_KEY:'fixture-key',OPENAI_MODEL:'fixture-model'}, {fetcher});
  assert.equal(response.result.opportunities.length,1);assert.equal(captured.store,false);assert.equal(captured.text.format.strict,true);assert.equal(captured.tools,undefined);assert.ok(!JSON.stringify(captured).includes('PRIVATE_'));
  const bad=resultFixture();bad.opportunities[0].sourceIds=['invented'];assert.throws(()=>validateAnalysis(bad,[source]));
  bad.opportunities[0].sourceIds=['E1'];bad.opportunities[0].discipline='visual';assert.throws(()=>validateAnalysis(bad,[source]));
});
test('provider incomplete, refused, invalid and rate-limited responses never become suggestions',async()=>{
  const env={OPENAI_API_KEY:'fixture-key',OPENAI_MODEL:'fixture-model'};
  for(const data of [{status:'incomplete',output:[]},{status:'completed',output:[{content:[{type:'refusal',refusal:'No'}]}]},{status:'completed',output:[{content:[{type:'output_text',text:'{}'}]}]}])await assert.rejects(analyze(input(),env,{fetcher:async()=>Response.json(data)}));
  await assert.rejects(analyze(input(),env,{fetcher:async()=>new Response('',{status:429})}),/额度/);
});
test('DeepSeek keeps screenshots and schema, uses only its own credentials, and ignores reasoning output',async()=>{
  const body=input();body.sources[0].image='data:image/png;base64,iVBORw0KGgo=';
  const fixture=resultFixture();fixture.opportunities[0].discipline='visual';
  const response=await analyze({...body,notes:'PRIVATE_NOTES'}, {AI_PROVIDER:'deepseek',DEEPSEEK_API_KEY:'deepseek-fixture',OPENAI_API_KEY:'other-provider-fixture',OPENAI_MODEL:'other-model'}, {fetcher:async(url,options)=>{
    assert.equal(url,'https://api.deepseek.com/responses');assert.equal(options.headers.Authorization,'Bearer deepseek-fixture');
    const sent=JSON.parse(options.body);assert.equal(sent.model,'deepseek-flash');assert.equal(sent.text.format.type,'json_schema');assert.equal(sent.store,false);
    assert.ok(sent.input[0].content.some(part=>part.type==='input_image'&&part.image_url===body.sources[0].image));
    assert.ok(!options.body.includes('PRIVATE_NOTES'));assert.ok(!options.body.includes('other-provider-fixture'));
    return Response.json({status:'completed',output:[{type:'reasoning',content:[{type:'reasoning_text',text:'Fixture reasoning, not JSON'}]},{type:'message',content:[{type:'output_text',text:JSON.stringify(fixture)}]}]});
  }});
  assert.equal(response.model,'deepseek-flash');assert.equal(response.result.opportunities[0].discipline,'visual');
});
test('DeepSeek fails safely for missing credentials, unsupported image models, invalid results and balance errors',async()=>{
  const env={AI_PROVIDER:'deepseek',DEEPSEEK_API_KEY:'deepseek-fixture'};
  const noCall={fetcher:()=>assert.fail('Invalid configuration must not call a provider')};
  await assert.rejects(analyze(input(),{AI_PROVIDER:'deepseek',OPENAI_API_KEY:'other-provider-fixture',OPENAI_MODEL:'other-model'},noCall),/尚未配置/);
  await assert.rejects(analyze(input(),{...env,AI_PROVIDER:'typo'},noCall),/配置无效/);
  const withImage=input();withImage.sources[0].image='data:image/png;base64,iVBORw0KGgo=';
  await assert.rejects(analyze(withImage,{...env,DEEPSEEK_MODEL:'deepseek-v4-pro'},noCall),/支持图像/);
  for(const data of [{status:'incomplete',output:[]},{status:'completed',output:[{content:[{type:'output_text',text:'{}'}]}]}])await assert.rejects(analyze(input(),env,{fetcher:async()=>Response.json(data)}),/完整且有效/);
  const invented=resultFixture();invented.opportunities[0].sourceIds=['invented'];
  await assert.rejects(analyze(input(),env,{fetcher:async()=>Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(invented)}]}]})}),/完整且有效/);
  for(const [status,message]of [[401,/授权无效/],[402,/余额不足/],[429,/请求频率/]])await assert.rejects(analyze(input(),env,{fetcher:async()=>new Response('',{status})}),message);
});
test('status reflects the selected provider without returning credentials',async()=>{
  const request=()=>new Request('https://app.example.com/api/status');
  for(const provider of ['openai','deepseek']){
    const env={AI_PROVIDER:provider,OPENAI_API_KEY:'openai-fixture',OPENAI_MODEL:'openai-model',DEEPSEEK_API_KEY:'deepseek-fixture'};
    const data=await(await handleApi(request(),env,{})).json();assert.equal(data.aiConfigured,true);assert.equal(data.provider,provider);assert.equal(data.model,provider==='deepseek'?'deepseek-flash':'openai-model');assert.ok(!JSON.stringify(data).includes('fixture'));
  }
  const data=await(await handleApi(request(),{AI_PROVIDER:'deepseek',OPENAI_API_KEY:'other-provider-fixture'},{})).json();assert.equal(data.aiConfigured,false);
});
test('adoption appends evidence-linked bilingual opportunities and preserves manual edits and selected draft',()=>{
  const p=createProject(source.url);p.sources=[structuredClone(source)];p.company.audience='Lina edited audience';p.pendingAnalysis=pending(p);
  assert.equal(adoptAnalysis(p),1);assert.equal(p.company.audience,'Lina edited audience');assert.equal(p.company.value,'Task support');assert.equal(p.selectedId,null);assert.equal(p.sources[0].verified,false);
  p.selectedId=p.opportunities[0].id;p.drafts[`${p.selectedId}:en`]=makeDraft(p);p.drafts[`${p.selectedId}:en`].proposal='Manual proposal';
  p.pendingAnalysis=pending(p);const selected=p.selectedId;adoptAnalysis(p);touch(p);assert.equal(p.opportunities.length,2);assert.equal(p.selectedId,selected);assert.equal(p.drafts[`${selected}:en`].proposal,'Manual proposal');
  assert.throws(()=>adoptAnalysis(p),/待采用/);assert.doesNotThrow(()=>validateWorkspace({schema:1,projects:[p],activeId:p.id}));
});
test('edits during analysis invalidate adoption; conversion fields reach export drafts in both languages',()=>{
  const p=createProject(source.url);p.sources=[structuredClone(source)];p.pendingAnalysis=pending(p);p.company.value='Edited while pending';assert.throws(()=>adoptAnalysis(p),/已更新/);assert.equal(p.opportunities.length,0);
  p.pendingAnalysis=pending(p);adoptAnalysis(p);p.selectedId=p.opportunities[0].id;
  for(const lang of ['zh','en'])assert.match(makeDraft(p,lang).proposal,/Fixture metric/);
});
test('API requires same-origin JSON POST and missing configuration returns an actionable error',async()=>{
  const url='https://app.example.com/api/analyze';
  let r=await handleApi(new Request(url,{method:'POST',headers:{origin:'https://elsewhere.com','content-type':'application/json'},body:JSON.stringify(input())}),{},{});assert.equal(r.status,403);
  r=await handleApi(new Request(url,{method:'POST',headers:{origin:'https://app.example.com','content-type':'application/json'},body:JSON.stringify(input())}),{},{});assert.equal(r.status,503);assert.match((await r.json()).error,/尚未配置/);
});


test('real provider metadata preserves zero counts and marks absent or invalid usage unknown',async()=>{
  const env={OPENAI_API_KEY:'fixture-key',OPENAI_MODEL:'fixture-model'};
  const response=await analyze(input(),env,{fetcher:async()=>Response.json({status:'completed',usage:{input_tokens:0,output_tokens:12,total_tokens:12},output:[{content:[{type:'output_text',text:JSON.stringify({...resultFixture(),opportunities:[]})}]}]})});
  assert.deepEqual(response.usage,{inputTokens:0,outputTokens:12,totalTokens:12});
  assert.equal(response.provider,'openai');assert.ok(response.elapsedMs>=0);
  const missing=await analyze(input(),env,{fetcher:async()=>Response.json({status:'completed',usage:{input_tokens:-1,output_tokens:'12'},output:[{content:[{type:'output_text',text:JSON.stringify({...resultFixture(),opportunities:[]})}]}]})});
  assert.deepEqual(missing.usage,{inputTokens:null,outputTokens:null,totalTokens:null});
});
test('rerun retains legacy suggestion, adoption status and manual work across backup roundtrip',()=>{
  const p=createProject(source.url);p.sources=[structuredClone(source)];p.pendingAnalysis=pending(p);
  recordAnalysis(p,{...pending(p),usage:{inputTokens:0,outputTokens:2,totalTokens:2},elapsedMs:1200},analysisBasis(p));
  assert.equal(p.analysisHistory.length,2);
  adoptAnalysis(p);p.selectedId=p.opportunities[0].id;const key=`${p.selectedId}:en`;p.drafts[key]={...makeDraft(p,'en'),proposal:'Human edited proposal'};
  recordAnalysis(p,pending(p),analysisBasis(p));
  assert.equal(p.analysisHistory.length,3);assert.equal(p.analysisHistory[1].adopted,true);assert.equal(p.drafts[key].proposal,'Human edited proposal');
  const restored=validateWorkspace(JSON.parse(JSON.stringify({schema:1,projects:[p],activeId:p.id}))).projects[0];
  assert.equal(restored.analysisHistory.length,3);assert.equal(restored.drafts[key].proposal,'Human edited proposal');
  assert.match(researchPanel(restored,{aiConfigured:true},null),/分析记录 · 3/);
});
test('history limit blocks new analysis without silently dropping stored work',()=>{
  const p=createProject(source.url);p.sources=[structuredClone(source)];
  for(let i=0;i<20;i++)recordAnalysis(p,pending(p),analysisBasis(p));
  const before=JSON.stringify(p);assert.equal(analysisHistoryFull(p),true);
  assert.throws(()=>recordAnalysis(p,pending(p),analysisBasis(p)),/20 条/);assert.equal(JSON.stringify(p),before);
});
test('historical evidence survives source changes but stale results cannot be adopted',()=>{
  const p=createProject(source.url);p.sources=[structuredClone(source)];recordAnalysis(p,pending(p),analysisBasis(p));
  p.sources=[];
  assert.doesNotThrow(()=>validateWorkspace({schema:1,projects:[p],activeId:p.id}));assert.throws(()=>adoptAnalysis(p),/已更新/);
  p.analysisHistory[0].usage={inputTokens:-1,outputTokens:0,totalTokens:0};
  assert.throws(()=>validateWorkspace({schema:1,projects:[p],activeId:p.id}));
});
test('history renders imported text as text and never embeds untrusted markup',()=>{
  const p=createProject(source.url);p.sources=[structuredClone(source)];const data=pending(p);data.result.summary='<img src=x onerror=alert(1)>';
  recordAnalysis(p,data,analysisBasis(p));const html=researchPanel(p,{aiConfigured:true},null);
  assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img src=x'));assert.match(html,/未返回/);
});


test('new model outputs require substantive design fields in both languages; old backups remain readable',()=>{
  const legacy=resultFixture();for(const key of designFields){delete legacy.opportunities[0][key];delete legacy.opportunities[0].english[key];}
  assert.doesNotThrow(()=>validateAnalysis(legacy,[source]));
  assert.throws(()=>validateAnalysis(legacy,[source],{requireDesign:true}));
  const complete=resultFixture();assert.doesNotThrow(()=>validateAnalysis(complete,[source],{requireDesign:true}));
  complete.opportunities[0].english.designChange='';assert.throws(()=>validateAnalysis(complete,[source],{requireDesign:true}));
});
test('design intervention survives adoption, edits, bilingual drafts and full backup',()=>{
  const p=createProject(source.url);p.sources=[structuredClone(source)];p.pendingAnalysis=pending(p);adoptAnalysis(p);p.selectedId=p.opportunities[0].id;
  for(const lang of ['en','zh']){p.drafts[`${p.selectedId}:${lang}`]=makeDraft(p,lang);assert.match(p.drafts[`${p.selectedId}:${lang}`].proposal,/Fixture designChange/);assert.match(p.drafts[`${p.selectedId}:${lang}`].proposal,/Fixture deliverables/);}
  assert.doesNotThrow(()=>validateWorkspace(JSON.parse(JSON.stringify({schema:1,projects:[p],activeId:p.id}))));
});
test('repeat collection reuses existing verified records without overwriting manual annotations',()=>{
  const original={...source,verified:true,locator:'Human annotation'};
  const merged=mergeCollectedSources([original],[{...source,id:'C1',verified:false}]);
  assert.equal(merged.added,0);assert.equal(merged.sources[0],original);assert.deepEqual(merged.sourceIds,['E1']);assert.equal(original.locator,'Human annotation');
  const changed=mergeCollectedSources([original],[{...source,excerpt:'Changed evidence'}]);assert.equal(changed.added,1);assert.equal(changed.sources[1].id,'E2');
  assert.deepEqual(uniqueAnalysisSources([source,{...source,id:'E2'}]).map(s=>s.id),['E2']);
  assert.equal(uniqueAnalysisSources([source,{...source,id:'E2',image:'data:image/png;base64,iVBORw0KGgo='}]).length,2);
});
test('session expiry and non-JSON gateways show actionable errors instead of raw JSON parser failures',async()=>{
  await assert.rejects(readResearchResponse(new Response('<html>login</html>',{status:401})),/重新输入测试口令/);
  await assert.rejects(readResearchResponse(new Response('<html>timeout</html>',{status:504})),/HTTP 504/);
  await assert.rejects(readResearchResponse(Response.json({error:'模型服务余额不足'},{status:502})),/余额不足/);
  assert.deepEqual(await readResearchResponse(Response.json({ok:true})),{ok:true});
});


test('company understanding starts with an editable AI draft without replacing human content or own goal',()=>{
  const p=createProject(source.url);p.sources=[structuredClone(source)];p.company.audience='Human audience';const ownGoal=p.company.ownGoal;
  const basis=analysisBasis(p);recordAnalysis(p,pending(p),basis);assert.equal(fillCompanyDraft(p,basis),true);
  assert.equal(p.company.audience,'Human audience');assert.equal(p.company.value,'Task support');assert.equal(p.company.ownGoal,ownGoal);assert.equal(p.company.notes,'');assert.equal(p.companyReviewed,false);assert.equal(p.companyDraftOrigin.type,'ai');
  assert.equal(p.pendingAnalysis.basis,analysisBasis(p));assert.doesNotThrow(()=>adoptAnalysis(p));
  assert.doesNotThrow(()=>validateWorkspace(JSON.parse(JSON.stringify({schema:1,projects:[p],activeId:p.id}))));
});
test('company draft does not apply when research changes while the model is running',()=>{
  const p=createProject(source.url);p.sources=[structuredClone(source)];const basis=analysisBasis(p);recordAnalysis(p,pending(p),basis);p.focus='Changed focus';
  assert.equal(fillCompanyDraft(p,basis),false);assert.equal(p.company.value,'');assert.throws(()=>adoptAnalysis(p),/已更新/);
});


test('selected page plan is limited to three pages and captures each successful page',async()=>{
  const shots=[];const html='<html><title>Evidence</title><body>'+('Public page content. '.repeat(10))+'</body></html>';
  const result=await collectPages(source.url,{pageUrls:[source.url,source.url+'features',source.url+'pricing'],transport:async()=>new Response(html,{headers:{'content-type':'text/html'}}),screenshot:async url=>{shots.push(url);return 'data:image/png;base64,iVBORw0KGgo=';}});
  assert.equal(result.sources.length,3);assert.equal(shots.length,3);assert.ok(result.sources.every(s=>s.image));
  await assert.rejects(collectPages(source.url,{pageUrls:[source.url,source.url+'a',source.url+'b',source.url+'c']}),/1–3/);
});
test('text-only analysis can draft company understanding but cannot pass design proposals as screenshot insights',async()=>{
  const env={OPENAI_API_KEY:'fixture-key',OPENAI_MODEL:'fixture-model'};
  const fetcher=value=>async()=>Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]});
  await assert.rejects(analyze(input(),env,{fetcher:fetcher(resultFixture())}),/完整且有效/);
  const companyOnly={...resultFixture(),opportunities:[]};
  const result=await analyze(input(),env,{fetcher:fetcher(companyOnly)});assert.equal(result.result.company.value,'Task support');assert.equal(result.result.opportunities.length,0);
});


test('remote screenshot requires a server credential and accepts only bounded JPEG output',async()=>{
  assert.equal(remoteScreenshot({}),undefined);
  let request;
  const capture=remoteScreenshot({BROWSERLESS_TOKEN:'fixture-token'},{fetcher:async(url,options)=>{request={url,options};return new Response(new Uint8Array([255,216,255,0]),{headers:{'content-type':'image/jpeg'}});}});
  assert.match(await capture(source.url),/^data:image\/jpeg;base64,/);
  assert.equal(new URL(request.url).origin,'https://production-sfo.browserless.io');assert.ok(!request.options.body.includes('fixture-token'));assert.equal(JSON.parse(request.options.body).url,source.url);
  await assert.rejects(capture('http://127.0.0.1/'));
  const bad=remoteScreenshot({BROWSERLESS_TOKEN:'fixture-token'},{fetcher:async()=>new Response('<html>Error</html>',{headers:{'content-type':'image/jpeg'}})});
  await assert.rejects(bad(source.url),/格式无效/);
});


test('changing selected screenshots invalidates pending results and preserves all sources',()=>{
  const p=createProject(source.url);p.sources=[{...source,image:'data:image/png;base64,iVBORw0KGgo='},{...source,id:'E2',url:source.url+'pricing',image:'data:image/png;base64,iVBORw0KGgo='}];
  p.designSourceIds=['E1'];const before=analysisBasis(p);recordAnalysis(p,pending(p),before);p.designSourceIds=['E2'];assert.notEqual(analysisBasis(p),before);assert.equal(fillCompanyDraft(p,before),false);assert.equal(p.sources.length,2);
  assert.doesNotThrow(()=>validateWorkspace({schema:1,projects:[p],activeId:p.id}));p.designSourceIds=['E1','E1'];assert.throws(()=>validateWorkspace({schema:1,projects:[p],activeId:p.id}));
});


test('company-first step requests a small draft without design proposals',async()=>{
  let sent;
  const result=await analyze({...input(),mode:'company'},{OPENAI_API_KEY:'fixture-key',OPENAI_MODEL:'fixture-model'},{fetcher:async(_url,options)=>{sent=JSON.parse(options.body);return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({...resultFixture(),opportunities:[]})}]}]});}});
  assert.equal(sent.max_output_tokens,3500);assert.equal(sent.text.format.schema.properties.opportunities.maxItems,0);assert.equal(result.mode,'company');assert.equal(result.result.opportunities.length,0);
});
