import {requireBetaAccess,betaSession} from './access-client.js';
import { STORAGE_KEY, id, now, blankWorkspace, safeUrl, createProject, touch, selectedOpportunity, draftKey, makeDraft, draftStale, reviewBlockers, exportMarkdown, validateWorkspace, researchFingerprint } from './model.js';
import { linkModelSample } from './sample.js';
import { dimensions, disciplines, safeImage, visualBoards, reportStyles } from './visual.js';
import { portableProject, reportBody, reportHtml } from './report.js';
import { analysisBasis, adoptAnalysis, insightFields, recordAnalysis, analysisHistoryFull, uniqueAnalysisSources, mergeCollectedSources, readResearchResponse, fillCompanyDraft } from './research.js';
import { researchPanel } from './research-ui.js';
const reportStyle = document.createElement('style'); reportStyle.textContent = reportStyles; document.head.append(reportStyle);

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const icons = {
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  file: '<path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h6"/>', link: '<path d="m10 13 4-4M8 15l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 3 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 0)"/>',
  check: '<path d="m5 12 4 4L19 6"/>', external: '<path d="M14 4h6v6m0-6L10 14M10 4H4v16h16v-6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>', book: '<path d="M12 5v16M3 3l9 2 9-2v16l-9 2-9-2z"/>',
  edit: '<path d="m4 16-1 5 5-1L20 8l-4-4zM13 7l4 4"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>',
};
const icon = name => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.file}</svg>`;
let workspace = blankWorkspace();
let storageError = '';
let conflicting = false;
let initialDraftFilled = false;
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    workspace = validateWorkspace(JSON.parse(saved));
    let migrated=false;
    for(const p of workspace.projects)if(p.pendingAnalysis&&!p.companyDraftOrigin&&fillCompanyDraft(p,analysisBasis(p))){touch(p);migrated=true;}
    initialDraftFilled=migrated;
  }
} catch {
  storageError = '浏览器中的旧数据无法读取，已停止自动保存。请先下载原始数据备份，或导入有效备份后继续。';
}
let home = !workspace.activeId;
let language = 'en';
let section = 'proposal';
let toastTimer;
let modalReturn;
let serviceStatus=null;
const researchJobs=new Map();
const project = () => workspace.projects.find(p => p.id === workspace.activeId);

function notify(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 4200);
}

function persist() {
  if (storageError || conflicting) return false;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace)); updateSave(); return true; }
  catch {
    storageError = '本次修改未保存：浏览器存储不可用或已满。请立即下载完整备份；可移除截图后重试保存。';
    showStorageWarning(); return false;
  }
}

function showStorageWarning() {
  const banner = $('#storage-warning');
  if (!banner) return;
  banner.hidden = !storageError && !conflicting;
  banner.innerHTML = `<span>${esc(conflicting ? '另一个标签页已更新数据。当前编辑已暂停，请下载当前备份，或重新载入最新版本。' : storageError)}</span><button data-action="backup">下载当前备份</button><button data-action="raw-backup">下载已存数据</button>${conflicting ? '<button data-action="reload">重新载入</button>' : '<button data-action="retry-save">重试保存</button>'}`;
}

function updateSave() {
  if ($('#save-status')) $('#save-status').textContent = storageError ? '尚未保存' : '已保存到此浏览器';
}

function editProject(mutator, invalidate = true) {
  if (conflicting) { notify('请先重新载入另一标签页的更新。'); return false; }
  const p = project();
  if (!p) return false;
  mutator(p);
  if (invalidate) touch(p);
  persist();
  return true;
}

function badge(text, variant = '') { return `<span class="badge ${variant}">${esc(text)}</span>`; }
function external(url, text) { return `<a href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${esc(text)} ${icon('external')}</a>`; }
function labelInput(label, name, value, options = {}) {
  const { area = false, hint = '', required = false, type = 'text', placeholder = '', rows = 3 } = options;
  return `<label class="field"><span>${esc(label)}${required ? '<b class="required"> *</b>' : ''}</span>${area ? `<textarea name="${name}" rows="${rows}" ${required ? 'required' : ''} maxlength="12000" placeholder="${esc(placeholder)}">${esc(value)}</textarea>` : `<input name="${name}" type="${type}" value="${esc(value)}" ${required ? 'required' : ''} maxlength="${name === 'name' || name === 'title' ? 200 : 2000}" placeholder="${esc(placeholder)}">`}${hint ? `<small>${esc(hint)}</small>` : ''}</label>`;
}

function render() {
  const p = project();
  const step = p?.step || 1;
  $('#app').innerHTML = `<aside class="sidebar">
    <button class="brand" data-action="home" aria-label="Design Evals 首页"><span class="brand-icon">A<span>↗</span></span><span>Design Evals<small>EXPERTISE INTO ACTION</small></span></button>
    <div class="workspace-label">个人工作空间</div>
    <button class="nav-item ${home ? 'active' : ''}" data-action="home">${icon('grid')} 我的项目 <span class="nav-count">${workspace.projects.length}</span></button>
    <button class="nav-item" data-action="new">${icon('plus')} 新建研究</button>
    <div class="workspace-label projects-label">最近研究</div>
    <div class="side-projects">${workspace.projects.slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,6).map(item => `<button class="project-nav ${!home && p?.id === item.id ? 'current' : ''}" data-action="open" data-id="${esc(item.id)}"><span class="project-dot"></span><span>${esc(item.name)}</span>${item.mode === 'sample' ? '<small>样例</small>' : ''}</button>`).join('') || '<p class="muted small">从一个目标公司开始。</p>'}</div>
    <div class="sidebar-bottom"><div class="local-note">${icon('book')}<div>你的研究，由你判断<small>所有草稿仅保存在此浏览器</small></div></div><button class="nav-item" data-action="backup">${icon('download')} 备份项目</button><button class="nav-item" data-action="import">${icon('file')} 导入备份</button><div class="profile"><span class="avatar">L</span><div>受邀测试者<small>口令内测 · v0.4.2</small></div><span class="online-dot"></span></div></div>
  </aside>
  <div class="app-body"><header class="topbar"><div class="breadcrumb">工作空间 <span>/</span> <b>${home ? '我的项目' : esc(p?.name || '研究项目')}</b></div><div class="top-actions"><span class="save-indicator"></span><span id="save-status">${storageError ? '尚未保存' : '已保存到此浏览器'}</span>${badge('设计专家工作台')}</div></header>
  <div id="storage-warning" class="storage-warning" role="alert" hidden></div>
  <aside class="beta-banner"><b>Design Evals · 邀请内测</b><span>项目仅保存在此浏览器；AI 输出需人工复核。</span><a href="https://linadong.design/zh/lab/product-evals">项目说明</a><button class="text-button" data-beta-logout>退出口令授权</button></aside><main id="main" tabindex="-1">${home || !p ? renderHome() : `<div class="project-top"><div><span class="eyebrow">RESEARCH PROJECT</span><div class="project-title"><h1>${esc(p.name)}</h1>${badge(p.mode === 'sample' ? '研究样例' : '自主研究', p.mode === 'sample' ? 'olive' : '')}</div><div class="project-url">${external(p.url, new URL(p.url).hostname)}<span>·</span><span>产品 · 交互 · 视觉 / 由你作出专业判断</span></div></div><button class="button subtle" data-action="backup-project">${icon('download')} 备份此项目</button></div>
  <nav class="steps" aria-label="研究步骤">${['输入目标','公司理解','机会工作台','编辑与导出'].map((title, index) => `<button class="step ${step === index+1 ? 'active' : ''}" data-action="step" data-step="${index+1}" ${step === index+1 ? 'aria-current="step"' : ''}><span class="step-number">0${index+1}</span><span>${title}</span>${index < 3 ? '<span class="step-line"></span>' : ''}</button>`).join('')}</nav>
  ${[2,3].includes(step)?`${renderPagePlan(p)}<section id="research-assistant">${researchPanel(p,serviceStatus,researchJobs.get(p.id))}</section>`:''}${[null,renderTarget,renderCompany,renderWorkbench,renderEditor][step](p)}`}</main>
  <footer class="page-footer"><span>Design Evals</span><span>从观察出发，让合作有据可依。</span></footer></div><input type="file" id="import-file" accept="application/json,.json" hidden>`;
  showStorageWarning();
}

function renderHome() {
  const list = workspace.projects.slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  return `<section class="home-hero"><div class="hero-copy"><span class="eyebrow">A THOUGHTFUL START TO YOUR NEXT PITCH</span><h1>从看见问题，<br>到开启一次<span>合作。</span></h1><p>以你的设计专业判断为核心，结合产品、交互与视觉，<br class="desktop-only">把页面证据与具体建议整理成一份图文提案。</p><form id="new-project-form" class="url-form"><label class="sr-only" for="target-url">目标公司网址</label><div>${icon('link')}<input id="target-url" name="url" placeholder="输入目标公司网址" required autocomplete="url"></div><button class="button primary" type="submit">开始研究 ${icon('arrow')}</button></form><div class="hero-hint"><span class="tiny-dot"></span> 输入网址后自动采集公开资料，由 AI 整理公司理解初稿</div></div>
  <div class="process-art" aria-label="工作流程：理解公司、确认机会、形成提案"><div class="art-caption">LESS GUESSWORK. MORE CONTEXT.</div><div class="art-document art-one"><span class="art-icon">${icon('book')}</span><small>01 / UNDERSTAND</small><strong>先理解产品</strong><div class="art-rule"></div><div class="art-rule short"></div></div><div class="art-connector"></div><div class="art-document art-two"><span class="art-icon green">${icon('check')}</span><small>02 / FIND THE FIT</small><strong>找到合作切入点</strong><span class="art-tag">观察 + 证据 + 判断</span></div><div class="art-footnote">一个公司，一个有边界的机会。</div></div></section>
  <section class="sample-banner"><div class="sample-monogram">L<span>↗</span></div><div><div class="inline-heading"><h2>先用 LinkModel 走一遍</h2>${badge('研究样例','olive')}</div><p>真实页面截图、两组视觉改进示意，以及产品与交互研究。</p></div><button class="button secondary" data-action="sample">打开图文样例 ${icon('arrow')}</button></section>
  <section class="projects-section"><div class="section-heading"><div><h2>我的研究</h2><p>保留每一次判断，也保留还没确定的部分。</p></div><span class="muted small">${list.length} 个项目</span></div>${list.length ? `<div class="project-table"><div class="table-head"><span>目标公司</span><span>当前阶段</span><span>最近编辑</span><span></span></div>${list.map(item => `<button class="project-row" data-action="open" data-id="${esc(item.id)}"><span class="project-cell"><span class="company-avatar">${esc(item.name[0].toUpperCase())}</span><span><b>${esc(item.name)}</b><small>${esc(new URL(item.url).hostname)} ${item.mode === 'sample' ? '· 研究样例' : ''}</small></span></span><span>${item.decision === 'no-pitch' ? '暂不形成提案' : ['','输入目标','公司理解','机会工作台','编辑与导出'][item.step]}</span><span class="muted">${new Date(item.updatedAt).toLocaleDateString('zh-CN')}</span>${icon('arrow')}</button>`).join('')}</div>` : '<div class="empty-projects"><span class="empty-symbol">↗</span><div><b>下一次合作，从这里开始</b><p>输入目标网址创建研究，或打开上方样例体验完整流程。</p></div></div>'}</section>
  <div class="mobile-backup"><button class="text-button" data-action="backup">备份所有项目</button><button class="text-button" data-action="import">导入备份</button></div><div class="principles"><div><span>01</span><b>观察有来源</b><p>重要事实能回到原文。</p></div><div><span>02</span><b>判断留余地</b><p>把事实、推断与未知分开。</p></div><div><span>03</span><b>建议有边界</b><p>从一个具体的小项目开始。</p></div></div>`;
}

function updateResearchPanel(){const p=project();if(p&&$('#research-assistant'))$('#research-assistant').innerHTML=researchPanel(p,serviceStatus,researchJobs.get(p.id));if(p&&$('.page-plan'))$('.page-plan').outerHTML=renderPagePlan(p);}
async function refreshService(){
  if(!await betaSession()){serviceStatus={collection:true,screenshots:false,aiConfigured:true,needsCode:true};updateResearchPanel();return;}
  try{const r=await fetch('/api/design-evals/status',{signal:AbortSignal.timeout(12000)});serviceStatus=await readResearchResponse(r);}
  catch(error){serviceStatus={collection:false,aiConfigured:false,error:error.name==='TimeoutError'?'连接检查超时，请检查网络后重试。':error.message};}
  updateResearchPanel();
}
async function runResearch(kind,mode='design'){
  if(!await requireBetaAccess())return;
  if(serviceStatus?.needsCode)await refreshService();
  const p=project();if(!p||researchJobs.has(p.id)||conflicting)return;
  if(kind==='analyze'&&analysisHistoryFull(p)){notify('分析记录已达 20 条，请先导出并清空记录。');return;}
  if(storageError){notify('请先恢复保存或下载备份，再开始采集或分析。');return;}
  const controller=new AbortController(),job={kind,mode,controller};researchJobs.set(p.id,job);p.researchError='';updateResearchPanel();
  try{
    let body={url:p.url,...(p.pageUrls?.length?{pageUrls:p.pageUrls}:{})};const basis=analysisBasis(p);
    if(kind==='analyze'){
      const chosenIds=p.designSourceIds||p.sources.filter(s=>s.image).slice(-3).map(s=>s.id);
      const selected=[...p.sources.filter(s=>!s.image),...p.sources.filter(s=>s.image&&chosenIds.includes(s.id))];
      const sources=structuredClone(uniqueAnalysisSources(selected).slice(-8));let images=0;
      for(const source of sources){source.limitation=source.limitation.slice(0,4000);if(mode==='company'){delete source.image;continue;}if(source.image&&images++<3){if(!source.image.startsWith('data:'))source.image=await readImage(source.image);}else delete source.image;}
      body={url:p.url,focus:p.focus.slice(0,4000)||(mode==='company'?'根据公开资料整理公司背景，标明推断与未知。':'基于选中截图提出最多一条具体设计方案，明确改什么以及设计交付物；证据不足时不提出改版。'),sources,mode};
    }
    const response=await fetch(`/api/design-evals/${kind}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(kind==='collect'?75000:105000)])});
    const data=await readResearchResponse(response);
    if(controller.signal.aborted)return;
    if(conflicting)throw new Error('其他标签页已更新研究，本次结果没有写入。请重新载入。');
    if(kind==='collect'){
      const merged=mergeCollectedSources(p.sources,data.sources);
      p.sources=merged.sources;
      p.collection={completedAt:data.completedAt,coverage:data.coverage,failures:data.failures,sourceIds:merged.sourceIds};
      if(merged.added)touch(p);
      p.researchError=merged.sourceIds.length?(merged.added?'':'采集完成：内容与已有来源相同，未重复添加。可以继续分析。'):'没有采集到可用正文，请查看失败记录，或手动补充来源。';
    }else{recordAnalysis(p,data,basis);if(fillCompanyDraft(p,basis))touch(p);}
    persist();
  }catch(error){p.researchError=controller.signal.aborted?'已取消等待，已有来源和编辑仍保留。':error.name==='TimeoutError'?'请求等待超时，请稍后重试；已有来源和编辑保留。':error.message;if(!conflicting)persist();}
  finally{researchJobs.delete(p.id);if(project()?.id===p.id&&!conflicting)render();}
}

function renderPagePlan(p) {
  const pages=p.pageUrls||p.sources.slice(0,3).map(s=>s.url);
  const available=p.sources.filter(s=>s.image);
  const selectedIds=p.designSourceIds||available.slice(-3).map(s=>s.id);
  const sources=available.filter(s=>selectedIds.includes(s.id));
  const manual=p.captureMode!=='auto';
  return `<section class="panel page-plan"><div class="panel-heading"><h3>先选页面，再看设计</h3><span class="badge">最多 3 页</span></div><p class="muted">优先选择首页、一个关键功能页和一个关键决策页。可修改建议网址；正文用于了解公司，截图用于设计判断。</p><div class="research-actions" role="group" aria-label="截图方式"><button class="button ${manual?'primary':'secondary'}" data-action="capture-mode" data-mode="manual" aria-pressed="${manual}">上传已有截图</button><button class="button ${!manual?'primary':'secondary'}" data-action="capture-mode" data-mode="auto" aria-pressed="${!manual}">自动截取页面</button></div><p class="small muted">${manual?'上传你实际看到的页面，可与自动截图混用；每次分析最多使用 3 张截图。':'选择最多 3 个网址。自动截图为桌面当前视口，长页面下方或登录后流程可补充人工截图。'}</p>${manual?`<button class="button secondary" data-action="page-upload">添加页面截图</button><p class="small muted">支持 PNG / JPEG / WebP，单张最大 1 MB；上传时补充页面网址与区域说明。</p>`:''}<form id="page-plan-form" ${manual?'hidden':''}><div class="page-url-fields">${[1,2,3].map((n,i)=>labelInput(`页面 ${n}${n===1?' · 必填':' · 可选'}`,`page${n}`,pages[i]||(n===1?p.url:''),{type:'url',required:n===1,placeholder:'https://…'})).join('')}</div><button class="button secondary" type="submit" ${researchJobs.has(p.id)||!serviceStatus?.screenshots?'disabled':''}>自动截图并采集这几个页面</button></form><p class="small muted">${serviceStatus?.screenshots?'本地会为选定的最多 3 个页面分别截图。':'自动截图服务尚未连接；可使用“上传已有截图”。正文仍可整理公司理解，但不会冒充页面设计评审。'}</p>${available.length?`<p class="small muted">本次分析页面（已选 ${sources.length}/3）：</p><div class="research-actions">${available.map(s=>`<button class="button ${selectedIds.includes(s.id)?'primary':'secondary'}" data-action="select-design-page" data-id="${esc(s.id)}" aria-pressed="${selectedIds.includes(s.id)}">${esc(s.id)} · ${esc(s.title)}</button>`).join('')}</div><div class="page-evidence-grid">${sources.map(source=>`<article><button class="text-button" data-action="source-view" data-id="${esc(source.id)}">${esc(source.id)} · ${esc(source.title)}</button><img class="evidence-image" src="${esc(safeImage(source.image))}" alt="${esc(source.title)} · 页面截图"><p class="small muted">${esc(source.url)}</p><button class="text-button" data-action="page-upload" data-id="${esc(source.id)}">替换截图 / 补充区域说明</button>${(p.pendingAnalysis?.result.opportunities||[]).filter(o=>o.sourceIds.includes(source.id)).map(o=>`<div class="page-insight"><h4>${esc(o.title)}</h4><p><b>设计对象</b> ${esc(o.designSurface||o.observation)}</p><p><b>改动方案</b> ${esc(o.designChange||o.scope)}</p><p><b>交付物</b> ${esc(o.deliverables||'待拆解')}</p></div>`).join('')||'<p class="small muted">该页面尚无设计方案；补齐证据后再分析，不强行提出改版。</p>'}</article>`).join('')}</div>`:''}</section>`;
}

function renderTarget(p) {
  return `<div class="section-intro"><span class="eyebrow">01 / START WITH CONTEXT</span><h2>这次，想了解哪家公司？</h2><p>网址只是起点。后续可以补充材料、修正理解，再决定是否适合合作。</p></div><form id="target-form" class="panel form-panel"><div class="two-fields">${labelInput('公司名称','name',p.name,{required:true})}${labelInput('目标网址','url',p.url,{required:true})}</div>${labelInput('特别想关注的地方','focus',p.focus,{area:true,placeholder:'例如：新用户如何理解价值并完成首次使用'})}<p class="callout">${p.mode === 'sample' ? '这是 LinkModel 的研究样例。更换目标公司请新建研究，避免把样例证据带入其他公司。' : '新建研究会采集公开网页。下一步可检查采集记录、补充截图，再让 AI 提出待审阅的建议。'}</p><div class="form-actions"><button class="button primary" type="submit">保存，继续理解公司 ${icon('arrow')}</button></div></form>`;
}

function renderCompany(p) {
  return `<div class="section-intro"><span class="eyebrow">02 / UNDERSTAND BEFORE YOU JUDGE</span><h2>先理解产品，再定义机会。</h2><p>这些是当前的研究判断。确认、补充或改写，让后续提案建立在正确的上下文上。</p></div><div class="company-layout"><form id="company-form" class="panel company-form"><div class="panel-heading"><h3>公司理解卡</h3>${badge(p.companyReviewed ? '已确认' : p.companyDraftOrigin?'AI 草稿 · 待核对':'待整理', p.companyReviewed ? 'green' : 'amber')}</div><p class="callout">${p.companyDraftOrigin?'以下是根据来源整理的 AI 草稿，可能包含假设。请修改不合适的内容；不确定的地方可保留“未知”或“待确认”，无需替公司作判断。':'新建研究会自动采集并整理初稿；如未完成，可点击上方“整理公司理解初稿”重试。你只需纠正和补充，已有内容不会被覆盖。'}</p>${labelInput('服务对象','audience',p.company.audience,{area:true,placeholder:'根据公开来源整理；未知时会明确标记',required:true})}${labelInput('解决什么问题','value',p.company.value,{area:true,placeholder:'产品提供的核心价值'})}<div class="goal-field">${labelInput('公司的目标','goal',p.company.goal,{area:true,required:true,hint:'标明已确认的事实与暂定假设。'})}</div>${labelInput('建议观察的用户路径','journey',p.company.journey,{area:true})}${labelInput('我的合作目标','ownGoal',p.company.ownGoal,{area:true})}${labelInput('内部备注与范围限制','notes',p.company.notes,{area:true,hint:'内部备注不会进入对外提案。'})}<div class="form-actions"><button class="button secondary" type="submit" name="intent" value="save">保存修改</button><button class="button primary" type="submit" name="intent" value="continue">确认，寻找合作机会 ${icon('arrow')}</button></div></form>
    <aside class="company-context"><div class="context-note"><span class="eyebrow">RESEARCH COVERAGE</span><h3>我们知道什么，<br>还不知道什么。</h3><p>${p.mode === 'sample' ? '样例包含公开文本研究与桌面截图。视觉方向供你审阅，注册、登录和控制台尚未走查。' : '依据你补充的公开来源与材料。没有记录的产品流程，应保留为未知。'}</p><div class="coverage-row"><span>来源材料</span><b>${p.sources.length} 条</b></div><div class="coverage-row"><span>已人工核对</span><b>${p.sources.filter(s=>s.verified).length} 条</b></div><p class="small muted">核对来源后再确认重要事实；企业自述仅代表其公开表达。</p></div><div class="context-sources"><div class="panel-heading"><h3>来源索引</h3><button class="icon-button" data-action="source-add" aria-label="添加来源">${icon('plus')}</button></div>${p.sources.map(s=>`<button class="source-index" data-action="source-view" data-id="${esc(s.id)}"><span>${esc(s.id)}</span><b>${esc(s.title)}</b>${icon('arrow')}</button>`).join('') || '<p class="muted">先添加一条你实际查看过的来源。</p>'}</div></aside></div>`;
}

function sourceCard(s) {
  return `<button class="source-card" data-action="source-view" data-id="${esc(s.id)}"><div><span class="source-code">${esc(s.id)}</span>${badge(s.verified ? '已核对' : '待核对',s.verified ? 'green' : '')}</div><h4>${esc(s.title)}</h4>${safeImage(s.image) ? `<img class="source-thumb" src="${esc(safeImage(s.image))}" alt="${esc(s.title)} 页面截图" loading="lazy">` : ''}<p>${esc(s.excerpt)}</p><small>${esc(new URL(s.url).hostname)} ${icon('external')}</small></button>`;
}

function renderWorkbench(p) {
  const chosen = selectedOpportunity(p);
  return `<div class="section-intro compact"><div><span class="eyebrow">03 / FIND A FOCUSED OPPORTUNITY</span><h2>把观察，变成一个值得讨论的机会。</h2><p>从产品、交互与视觉提出专业建议，用页面证据说明你的判断。</p></div><button class="button secondary" data-action="opportunity-add">${icon('plus')} 添加机会</button></div><div class="workbench"><section class="evidence-column"><div class="column-title"><h3>来源与证据 <span>${p.sources.length}</span></h3><button class="icon-button" data-action="source-add" aria-label="添加来源">${icon('plus')}</button></div><div class="source-list">${p.sources.map(sourceCard).join('') || '<div class="empty-inline">添加公开网页、文档摘录或截图，记录实际观察到的内容。</div>'}</div><button class="text-button" data-action="source-add">${icon('plus')} 补充材料</button><p class="column-note">采集失败是覆盖限制，<br>不等于产品存在缺陷。</p></section>
  <section class="opportunity-column"><div class="column-title"><h3>候选机会 <span>${p.opportunities.filter(o=>o.status!=='excluded').length}</span></h3><span class="small muted">人工判断</span></div>${p.opportunities.map((o,index)=>`<article class="opportunity-card ${p.selectedId===o.id && p.decision!=='no-pitch' ? 'selected' : ''} ${o.status==='excluded' ? 'excluded' : ''}"><div class="opportunity-top"><span class="eyebrow">OPPORTUNITY ${String(index+1).padStart(2,'0')}</span>${badge(o.status==='excluded' ? '已排除' : p.selectedId===o.id && p.decision!=='no-pitch' ? '当前切入点' : '待验证',p.selectedId===o.id && p.decision!=='no-pitch' ? 'green' : '')}</div><h3>${esc(o.title)}</h3><div class="discipline-tag">${badge(disciplines[o.discipline || 'product'])}${o.boards?.length ? `<span>${o.boards.length} 组图文建议</span>` : ''}</div><div class="finding-part"><span>观察</span><p>${esc(o.observation)}</p></div><div class="finding-part inference"><span>影响推断 · 待验证</span><p>${esc(o.inference)}</p></div>${[['designSurface','设计对象与任务'],['designChange','具体怎么改'],['deliverables','设计交付物']].filter(([key])=>o[key]).map(([key,label])=>`<div class="finding-part"><span>${label}</span><p>${esc(o[key])}</p></div>`).join('')}<div class="evidence-chips">${o.sourceIds.map(key=>`<button data-action="source-view" data-id="${esc(key)}">${icon('link')} ${esc(key)}</button>`).join('') || '<small class="warning-text">尚未关联来源</small>'}</div><details><summary>替代解释、范围与验证</summary><dl>${[['alternative','替代解释'],['preserve','保留项'],['scope','最小合作范围'],['dependencies','待确认与依赖'],['validation','验证方式'],['behavior','期望用户行为'],['business','业务关联 · 待验证'],['metric','主要结果指标'],['guardrails','成本与体验约束']].map(([key,label])=>`<dt>${label}</dt><dd>${esc(o[key])}</dd>`).join('')}</dl></details><div class="opportunity-actions"><button class="text-button" data-action="opportunity-edit" data-id="${esc(o.id)}">${icon('edit')} 编辑</button><button class="text-button" data-action="opportunity-exclude" data-id="${esc(o.id)}">${o.status==='excluded' ? '恢复候选' : '排除'}</button>${o.status!=='excluded' ? `<button class="button ${p.selectedId===o.id && p.decision!=='no-pitch' ? 'selected-button' : 'secondary'} small-button" data-action="select" data-id="${esc(o.id)}">${p.selectedId===o.id && p.decision!=='no-pitch' ? icon('check')+' 已选中' : '选为切入点'}</button>` : ''}</div></article>`).join('') || '<div class="panel empty-inline">先记录一个观察，再写出影响推断与替代解释。没有证据时，不必急着形成提案。</div>'}</section>
  <aside class="selection-column"><div class="selection-panel"><span class="eyebrow">YOUR PITCH DIRECTION</span><h3>${p.decision==='no-pitch' ? '先停在研究这里。' : chosen ? '一个聚焦的起点。' : '找到值得继续的方向。'}</h3>${p.decision==='no-pitch' ? `<p>当前决定：暂不形成提案。</p><p class="selection-summary">${esc(p.noPitchReason)}</p>` : chosen ? `<p class="selection-title">${esc(chosen.title)}</p><div class="selection-divider"></div><span class="small muted">建议先做</span><p class="selection-summary">${esc(chosen.scope)}</p><span class="small muted">支持来源</span><div class="mini-sources">${chosen.sourceIds.map(key=>`<button data-action="source-view" data-id="${esc(key)}">${esc(key)}</button>`).join('')}</div><button class="button primary full" data-action="to-editor">编辑提案 ${icon('arrow')}</button><p class="small muted">先形成可修改的草稿，复核后再交付。</p>` : '<p>选择左侧一个候选机会，或补充证据后再做判断。</p>'}<button class="text-button no-pitch" data-action="no-pitch">${p.decision==='no-pitch' ? '修改暂停原因' : '暂不建议形成 Pitch'}</button></div><div class="quiet-tip"><span>用专业判断，提出可讨论的建议。</span><p>如果替代解释更合理，可以放弃这个机会。研究本身也有价值。</p></div></aside></div>`;
}

function markdownView(text) {
  return text.split('\n').map(line => {
    if (line.startsWith('### ')) return `<h4>${esc(line.slice(4))}</h4>`;
    if (line.startsWith('## ')) return `<h3>${esc(line.slice(3))}</h3>`;
    if (line.startsWith('# ')) return `<h2>${esc(line.slice(2))}</h2>`;
    if (line === '---') return '<hr>';
    return line ? `<p>${esc(line)}</p>` : '<div class="paragraph-gap"></div>';
  }).join('');
}

function ensureDraft(p) {
  const key = draftKey(p,language);
  if (selectedOpportunity(p) && !p.drafts[key]) { p.drafts[key] = makeDraft(p,language); persist(); }
  return p.drafts[key];
}

function renderEditor(p) {
  if (!selectedOpportunity(p) || p.decision==='no-pitch') return '<section class="panel empty-editor"><h2>先确认是否适合形成提案</h2><p>选定一个有来源支持的合作机会后，即可编辑与导出。也可以保留“暂不形成 Pitch”的决定。</p><button class="button primary" data-action="step" data-step="3">返回机会工作台</button></section>';
  const draft = ensureDraft(p);
  const blockers = reviewBlockers(p,language);
  const reviewed = p.reviewedRevision === `${p.revision}:${language}` && !blockers.length;
  return `<div class="section-intro compact"><div><span class="eyebrow">04 / MAKE IT YOURS</span><h2>把你的专业判断，变成看得见的设计建议。</h2><p>HTML / PDF 包含提案正文、截图建议与来源；Markdown 另附开场信息与讲解提纲。</p></div><div class="export-buttons"><button class="button secondary" data-action="export-html">${icon('download')} 图文提案 HTML</button><button class="button secondary" data-action="export-md">${icon('download')} Markdown</button><button class="button primary" data-action="print">打印 / PDF</button></div></div><div class="editor-toolbar"><div class="tabs" role="tablist" aria-label="提案内容">${[['proposal','提案正文'],['visual','截图与建议'],['opening','开场信息'],['script','讲解提纲']].map(([key,name])=>`<button role="tab" aria-selected="${section===key}" class="${section===key ? 'active' : ''}" data-action="section" data-section="${key}">${name}</button>`).join('')}</div><div class="language-switch" aria-label="草稿语言"><button class="${language==='en' ? 'active' : ''}" data-action="language" data-language="en">EN</button><button class="${language==='zh' ? 'active' : ''}" data-action="language" data-language="zh">中文</button></div></div><div class="editor-note">${p.mode==='sample' ? '样例提供中英文初稿。' : '按你已采用的研究内容整理草稿；AI 建议需先在公司理解页审阅。'}切换语言打开独立草稿，不会自动翻译或覆盖已有编辑。讲解提纲需试讲校时。</div>
  <div id="stale-warning" class="stale-warning" ${draftStale(p,draft) ? '' : 'hidden'}><div><b>研究内容已更新</b><p>你的提案编辑已保留。请对照最新研究修订草稿，再确认一致。</p></div><button class="button secondary small-button" data-action="draft-sync">我已核对并更新草稿</button></div>
  ${section!=='visual' ? `<div class="editor-layout"><section class="editor-panel panel"><div class="panel-heading"><h3>编辑草稿</h3><button class="text-button" data-action="regenerate">重新填入研究内容</button></div><label class="sr-only" for="draft-text">${{proposal:'一页提案',opening:'开场信息',script:'讲解提纲'}[section]}草稿</label><textarea id="draft-text" class="draft-text" spellcheck="false" maxlength="30000">${esc(draft[section])}</textarea><div class="editor-foot"><span id="word-count">${draft[section].length} 字符</span><span>自动保存 · 支持 Markdown 标题</span></div></section><section class="preview-panel"><div class="preview-label"><span>阅读预览</span><span id="preview-status">${reviewed ? '已人工复核' : '研究草稿 · 待复核'}</span></div><div class="paper"><div class="paper-brand">LINA / DESIGN PARTNERSHIP <span>${esc(p.name)}</span></div><article id="draft-preview" class="prose">${markdownView(draft[section])}</article><div class="paper-footer">${p.mode==='sample' ? '研究样例 · ' : ''}A focused opportunity, open for discussion.</div></div></section></div>` : ''}
  ${['proposal','visual'].includes(section) ? visualBoards(p,language,true) : ''}<section class="review-bar"><div><h3 id="review-title">${reviewed ? '已完成本版本的人工复核' : '交付前，再确认一次'}</h3><p id="review-description">${reviewed ? '继续编辑研究或草稿，会使这次复核失效。' : blockers.length ? blockers.join(' · ') : '请核对重要事实、所有草稿与来源后，标记为已复核。'}</p></div><button class="button secondary" data-action="review" ${blockers.length || reviewed ? 'disabled' : ''}>${icon('check')} ${reviewed ? '本版本已复核' : '标记已复核'}</button></section>`;
}

function openModal(content) {
  modalReturn = document.activeElement;
  $('#modal-root').innerHTML = `<dialog class="modal"><div class="modal-top"><span class="eyebrow">AUDIT PITCH</span><button class="icon-button" data-action="modal-close" aria-label="关闭窗口">${icon('close')}</button></div>${content}</dialog>`;
  const dialog = $('dialog');
  dialog.addEventListener('close', () => { $('#modal-root').innerHTML = ''; modalReturn?.focus(); });
  dialog.showModal();
}
function closeModal() { $('dialog')?.close(); }

function sourceModal(sourceId, editing = false, screenshotMode=false) {
  const p = project();
  const s = p.sources.find(item=>item.id===sourceId);
  if (s && !editing) {
    openModal(`<div class="inline-heading"><span class="source-code">${esc(s.id)}</span>${badge(s.verified ? '已人工核对' : '待人工核对',s.verified ? 'green' : 'amber')}</div><h2>${esc(s.title)}</h2><p class="source-location">${external(s.url,'打开原始来源')}</p><dl class="source-details"><dt>来源位置</dt><dd>${esc(s.locator)}</dd><dt>观察记录</dt><dd>${esc(s.excerpt)}</dd><dt>采集时间与方式</dt><dd>${esc(s.capturedAt || '未知')} · ${esc(s.method)}</dd><dt>覆盖限制</dt><dd>${esc(s.limitation)}</dd></dl>${safeImage(s.image) ? `<a href="${esc(safeImage(s.image))}" download="${esc(s.id)}.png"><img class="evidence-image" src="${esc(safeImage(s.image))}" alt="${esc(s.title)} 的补充截图"></a>` : '<p class="callout">尚未补充截图。文本记录不能代替未观察到的交互流程。</p>'}<div class="form-actions"><button class="button secondary" data-action="source-edit" data-id="${esc(s.id)}">编辑来源</button><button class="button primary" data-action="source-verify" data-id="${esc(s.id)}">${s.verified ? '撤销核对' : '我已打开来源并核对记录'}</button></div>`);
    return;
  }
  openModal(`<h2>${screenshotMode?'上传或替换页面截图':s ? '编辑来源' : '补充一条来源'}</h2><p class="muted">记录你实际查看的内容，以及它还不能证明什么。</p><form id="source-form" data-id="${esc(s?.id || '')}">${labelInput('来源标题','title',s?.title || (screenshotMode?new URL(p.url).hostname+' · 页面截图':''),{required:true})}${labelInput('来源网址','url',s?.url || p.url,{required:true})}${labelInput('原文位置 / 截图位置','locator',s?.locator || (screenshotMode?'用户提供的页面截图':''),{required:!screenshotMode,placeholder:'例如：首页首屏、价格比较区域'})}${labelInput('观察记录 / 摘录','excerpt',s?.excerpt || (screenshotMode?'用户提供页面截图，具体内容以图片为准。':''),{area:true,required:!screenshotMode})}${labelInput('覆盖限制','limitation',s?.limitation || '',{area:true,placeholder:'哪些还没验证？是否来自企业自述？'})}<div class="two-fields">${labelInput('采集日期（未知可留空）','capturedAt',s?.capturedAt?.slice(0,10) || '',{type:'date'})}${labelInput('采集方式','method',s?.method || '手动公开页面走查')}</div><label class="field"><span>补充截图（PNG / JPEG / WebP，最大 1 MB）</span><input type="file" name="image" accept="image/png,image/jpeg,image/webp" ${screenshotMode&&!s?.image?'required':''}></label>${s?.image ? '<label class="checkbox-label"><input type="checkbox" name="removeImage"> 移除已有截图</label>' : ''}<p class="small muted">截图随项目保存在此浏览器，可随完整备份迁移。修改来源会撤销该来源的核对状态。</p><div class="form-actions"><button class="button primary" type="submit">保存来源</button></div></form>`);
}

function opportunityModal(opportunityId) {
  const p = project();
  const o = p.opportunities.find(item=>item.id===opportunityId);
  openModal(`<h2>${o ? '编辑合作机会' : '记录一个候选机会'}</h2><p class="muted">把观察与推断分开，为不同解释留出空间。</p><form id="opportunity-form" data-id="${esc(o?.id || '')}"><label class="field"><span>建议方向</span><select name="discipline">${Object.entries(disciplines).map(([key,label])=>`<option value="${key}" ${(o?.discipline||'product')===key?'selected':''}>${label}</option>`).join('')}</select></label>${labelInput('机会标题','title',o?.title || '',{required:true})}${[['observation','观察 · 实际看到了什么'],['inference','影响推断 · 可能意味着什么'],['alternative','替代解释'],['preserve','值得保留的部分'],['designSurface','设计对象 · 哪个页面、用户与任务'],['designChange','具体设计改动 · 从什么改为什么'],['deliverables','设计交付物 · 范围与边界'],['scope','最小合作范围'],['dependencies','待确认的问题与依赖'],['validation','验证方式'],['behavior','期望用户行为'],['business','业务关联 · 待验证'],['metric','主要结果指标'],['guardrails','成本与体验约束']].map(([key,label])=>labelInput(label,key,o?.[key] || '',{area:true,required:!['preserve','behavior','business','metric','guardrails','designSurface','designChange','deliverables'].includes(key)})).join('')}<fieldset><legend>关联支持来源</legend>${p.sources.map(s=>`<label class="checkbox-label"><input type="checkbox" name="sourceIds" value="${esc(s.id)}" ${o?.sourceIds.includes(s.id) ? 'checked' : ''}> <span>${esc(s.id)} · ${esc(s.title)}</span></label>`).join('') || '<p class="small muted">尚无来源。可先保存观察，再补充证据；无来源的机会无法标记为已复核。</p>'}</fieldset><p class="small muted">修改机会不会覆盖已编辑的提案；请随后核对草稿是否仍与研究一致。</p><div class="form-actions"><button class="button primary" type="submit">保存机会</button></div></form>`);
}

async function uploadImage(file) {
  if(file.size>1024*1024 || !['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('请选择不超过 1 MB 的 PNG、JPEG 或 WebP 图片。');
  const image=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('图片读取失败，请重试。'));reader.readAsDataURL(file);});
  if(!safeImage(image))throw new Error('图片格式无法读取。');
  const probe=new Image();probe.src=image;try{await probe.decode();}catch{throw new Error('图片文件已损坏，请换一张图片。');}
  return image;
}
async function readImage(path) {
  const response=await fetch(path);if(!response.ok)throw new Error('截图读取失败，请稍后重试导出。');
  const blob=await response.blob();return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('图片读取失败'));reader.readAsDataURL(blob);});
}
function boardModal(boardId) {
  const p=project(),o=selectedOpportunity(p),b=o.boards?.find(x=>x.id===boardId),c=b?.copy?.[language] || {};
  openModal(`<h2>${b?'编辑图文建议':'添加一条图文建议'}</h2><p class="muted">用原页面支持你的判断，用方案图说明具体建议。当前编辑：${language==='en'?'English':'中文'}。</p><form id="board-form" data-id="${esc(b?.id||'')}" data-language="${language}"><div class="two-fields"><label class="field"><span>对应的页面证据</span><select name="sourceId" required><option value="">选择来源</option>${p.sources.map(s=>`<option value="${esc(s.id)}" ${b?.sourceId===s.id?'selected':''}>${esc(s.id)} · ${esc(s.title)}${s.image?'':'（缺少截图）'}</option>`).join('')}</select><small>来源截图可在机会工作台补充；保存时自动关联该来源。</small></label><label class="field"><span>视觉观察维度</span><select name="dimension">${Object.entries(dimensions).map(([key,label])=>`<option value="${key}" ${b?.dimension===key?'selected':''}>${label}</option>`).join('')}</select></label></div>${labelInput('建议标题','title',c.title||'',{required:true})}${[['finding','页面观察 · 具体看到了什么'],['rationale','设计判断 · 为什么值得调整'],['recommendation','设计建议 · 具体怎么改']].map(([key,label])=>labelInput(label,key,c[key]||'',{area:true,required:true})).join('')}<label class="field"><span>方案图（PNG / JPEG / WebP，最大 1 MB）</span><input type="file" name="proposalImage" accept="image/png,image/jpeg,image/webp"><small>可使用你制作的设计稿或标注截图。对外始终标为“概念示意 · 未上线”。图片在两种语言间共用。</small></label>${safeImage(b?.proposalImage)?`<img class="evidence-image" src="${esc(safeImage(b.proposalImage))}" alt="已有方案图"><label class="checkbox-label"><input type="checkbox" name="removeImage"> 移除已有方案图</label>`:''}${labelInput('方案图说明与边界','caption',c.caption||'',{area:true,placeholder:'说明方案覆盖的区域，以及仍需确认的文案、能力或假设。'})}<p class="small muted">中英文文字分别编辑；修改图片或来源后，请同步核对另一种语言。</p><div class="form-actions">${b?`<button type="button" class="text-button" data-action="board-remove" data-id="${esc(b.id)}">移除这条建议</button>`:''}<button class="button primary" type="submit">保存图文建议</button></div></form>`);
}

function download(text, filename, mime = 'text/plain;charset=utf-8') {
  const objectUrl = URL.createObjectURL(new Blob([text],{type:mime}));
  const link = document.createElement('a'); link.href = objectUrl; link.download = filename; link.click();
  setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);
}
function backup(one = false) {
  const p = project();
  const data = one && p ? {schema:1,projects:[p],activeId:p.id} : workspace;
  download(JSON.stringify(data,null,2),`audit-pitch-${one ? 'project' : 'backup'}-${now().slice(0,10)}.json`,'application/json');
}

function renderReviewState() {
  const p=project();
  if (!$('#review-title')) return;
  const blockers=reviewBlockers(p,language);
  $('#review-title').textContent='交付前，再确认一次';
  $('#preview-status').textContent='研究草稿 · 待复核';
  $('#review-description').textContent=blockers.length ? blockers.join(' · ') : '请核对重要事实、所有草稿与来源后，标记为已复核。';
  const button=$('[data-action="review"]');
  button.disabled=!!blockers.length;
  button.innerHTML=icon('check')+' 标记已复核';
}

document.addEventListener('input', event => {
  if (event.target.closest('#company-form') && event.target.name) {
    editProject(p => { p.company[event.target.name] = event.target.value; });
    return;
  }
  if (event.target.id !== 'draft-text') return;
  const p=project();
  const text=event.target.value;
  editProject(item=>{
    const draft=item.drafts[draftKey(item,language)];
    draft[section]=text; draft.updatedAt=now();
    item.revision+=1; item.updatedAt=now(); item.reviewedRevision=null;
  },false);
  $('#draft-preview').innerHTML=markdownView(text);
  $('#word-count').textContent=`${text.length} 字符`;
  renderReviewState();
});

document.addEventListener('click', async event => {
  const button=event.target.closest('[data-action]');
  if (!button) return;
  const {action,id:targetId}=button.dataset;
  const p=project();
  if (conflicting && !['backup','backup-project','raw-backup','reload','modal-close'].includes(action)) { notify('请先备份或重新载入最新版本。'); return; }
  switch(action) {
    case 'select-design-page':{const ids=p.designSourceIds||p.sources.filter(s=>s.image).slice(-3).map(s=>s.id);if(!ids.includes(targetId)&&ids.length>=3){notify('每次最多分析 3 个页面，请先取消选择一页。');break;}editProject(p=>{p.designSourceIds=ids.includes(targetId)?ids.filter(id=>id!==targetId):[...ids,targetId];},false);render();break;}
    case 'capture-mode':editProject(p=>{p.captureMode=button.dataset.mode;},false);render();break;
    case 'page-upload':sourceModal(targetId||undefined,!!targetId,true);break;
    case 'collect': await runResearch('collect');break;
    case 'analyze-company':await runResearch('analyze','company');break;
    case 'analyze': await runResearch('analyze');break;
    case 'export-analysis-history': download(JSON.stringify({schema:1,projectId:p.id,url:p.url,exportedAt:now(),analysisHistory:p.analysisHistory||[],pendingAnalysis:p.pendingAnalysis||null},null,2),'audit-pitch-analysis-history.json','application/json');break;
    case 'clear-analysis-history':
      if(researchJobs.has(p.id))break;
      if(!confirm('请先确认分析记录或完整项目备份已下载并保存，再清空记录。已采用的机会、人工修改和提案会保留。此操作不能撤销。'))break;
      p.analysisHistory=[];delete p.pendingAnalysis;persist();render();notify('分析记录已清空，已采用的机会和提案保留。');break;
    case 'refresh-service': await refreshService();break;
    case 'cancel-research': researchJobs.get(p?.id)?.controller.abort();break;
    case 'adopt-analysis': try{const count=adoptAnalysis(p);touch(p);persist();render();$('#company-form')?.scrollIntoView({behavior:'smooth',block:'start'});notify(`已填入空白公司字段，并加入 ${count} 条候选建议。请核对下方公司理解，再确认继续。`);}catch(error){notify(error.message);}break;
    case 'home': home=true; render(); break;
    case 'new': home=true; render(); $('#target-url').focus(); break;
    case 'sample': {
      let sample=workspace.projects.find(item=>item.mode==='sample' && item.sampleVersion===3);
      if (!sample) { if(workspace.projects.length>=100){notify('当前版本最多保存 100 个项目。');break;} sample=linkModelSample(); workspace.projects.push(sample); }
      workspace.activeId=sample.id; home=false; persist(); render(); break;
    }
    case 'open': workspace.activeId=targetId; home=false; persist(); render(); break;
    case 'step': editProject(item=>{item.step=Number(button.dataset.step);},false); render(); break;
    case 'source-add': sourceModal(); break;
    case 'source-view': sourceModal(targetId); break;
    case 'source-edit': sourceModal(targetId,true); break;
    case 'source-verify': editProject(item=>{const source=item.sources.find(s=>s.id===targetId);source.verified=!source.verified;});closeModal();render();notify('来源核对状态已更新，请重新确认公司理解。');break;
    case 'opportunity-add': opportunityModal();break;
    case 'opportunity-edit': opportunityModal(targetId);break;
    case 'opportunity-exclude': editProject(item=>{const o=item.opportunities.find(o=>o.id===targetId);o.status=o.status==='excluded'?'candidate':'excluded';if(item.selectedId===o.id && o.status==='excluded')item.selectedId=null;});render();break;
    case 'select': if(p.selectedId!==targetId || p.decision!=='pitch')editProject(item=>{item.selectedId=targetId;item.decision='pitch';});render();break;
    case 'no-pitch': openModal(`<h2>暂不形成 Pitch</h2><p class="muted">没有充分机会时，保留研究与待确认的问题。</p><form id="no-pitch-form">${labelInput('原因与下一步待补资料','reason',p.noPitchReason,{area:true,required:true,placeholder:'例如：需要先看到真实首次使用流程，才能判断是否存在体验缺口。'})}<div class="form-actions"><button class="button primary" type="submit">保存判断</button></div></form>`);break;
    case 'to-editor': editProject(item=>{item.step=4;},false);render();break;
    case 'section': section=button.dataset.section;render();break;
    case 'language': language=button.dataset.language;render();break;
    case 'draft-sync': editProject(item=>{item.drafts[draftKey(item,language)].basis=researchFingerprint(item);item.reviewedRevision=null;},false);render();notify('已记录你对草稿与研究一致性的确认。');break;
    case 'regenerate': openModal('<h2>重新填入研究内容？</h2><p>这会替换当前语言的三份草稿。当前编辑会先下载为 JSON 备份，其他语言与机会的草稿不受影响。</p><div class="form-actions"><button class="button secondary" data-action="modal-close">保留当前编辑</button><button class="button primary" data-action="regenerate-confirm">备份并重新填入</button></div>');break;
    case 'regenerate-confirm': backup(true);editProject(item=>{item.drafts[draftKey(item,language)]=makeDraft(item,language);});closeModal();render();break;
    case 'review': if(!reviewBlockers(p,language).length){editProject(item=>{item.reviewedRevision=`${item.revision}:${language}`;},false);render();notify('当前语言的三份草稿已标记为人工复核。');}break;
    case 'export-md': try{const p=JSON.parse(JSON.stringify(project()));const lang=language;const portable=await portableProject(p,readImage);const markdown=exportMarkdown(p,lang);let result=markdown;for(const source of p.sources){const target=portable.sources.find(x=>x.id===source.id);if(source.image && target?.image && source.image!==target.image)result=result.split(`](${source.image})`).join(`](${target.image})`);}for(const b of selectedOpportunity(p).boards||[]){const target=selectedOpportunity(portable).boards.find(x=>x.id===b.id);if(b.proposalImage && target?.proposalImage)result=result.split(`](${b.proposalImage})`).join(`](${target.proposalImage})`);}download(result,`${p.name.replace(/[^\p{L}\p{N}-]/gu,'-')}-pitch-${lang}.md`,'text/markdown;charset=utf-8');notify('已导出当前编辑内容与关联来源。');}catch(error){notify(error.message);}break;
    case 'export-html': try{const snapshot=JSON.parse(JSON.stringify(p));const lang=language;button.disabled=true;const portable=await portableProject(snapshot,readImage);download(reportHtml(snapshot,lang,portable),`${snapshot.name.replace(/[^\p{L}\p{N}-]/gu,'-')}-design-proposal-${lang}.html`,'text/html;charset=utf-8');notify('已导出完整图文提案，图片已内嵌，可离线打开。');}catch(error){notify(error.message);}finally{button.disabled=false;}break;
    case 'print': try{const snapshot=JSON.parse(JSON.stringify(p));const lang=language;button.disabled=true;const portable=await portableProject(snapshot,readImage);$('#print-output').innerHTML=reportBody(snapshot,lang,portable);await Promise.all([...$('#print-output').querySelectorAll('img')].map(img=>img.decode()));window.print();}catch(error){notify(error.message);}finally{button.disabled=false;}break;
    case 'board-add': boardModal();break;
    case 'board-edit': boardModal(targetId);break;
    case 'board-remove': editProject(item=>{const o=selectedOpportunity(item);o.boards=o.boards.filter(b=>b.id!==targetId);});closeModal();render();notify('已移除这条图文建议，来源截图仍保留。');break;
    case 'backup': backup();break;
    case 'backup-project': backup(true);break;
    case 'raw-backup': try{download(localStorage.getItem(STORAGE_KEY)||'{}','audit-pitch-stored-data.json','application/json');}catch{notify('浏览器拒绝访问已存数据，请下载当前备份。');}break;
    case 'retry-save': storageError='';if(persist()){showStorageWarning();notify('已保存当前数据。');}break;
    case 'reload': location.reload();break;
    case 'import': $('#import-file').click();break;
    case 'modal-close': closeModal();break;
  }
});

document.addEventListener('submit', async event => {
  const form=event.target;
  if (!['new-project-form','target-form','company-form','source-form','opportunity-form','board-form','no-pitch-form','page-plan-form'].includes(form.id))return;
  event.preventDefault();
  if(form.id==='new-project-form'&&!await requireBetaAccess())return;
  if(conflicting){notify('请先重新载入最新版本。');return;}
  const data=new FormData(form);
  const value=name=>String(data.get(name)||'').trim();
  try{
    if(form.id==='page-plan-form'){
      const p=project();
      const pageUrls=[value('page1'),value('page2'),value('page3')].filter(Boolean).map(safeUrl);
      if(pageUrls.some(url=>!url))throw new Error('请输入有效的公开页面网址。');
      editProject(p=>{p.pageUrls=[...new Set(pageUrls)];});render();await runResearch('collect');if(project()?.id===p.id&&serviceStatus?.aiConfigured)await runResearch('analyze');
    }else if(form.id==='new-project-form'){
      if(workspace.projects.length >= 100) throw new Error('当前版本最多保存 100 个项目。');
      const p=createProject(value('url'));workspace.projects.push(p);workspace.activeId=p.id;home=false;persist();render();await runResearch('collect');
      if(project()?.id===p.id&&!home&&p.sources.length&&!p.pendingAnalysis&&!p.researchError){await refreshService();if(project()?.id===p.id&&!home&&serviceStatus?.aiConfigured)await runResearch('analyze','company');}
    }else if(form.id==='target-form'){
      const url=safeUrl(value('url'));
      if(!url)throw new Error('请输入有效的网址。');
      if(new URL(url).hostname.replace(/^www\./,'')!==new URL(project().url).hostname.replace(/^www\./,''))throw new Error('更换目标公司请新建研究，以免沿用另一家公司的证据。');
      editProject(p=>{p.name=value('name');p.url=url;p.focus=value('focus');p.step=2;});render();
    }else if(form.id==='company-form'){
      const continuing=event.submitter?.value==='continue';
      editProject(p=>{for(const key of Object.keys(p.company))p.company[key]=value(key);});
      if(continuing)editProject(p=>{p.companyReviewed=true;p.step=3;},false);
      render();notify(continuing?'已确认公司理解。':'公司理解已保存。');
    }else if(form.id==='source-form'){
      const url=safeUrl(value('url'));
      if(!url)throw new Error('来源网址需要使用 http 或 https。');
      const previous=project().sources.find(s=>s.id===form.dataset.id);
      const source={id:previous?.id || `E${Math.max(0,...project().sources.map(s=>Number(s.id.replace(/^E/,''))||0))+1}`,title:value('title'),url,locator:value('locator'),excerpt:value('excerpt'),limitation:value('limitation'),capturedAt:value('capturedAt'),method:value('method'),verified:false};
      if(previous?.image && !data.get('removeImage'))source.image=previous.image;
      const file=data.get('image');
      if(file?.size){
        source.image=await uploadImage(file);
      }
      editProject(p=>{if(previous)p.sources[p.sources.indexOf(previous)]=source;else p.sources.push(source);if(source.image&&p.designSourceIds&&!p.designSourceIds.includes(source.id)&&p.designSourceIds.length<3)p.designSourceIds.push(source.id);});closeModal();render();notify('来源已保存，核对后可标记为已确认。');
    }else if(form.id==='opportunity-form'){
      const previous=project().opportunities.find(o=>o.id===form.dataset.id);
      const o={id:previous?.id||id(),status:previous?.status||'candidate',discipline:value('discipline'),sourceIds:data.getAll('sourceIds').map(String),boards:previous?.boards || []};
      if(o.boards.some(b=>!o.sourceIds.includes(b.sourceId))) throw new Error('该来源仍用于图文建议。请先在图文建议中更换或移除关联，再取消来源。');
      for(const key of insightFields)o[key]=value(key);
      // Edited research must not silently reuse the sample's older English copy.
      editProject(p=>{if(previous)p.opportunities[p.opportunities.indexOf(previous)]=o;else p.opportunities.push(o);});closeModal();render();notify('机会已保存；已有提案编辑已保留。');
    }else if(form.id==='board-form'){
      const opportunity=selectedOpportunity(project());
      const previous=opportunity.boards?.find(b=>b.id===form.dataset.id);
      if(!previous && (opportunity.boards?.length||0)>=20)throw new Error('一个合作机会最多包含 20 组图文建议。');
      const source=project().sources.find(s=>s.id===value('sourceId'));
      if(!source)throw new Error('请先添加并选择一条真实来源。');
      const board=previous?JSON.parse(JSON.stringify(previous)):{id:id(),copy:{}};
      board.sourceId=source.id;board.dimension=value('dimension');
      const copy={};for(const key of ['title','finding','rationale','recommendation','caption'])copy[key]=value(key);
      // Shared image changes affect both languages. Keep translations visible for manual reconciliation.
      board.copy[form.dataset.language]=copy;
      if(data.get('removeImage'))delete board.proposalImage;
      const file=data.get('proposalImage');if(file?.size)board.proposalImage=await uploadImage(file);
      editProject(p=>{const o=selectedOpportunity(p);o.boards||=[];if(previous)o.boards[o.boards.findIndex(b=>b.id===previous.id)]=board;else o.boards.push(board);if(!o.sourceIds.includes(source.id))o.sourceIds.push(source.id);});
      closeModal();render();notify('图文建议已保存，请核对它与当前文字提案是否一致。');
    }else if(form.id==='no-pitch-form'){
      editProject(p=>{p.decision='no-pitch';p.noPitchReason=value('reason');});closeModal();render();
    }
  }catch(error){notify(error.message);}
});

document.addEventListener('change',async event=>{
  if(event.target.id!=='import-file')return;
  const file=event.target.files[0];if(!file)return;
  try{
    if(file.size>12*1024*1024)throw new Error('备份文件过大，请使用不超过 12 MB 的完整备份。');
    const imported=validateWorkspace(JSON.parse(await file.text()));
    if(!imported.projects.length)throw new Error('这份备份没有项目。');
    if(workspace.projects.length+imported.projects.length>100)throw new Error('当前版本最多保存 100 个项目。');
    // Import as new project records; never replace a locally edited project with an older backup.
    for(const p of imported.projects){p.id=id();p.name=`${p.name.slice(0,180)}（导入）`;workspace.projects.push(p);workspace.activeId=p.id;}
    storageError='';home=false;persist();render();notify(`已导入 ${imported.projects.length} 个项目，原有项目已保留。`);
  }catch(error){notify(error instanceof SyntaxError?'无法读取 JSON 备份，请检查文件。':error.message);}
  event.target.value='';
});

window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY){conflicting=true;showStorageWarning();$('dialog')?.close();document.querySelectorAll('input,textarea').forEach(el=>el.disabled=true);}});
window.addEventListener('beforeunload',event=>{if(storageError){event.preventDefault();event.returnValue='';}});
render();
if(initialDraftFilled)persist();
refreshService();
