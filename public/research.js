// Shared by the browser and server. AI responses remain drafts until explicitly adopted.
export const designFields=['designSurface','designChange','deliverables'];
export const insightFields=['title','observation','inference','alternative','preserve','scope','dependencies','validation','behavior','business','metric','guardrails',...designFields];
const text={type:'string',maxLength:4000};
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const copy=object(Object.fromEntries(insightFields.map(key=>[key,text])));
export const analysisSchema=object({
  company:object(Object.fromEntries(['audience','value','goal','journey','notes'].map(key=>[key,text]))),
  summary:text,
  opportunities:{type:'array',maxItems:3,items:object({
    ...copy.properties,discipline:{type:'string',enum:['product','interaction','visual']},
    sourceIds:{type:'array',minItems:1,maxItems:8,items:{type:'string',maxLength:100}},
    english:copy,
  })},
});
export function validateAnalysis(value,sources,{requireDesign=false}={}) {
  const fail=()=>{throw new Error('AI 结果格式或证据引用无效，未写入研究。请重试。');};
  function visit(v,s){
    if(s.type==='string'){if(typeof v!=='string'||v.length>s.maxLength||(s.enum&&!s.enum.includes(v)))fail();}
    else if(s.type==='array'){if(!Array.isArray(v)||v.length>(s.maxItems??100)||v.length<(s.minItems??0))fail();v.forEach(item=>visit(item,s.items));}
    else if(s.type==='object'){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(key=>!Object.hasOwn(s.properties,key)))fail();for(const key of s.required){if(!requireDesign&&designFields.includes(key)&&v[key]===undefined)continue;visit(v[key],s.properties[key]);}}
  }
  visit(value,analysisSchema);
  for(const o of value.opportunities){
    if(o.sourceIds.some(key=>!sources.some(s=>s.id===key)))fail();
    if(o.discipline==='visual'&&!o.sourceIds.some(key=>sources.some(s=>s.id===key&&s.image)))fail();
    if([...['title','observation','inference','scope','validation'],...(requireDesign?designFields:[])].some(key=>!o[key].trim()||!o.english[key].trim()))fail();
  }
  return value;
}
export function analysisBasis(project) {
  const data=JSON.stringify({url:project.url,focus:project.focus,designSourceIds:project.designSourceIds,company:project.company,sources:project.sources.map(({verified,...source})=>source)});
  let hash=2166136261;for(let i=0;i<data.length;i++)hash=Math.imul(hash^data.charCodeAt(i),16777619);
  return `${data.length}:${hash>>>0}`;
}
export function adoptAnalysis(project) {
  const pending=project.pendingAnalysis;
  if(!pending||pending.adopted)throw new Error('没有待采用的 AI 建议。');
  if(pending.basis!==analysisBasis(project))throw new Error('公司理解或来源已更新，请根据最新材料重新分析。原建议仍保留。');
  const result=validateAnalysis(pending.result,project.sources);
  if(project.opportunities.length+result.opportunities.length>100)throw new Error('机会数量已达上限，请先整理现有研究。');
  // Fill blanks only; no selected opportunity, human copy or existing draft is replaced.
  for(const [key,value]of Object.entries(result.company))if(!project.company[key]?.trim())project.company[key]=value;
  for(const item of result.opportunities){
    const {english,...o}=structuredClone(item);
    o.id=crypto.randomUUID();o.status='candidate';o.copy={en:english};
    o.origin={type:'ai',model:pending.model,createdAt:pending.createdAt};
    const source=project.sources.find(s=>item.sourceIds.includes(s.id)&&s.image);
    if(source){
      o.boards=[{id:crypto.randomUUID(),sourceId:source.id,dimension:'hierarchy',copy:{}}];
      for(const [language,c]of [['zh',item],['en',english]])o.boards[0].copy[language]={title:c.title,finding:c.observation,rationale:c.inference,recommendation:c.scope,caption:language==='zh'?'真实来源截图；改进方向尚未验证，提案效果图待补充。':'Source screenshot; recommendation is unvalidated. A proposal mockup has not been created.'};
    }
    project.opportunities.push(o);
  }
  pending.adopted=true;
  const historyEntry=project.analysisHistory?.find(entry=>entry.id===pending.id);
  if(historyEntry)historyEntry.adopted=true;
  return result.opportunities.length;
}

// Keep historical drafts read-only: viewing one never changes the current research.
export const historyLimit=20;
export function recordAnalysis(project,data,basis) {
  const history=project.analysisHistory||[];
  const previous=project.pendingAnalysis;
  const legacy=previous&&!history.some(entry=>entry.id===previous.id)?[{...structuredClone(previous),id:previous.id||crypto.randomUUID()}]:[];
  if(history.length+legacy.length>=historyLimit)throw new Error('分析记录已达 20 条。请先导出并清空记录，再重新分析。');
  validateAnalysis(data.result,project.sources);
  const entry={...structuredClone(data),id:crypto.randomUUID(),basis,adopted:false};
  project.analysisHistory=[...history,...legacy,entry];
  project.pendingAnalysis=structuredClone(entry);
  return entry;
}
export function analysisHistoryFull(project) {
  const history=project.analysisHistory||[];
  return history.length+(project.pendingAnalysis&&!history.some(entry=>entry.id===project.pendingAnalysis.id)?1:0)>=historyLimit;
}

// Exact duplicates add no independent evidence. Keep the latest copy for model input.
const sourceKey=source=>JSON.stringify([source.url,source.excerpt.trim(),source.image||'']);
export function uniqueAnalysisSources(sources) {
  const seen=new Set();
  return sources.slice().reverse().filter(source=>{const key=sourceKey(source);if(seen.has(key))return false;seen.add(key);return true;}).reverse();
}
export function mergeCollectedSources(existing,incoming) {
  const combined=existing.slice(), sourceIds=[];
  let next=Math.max(0,...existing.map(s=>Number(s.id.replace(/^E/,''))||0));
  for(const source of incoming){
    let match=combined.find(s=>sourceKey(s)===sourceKey(source));
    if(!match){if(combined.length>=100)throw new Error('来源数量达到上限，已有内容保留。请先整理来源。');match={...source,id:`E${++next}`};combined.push(match);}
    sourceIds.push(match.id);
  }
  return {sources:combined,sourceIds:[...new Set(sourceIds)],added:combined.length-existing.length};
}
export async function readResearchResponse(response) {
  if(response.status===401||response.status===403)throw new Error('口令授权已失效。请刷新此页并重新输入测试口令；当前浏览器中的项目仍保留。');
  let data;
  try{data=await response.json();}catch{throw new Error(`服务未返回有效结果（HTTP ${response.status}）。可能是登录页面、网关超时或网络中断，请稍后重试。当前研究仍保留。`);}
  if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'本次研究未完成，请稍后重试。');
  return data;
}

export function fillCompanyDraft(project,expectedBasis) {
  const pending=project.pendingAnalysis;
  if(!pending||pending.basis!==expectedBasis||analysisBasis(project)!==expectedBasis)return false;
  let filled=false;
  for(const key of ['audience','value','goal','journey']){
    if(!project.company[key]?.trim()&&pending.result.company[key]?.trim()){
      project.company[key]=pending.result.company[key];filled=true;
    }
  }
  if(filled){
    project.companyReviewed=false;
    project.companyDraftOrigin={type:'ai',createdAt:pending.createdAt,model:pending.model};
    // Keep the suggestion adoptable after its own draft fill, never after concurrent edits.
    pending.basis=analysisBasis(project);
    const entry=project.analysisHistory?.find(item=>item.id===pending.id);
    if(entry)entry.basis=pending.basis;
  }
  return filled;
}
