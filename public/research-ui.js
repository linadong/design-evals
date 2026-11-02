import {analysisBasis} from './research.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function researchPanel(project,status,job) {
  const pending=project.pendingAnalysis, collection=project.collection;
  const stale=pending&&pending.basis!==analysisBasis(project);
  const busy=!!job;
  const selectedIds=project.designSourceIds||project.sources.filter(s=>s.image).slice(-3).map(s=>s.id);
  const hasScreenshots=project.sources.some(s=>s.image&&selectedIds.includes(s.id));
  return `<div class="research-panel panel"><div class="research-heading"><div><span class="eyebrow">RESEARCH ASSISTANT</span><h3>先收集证据，再形成专业建议</h3></div><span class="badge ${status?.aiConfigured?'green':'amber'}">${status===null?'正在检查服务':status?.needsCode?'口令内测':status?.error?'服务连接失败':status?.aiConfigured?'AI 已配置':'AI 尚未连接'}</span></div>
  <p class="muted">采集最多 3 个公开页面${status?.screenshots?'和最多 3 张桌面页面截图':'的正文；自动截图服务未连接，可上传截图'}。分析会将最近 8 条来源的摘录与最多 3 张截图发送给模型服务，内部备注与提案草稿不会发送。</p>
  ${status?.error?`<p class="warning-text" role="alert">${esc(status.error)}</p>`:''}<div class="research-actions"><button class="button secondary" data-action="collect" ${busy||status?.collection===false?'disabled':''}>${collection?'重新采集公开页面':'采集公开页面'}</button><button class="button secondary" data-action="analyze-company" ${busy||!project.sources.length||!status?.aiConfigured?'disabled':''}>整理公司理解初稿</button><button class="button primary" data-action="analyze" ${busy||!hasScreenshots||!status?.aiConfigured?'disabled':''}>分析选中页面，生成设计方案</button><button class="text-button" data-action="refresh-service" ${busy?'disabled':''}>检查连接</button>${busy?'<button class="text-button" data-action="cancel-research">取消等待</button>':''}</div>
  <div class="research-status" role="status" aria-live="polite">${busy?esc(job.kind==='collect'?'正在采集公开页面，已有内容会保留…':job.mode==='company'?'正在整理公司理解初稿…':'正在分析选中的截图，生成设计方案…'):esc(project.researchError||'公司理解会先填入空白字段作为待核对草稿；设计建议经你采用后加入机会工作台。')}</div>
  ${collection?`<details class="collection-log"><summary>最近采集：${collection.sourceIds.length} 条来源 · ${new Date(collection.completedAt).toLocaleString('zh-CN')}</summary><p>${esc(collection.coverage)}</p>${collection.failures.map(f=>`<p class="warning-text">${esc(f.url)} — ${esc(f.message)}</p>`).join('')}</details>`:''}
  ${pending?`<div class="pending-analysis"><div class="research-heading"><h3>${pending.mode==='company'?'公司理解初稿已整理':pending.adopted?'已采用的 AI 建议':'待你审阅的设计方案'}</h3><span class="small muted">${esc(pending.model)} · ${new Date(pending.createdAt).toLocaleDateString('zh-CN')}</span></div>${analysisMeta(pending)}<p>${esc(pending.result.summary)}</p>
  <details><summary>建议的公司理解</summary><dl>${[['audience','服务对象'],['value','产品价值'],['goal','公司目标（待验证）'],['journey','观察路径'],['notes','范围限制']].map(([key,label])=>`<dt>${label}</dt><dd>${esc(pending.result.company[key])}</dd>`).join('')}</dl></details>
  <div class="ai-candidates">${pending.result.opportunities.map(o=>`<article><span class="eyebrow">${esc({product:'产品策略',interaction:'交互体验',visual:'视觉设计'}[o.discipline])} · ${esc(o.sourceIds.join(', '))}</span><h4>${esc(o.title)}</h4><p><b>观察</b> ${esc(o.observation)}</p><p><b>判断</b> ${esc(o.inference)}</p>${designDetail(o)}<details><summary>范围、转化与验证</summary><dl>${[['scope','建议范围'],['alternative','替代解释'],['preserve','保留项'],['dependencies','待确认'],['behavior','期望用户行为'],['business','业务关联 · 假设'],['metric','主要指标'],['guardrails','成本与体验约束'],['validation','验证方式']].map(([key,label])=>`<dt>${label}</dt><dd>${esc(o[key])}</dd>`).join('')}</dl></details></article>`).join('')||(pending.mode==='company'?'<p>此步骤只整理公司背景。选择截图后，点击“分析选中页面，生成设计方案”。</p>':'<p>现有证据不足以提出设计方案。可补充截图或保留不形成提案的判断。</p>')}</div>
  ${!pending.adopted&&pending.result.opportunities.length?`<p class="small muted">分析已完成：空白公司字段已整理为待核对草稿；已有内容保留。下一步：核对下方公司理解，再采用你认可的设计建议，继续寻找合作机会。</p>${stale?'<p class="warning-text">来源或公司理解已变化，请重新分析后再采用。</p>':''}<button class="button secondary" data-action="adopt-analysis" ${busy||stale?'disabled':''}>采用设计建议，加入候选机会</button>`:''}</div>`:''}${historyPanel(project,busy)}</div>`;
}

function analysisMeta(entry) {
  const number=value=>Number.isSafeInteger(value)&&value>=0?value.toLocaleString('zh-CN'):'未返回';
  return `<p class="small muted">${esc(entry.provider||'服务商未记录')} · ${esc(entry.model)} · ${esc(entry.createdAt)}<br>耗时：${Number.isSafeInteger(entry.elapsedMs)?(entry.elapsedMs/1000).toFixed(1)+' 秒':'未记录'} · 输入 ${number(entry.usage?.inputTokens)} / 输出 ${number(entry.usage?.outputTokens)} / 总计 ${number(entry.usage?.totalTokens)} tokens</p>`;
}
function historyPanel(project,busy) {
  const history=project.analysisHistory||[];
  if(!history.length)return '';
  return `<details class="collection-log"><summary>分析记录 · ${history.length} / 20 条</summary><p class="small muted">保存在此浏览器，随完整项目备份恢复。记录只供查阅，不替换当前研究。未包含失败或已取消请求的用量，实际费用以服务商账单为准。来源可能已变化，请核对编号。</p><div class="research-actions"><button class="button secondary" data-action="export-analysis-history">导出分析记录</button><button class="text-button" data-action="clear-analysis-history" ${busy?'disabled':''}>清空已备份记录</button></div>${history.slice().reverse().map(entry=>`<details><summary>${esc(entry.result.summary.slice(0,65))} · ${entry.adopted?'已采用':'未采用'}</summary>${analysisMeta(entry)}<p>${esc(entry.result.summary)}</p>${entry.result.opportunities.map(o=>`<article><h4>${esc(o.title)}</h4><p>来源：${esc(o.sourceIds.join(', '))}</p><dl>${[['observation','观察'],['inference','判断'],['designSurface','设计对象'],['designChange','具体改动'],['deliverables','设计交付物'],['scope','范围'],['validation','验证']].map(([key,label])=>`<dt>${label}</dt><dd>${esc(o[key])}</dd>`).join('')}</dl></article>`).join('')||'<p>本次未提出机会。</p>'}</details>`).join('')}</details>`;
}

function designDetail(o) {
  const fields=[['designSurface','设计对象与任务'],['designChange','具体怎么改'],['deliverables','设计交付物']];
  return fields.filter(([key])=>o[key]).map(([key,label])=>`<div class="finding-part"><b>${label}</b><p>${esc(o[key])}</p></div>`).join('')||'<p class="small muted">旧版建议尚未拆解具体设计改动与交付物，可重新分析或手动补充；不会自动改写旧提案。</p>';
}
