import { safeImage, boardCopy, dimensions, sourceCopy } from './visual.js';
import { validateAnalysis, historyLimit } from './research.js';
export const STORAGE_KEY = 'design-evals.beta.workspace.v1';
export const id = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const clone = value => JSON.parse(JSON.stringify(value));
export const blankWorkspace = () => ({ schema: 1, projects: [], activeId: null });

export function safeUrl(input) {
  try {
    const raw = String(input).trim();
    if (!raw) return '';
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.') || url.username || url.password) return '';
    return url.href;
  } catch { return ''; }
}

export function createProject(url, focus = '') {
  const normalized = safeUrl(url);
  if (!normalized) throw new Error('请输入有效的网址，例如 https://company.com');
  return {
    id: id(), name: new URL(normalized).hostname.replace(/^www\./, ''), url: normalized,
    mode: 'manual', focus, createdAt: now(), updatedAt: now(), step: 2, revision: 1,
    company: { audience: '', value: '', goal: '', journey: '', ownGoal: '获得一次关于小范围设计合作的对话', notes: '' },
    companyReviewed: false, sources: [], opportunities: [], selectedId: null,
    decision: 'research', noPitchReason: '', drafts: {}, reviewedRevision: null,
  };
}

export function touch(project) {
  project.revision += 1;
  project.updatedAt = now();
  project.reviewedRevision = null;
  // Any research change requires confirmation of the company understanding again.
  project.companyReviewed = false;
}

export function selectedOpportunity(project) {
  return project.opportunities.find(item => item.id === project.selectedId && item.status !== 'excluded');
}

export function draftKey(project, language) { return `${project.selectedId}:${language}`; }

export function draftStale(project, draft) {
  return !!draft && draft.basis !== researchFingerprint(project);
}

export function researchFingerprint(project) {
  const opportunity = selectedOpportunity(project);
  const text = JSON.stringify({ name: project.name, url: project.url, company: project.company,
    opportunity, sources: project.sources.filter(s => opportunity?.sourceIds.includes(s.id)).map(({verified, ...s}) => s) });
  // Compact change detector, so image evidence is not duplicated into every draft.
  let first = 2166136261, second = 5381;
  for (let index = 0; index < text.length; index++) {
    first = Math.imul(first ^ text.charCodeAt(index), 16777619);
    second = Math.imul(second, 33) ^ text.charCodeAt(index);
  }
  return `${text.length}:${first >>> 0}:${second >>> 0}`;
}

export function makeDraft(project, language = 'en') {
  const opportunity = selectedOpportunity(project);
  if (!opportunity) throw new Error('请先选定一个合作机会。');
  const copy = opportunity.copy?.[language];
  const zh = language === 'zh';
  const title = copy?.title || opportunity.title;
  const observation = copy?.observation || opportunity.observation;
  const inference = copy?.inference || opportunity.inference;
  const alternative = copy?.alternative || opportunity.alternative;
  const scope = copy?.scope || opportunity.scope;
  const dependencies = copy?.dependencies || opportunity.dependencies;
  const validation = copy?.validation || opportunity.validation;
  const conversionFields=[['behavior',zh?'期望用户行为':'Expected user behavior'],['business',zh?'业务关联 · 待验证':'Business hypothesis'],['metric',zh?'主要结果指标':'Primary outcome metric'],['guardrails',zh?'成本与体验约束':'Cost and experience guardrails']];
  const conversion=conversionFields.filter(([key])=>copy?.[key]||opportunity[key]).map(([key,label])=>`### ${label}\n${copy?.[key]||opportunity[key]}`).join('\n\n');
  const design=[['designSurface',zh?'设计对象与用户任务':'Design surface and user task'],['designChange',zh?'具体设计改动':'Concrete design changes'],['deliverables',zh?'设计交付物与边界':'Design deliverables and boundaries']].filter(([key])=>copy?.[key]||opportunity[key]).map(([key,label])=>`### ${label}\n${copy?.[key]||opportunity[key]}`).join('\n\n');
  const proposal = zh
    ? `# ${project.name} · ${title}\n\n## 页面观察与专业判断\n${observation}\n\n${inference}\n\n替代解释：${alternative}\n\n## 我的设计建议与合作范围\n${scope}\n\n## 需要先确认\n${dependencies}\n\n## 如何验证\n${validation}`
    : `# ${project.name} · ${title}\n\n## Observation & design assessment\n${observation}\n\n${inference}\n\nAlternative explanation: ${alternative}\n\n## My recommendation & proposed scope\n${scope}\n\n## What we need to confirm\n${dependencies}\n\n## How we would evaluate it\n${validation}`;
  const opening = copy?.opening || (zh
    ? `${project.name} 团队好，我是 Lina，一名产品设计师。\n\n研究你们的公开资料时，我关注到一个值得进一步确认的方向：${title}。${inference}\n\n我想先探讨一个小范围项目：${scope}\n\n是否方便聊聊你们目前的优先事项？`
    : `Hi ${project.name} team — I’m Lina, a product designer.\n\nWhile reviewing your public materials, I identified a possible area to explore: ${title}. ${inference}\n\nI would start with a focused project: ${scope}\n\nWould a short conversation about your current priorities be useful?`);
  const script = zh
    ? `【开场 · 约 15 秒】\n我想分享一个关于 ${project.name} 的初步观察：${title}。\n\n【观察 · 约 25 秒】\n${observation}\n${inference}\n\n【建议 · 约 30 秒】\n${scope}\n\n【收尾 · 约 15 秒】\n${dependencies}\n这些仍是待验证的假设，想先了解是否符合你们的优先级。`
    : `[Opening · about 15 seconds]\nI’d like to share an initial observation about ${project.name}: ${title}.\n\n[Observation · about 25 seconds]\n${observation}\n${inference}\n\n[Project · about 30 seconds]\n${scope}\n\n[Close · about 15 seconds]\n${dependencies}\nThese are working hypotheses. I’d like to understand whether they align with your priorities.`;
  return { proposal:proposal+(design?`\n\n## ${zh?'具体设计方案':'Proposed design intervention'}\n\n${design}`:'')+(conversion?`\n\n## ${zh?'用户行为与业务验证':'User behavior and business validation'}\n\n${conversion}`:''), opening, script, basis: researchFingerprint(project), updatedAt: now() };
}

export function reviewBlockers(project, language = 'en') {
  const problems = [];
  const opportunity = selectedOpportunity(project);
  if (project.decision === 'no-pitch') problems.push('当前决定为暂不形成提案');
  if (!project.companyReviewed) problems.push('确认公司理解');
  if (!project.company.audience.trim() || !project.company.goal.trim()) problems.push('补充服务对象与公司目标');
  if (!opportunity) problems.push('选定一个合作机会');
  if (opportunity && !opportunity.sourceIds.length) problems.push('为选中机会关联来源');
  if (opportunity?.sourceIds.some(key => !project.sources.find(s => s.id === key)?.verified)) problems.push('逐条核对关联来源');
  if (opportunity && ['observation', 'inference', 'alternative', 'scope', 'dependencies', 'validation'].some(key => !opportunity[key]?.trim())) problems.push('补齐机会的观察、推断、替代解释、范围、依赖与验证方式');
  if (opportunity?.boards?.some(b => !safeImage(project.sources.find(s=>s.id===b.sourceId)?.image))) problems.push('为图文建议补充原页面截图');
  if (opportunity?.boards?.some(b => !b.copy?.[language] || ['title','finding','rationale','recommendation'].some(k=>!b.copy[language][k]?.trim()))) problems.push('补齐当前语言的图文建议');
  const draft = project.drafts[draftKey(project, language)];
  if (!draft || ['proposal', 'opening', 'script'].some(key => !draft[key]?.trim())) problems.push('完成三份提案草稿');
  if (draftStale(project, draft)) problems.push('核对提案与最新研究是否一致');
  return problems;
}

export function exportMarkdown(project, language = 'en') {
  const draft = project.drafts[draftKey(project, language)];
  if (!draft || !selectedOpportunity(project) || project.decision === 'no-pitch') throw new Error('请先完成并选择可导出的提案。');
  const reviewed = project.reviewedRevision === `${project.revision}:${language}` && !reviewBlockers(project, language).length;
  const zh = language === 'zh';
  const status = reviewed ? (zh ? '已人工复核' : 'Human-reviewed') : (zh ? '研究草稿 · 待复核' : 'Research draft · not reviewed');
  const sample = project.mode === 'sample' ? (zh ? ' · 研究样例' : ' · research sample') : '';
  const sources = project.sources.filter(s => selectedOpportunity(project).sourceIds.includes(s.id)).map(s=>sourceCopy(s,language));
  const references = sources.map(s => `- [${s.title.replace(/[\[\]\\]/g, '')}](${safeUrl(s.url)}) — ${s.locator.replace(/\n/g, ' ')}; ${s.capturedAt || (zh ? '采集时间未知' : 'capture date unknown')}; ${s.verified ? (zh ? '已核对' : 'checked') : (zh ? '待核对' : 'not checked')}`).join('\n');
  const visuals = (selectedOpportunity(project).boards || []).map(b => {
    const c = boardCopy(b,language), source = sources.find(s=>s.id===b.sourceId);
    return `## ${c.title}\n\n${zh?'现有页面':'Current page'} · ${source?.capturedAt || ''}\n\n${safeImage(source?.image) ? `![${zh?'原页面截图':'Original screenshot'}](${safeImage(source.image)})` : (zh?'尚未补充原页面截图':'Original screenshot not yet added')}\n\n${zh?'建议方案 · 概念示意，未上线':'Proposed direction · concept, not implemented'}\n\n${safeImage(b.proposalImage) ? `![${zh?'方案示意':'Design concept'}](${safeImage(b.proposalImage)})` : ''}\n${c.caption}\n\n**${zh?'页面观察':'What I see'}**\n${c.finding}\n\n**${zh?'设计判断':'My design assessment'}**\n${c.rationale}\n\n**${zh?'建议怎么改':'What I recommend'}**\n${c.recommendation}\n`;
  }).join('\n');
  return `${status}${sample}\n\n${draft.proposal}\n\n${visuals}\n\n---\n\n## ${zh ? '开场信息' : 'Opening message'}\n\n${draft.opening}\n\n## ${zh ? '讲解提纲（目标 60–90 秒，需试讲校时）' : 'Talk outline (target: 60–90 seconds; rehearse to time)'}\n\n${draft.script}\n\n## ${zh ? '来源' : 'Sources'}\n\n${references || (zh ? '尚未关联来源。' : 'No sources linked yet.')}\n`;
}

// Import only our explicit record types; never interpret imported content as markup or code.
export function validateWorkspace(value) {
  const fail = () => { throw new Error('备份格式无效。请导入 Design Evals 导出的完整 JSON 备份。'); };
  const string = (v, max = 40000) => typeof v === 'string' && v.length <= max;
  const plain = v => v && typeof v === 'object' && !Array.isArray(v);
  if (!plain(value) || value.schema !== 1 || !Array.isArray(value.projects) || value.projects.length > 100) fail();
  const projectIds = new Set();
  for (const p of value.projects) {
    if (!plain(p) || !string(p.id, 100) || projectIds.has(p.id) || !string(p.name, 200) || !safeUrl(p.url) || safeUrl(p.url) !== p.url || !['sample', 'manual'].includes(p.mode)) fail();
    projectIds.add(p.id);
    if (![1, 2, 3, 4].includes(p.step) || !Number.isSafeInteger(p.revision) || p.revision < 1 || typeof p.companyReviewed !== 'boolean' || !['research', 'pitch', 'no-pitch'].includes(p.decision)) fail();
    if (!plain(p.company) || !['audience', 'value', 'goal', 'journey', 'ownGoal', 'notes'].every(k => string(p.company[k]))) fail();
    if (!['focus', 'createdAt', 'updatedAt', 'noPitchReason'].every(k => string(p[k])) || (p.reviewedRevision !== null && !string(p.reviewedRevision))) fail();
    if (!Array.isArray(p.sources) || p.sources.length > 100 || !Array.isArray(p.opportunities) || p.opportunities.length > 100 || !plain(p.drafts)) fail();
    const sourceIds = new Set();
    for (const s of p.sources) {
      if (!plain(s) || !['id', 'title', 'url', 'excerpt', 'locator', 'limitation', 'capturedAt', 'method'].every(k => string(s[k])) || !string(s.id, 100) || !string(s.title, 200) || sourceIds.has(s.id) || !safeUrl(s.url) || safeUrl(s.url) !== s.url || typeof s.verified !== 'boolean') fail();
      if (s.image !== undefined && s.image !== '' && !safeImage(s.image)) fail();
      if (s.copy !== undefined) {
        if (!plain(s.copy)) fail();
        for (const [lang,c] of Object.entries(s.copy)) if (!['en','zh'].includes(lang) || !plain(c) || !Object.entries(c).every(([key,val])=>['title','locator','limitation','excerpt','method'].includes(key) && string(val))) fail();
      }
      sourceIds.add(s.id);
    }
    const opportunityIds = new Set();
    for (const o of p.opportunities) {
      for(const key of ['behavior','business','metric','guardrails','designSurface','designChange','deliverables'])if(o[key]!==undefined&&!string(o[key]))fail();
      if (!plain(o) || !['id', 'title', 'observation', 'inference', 'alternative', 'scope', 'dependencies', 'validation', 'preserve'].every(k => string(o[k])) || !['candidate', 'excluded'].includes(o.status) || opportunityIds.has(o.id)) fail();
      if (!Array.isArray(o.sourceIds) || !o.sourceIds.every(key => sourceIds.has(key))) fail();
      if (o.discipline !== undefined && !['product','interaction','visual'].includes(o.discipline)) fail();
      if (o.boards !== undefined) {
        if (!Array.isArray(o.boards) || o.boards.length > 20) fail();
        const boardIds = new Set();
        for (const b of o.boards) {
          if (!plain(b) || !string(b.id,100) || boardIds.has(b.id) || !o.sourceIds.includes(b.sourceId) || !Object.hasOwn(dimensions,b.dimension) || !plain(b.copy)) fail();
          boardIds.add(b.id);
          if (b.proposalImage !== undefined && b.proposalImage !== '' && !safeImage(b.proposalImage)) fail();
          if (!Object.keys(b.copy).length) fail();
          for (const [lang,c] of Object.entries(b.copy)) {
            if (!['en','zh'].includes(lang) || !plain(c) || !['title','finding','rationale','recommendation','caption'].every(k=>string(c[k]))) fail();
          }
        }
      }
      if (o.copy !== undefined) {
        if (!plain(o.copy)) fail();
        for (const [lang, copy] of Object.entries(o.copy)) {
          if (!['en', 'zh'].includes(lang) || !plain(copy) || !Object.values(copy).every(v => string(v))) fail();
        }
      }
      opportunityIds.add(o.id);
    }
    if (p.selectedId !== null && !opportunityIds.has(p.selectedId)) fail();
    if(p.designSourceIds!==undefined&&(!Array.isArray(p.designSourceIds)||p.designSourceIds.length>3||new Set(p.designSourceIds).size!==p.designSourceIds.length||p.designSourceIds.some(id=>!sourceIds.has(id))))fail();
    if(p.captureMode!==undefined&&!['auto','manual'].includes(p.captureMode))fail();
    if(p.pageUrls!==undefined&&(!Array.isArray(p.pageUrls)||p.pageUrls.length<1||p.pageUrls.length>3||p.pageUrls.some(url=>!safeUrl(url))))fail();
    if(p.companyDraftOrigin!==undefined){const origin=p.companyDraftOrigin;if(!plain(origin)||origin.type!=='ai'||!string(origin.createdAt)||!string(origin.model,200))fail();}
    if(p.researchError!==undefined&&!string(p.researchError))fail();
    if(p.collection!==undefined){
      const c=p.collection;
      if(!plain(c)||!string(c.completedAt)||!string(c.coverage)||!Array.isArray(c.sourceIds)||!c.sourceIds.every(key=>sourceIds.has(key))||!Array.isArray(c.failures)||c.failures.length>5)fail();
      for(const f of c.failures)if(!plain(f)||!string(f.url)||!string(f.message)||!string(f.stage))fail();
    }
    function checkAnalysis(pending) {
      if(!plain(pending)||!string(pending.model,200)||!string(pending.basis,100)||!string(pending.createdAt)||typeof pending.adopted!=='boolean')fail();
      if(pending.id!==undefined&&(!string(pending.id,100)||!pending.id))fail();
      if(pending.mode!==undefined&&!['company','design'].includes(pending.mode))fail();
      if(pending.provider!==undefined&&!['deepseek','openai'].includes(pending.provider))fail();
      if(pending.elapsedMs!==undefined&&(!Number.isSafeInteger(pending.elapsedMs)||pending.elapsedMs<0))fail();
      if(pending.usage!==undefined){
        if(!plain(pending.usage))fail();
        for(const key of ['inputTokens','outputTokens','totalTokens'])if(pending.usage[key]!==null&&(!Number.isSafeInteger(pending.usage[key])||pending.usage[key]<0))fail();
      }
      // Historical source IDs remain valid as records even if current sources change.
      const refs=[...new Set((pending.result?.opportunities||[]).flatMap(o=>o.sourceIds||[]))];
      try{validateAnalysis(pending.result,refs.map(id=>({id,image:'historical evidence'})));}catch{fail();}
    }
    if(p.pendingAnalysis!==undefined)checkAnalysis(p.pendingAnalysis);
    if(p.analysisHistory!==undefined){
      if(!Array.isArray(p.analysisHistory)||p.analysisHistory.length>historyLimit)fail();
      const ids=new Set();
      for(const entry of p.analysisHistory){checkAnalysis(entry);if(!entry.id||ids.has(entry.id))fail();ids.add(entry.id);}
    }
    for (const [key, draft] of Object.entries(p.drafts)) {
      if (![...opportunityIds].some(oid => key === `${oid}:en` || key === `${oid}:zh`) || !plain(draft) || !['proposal', 'opening', 'script', 'basis', 'updatedAt'].every(k => string(draft[k], 3000000))) fail();
    }
  }
  if (value.activeId !== null && !projectIds.has(value.activeId)) fail();
  return value;
}
