import { selectedOpportunity, draftKey, draftStale, reviewBlockers } from './model.js';
import { safeImage, escapeHtml as e, visualBoards, markdownView, reportStyles, sourceCopy } from './visual.js';

// Embed packaged images so the downloaded document works without this Site or a network connection.
export async function portableProject(project, readImage) {
  const copy = JSON.parse(JSON.stringify(project));
  const opportunity = selectedOpportunity(copy);
  if (!opportunity || copy.decision === 'no-pitch') throw new Error('请先选择可导出的提案。');
  const cache = new Map();
  const embed = async value => {
    if (!safeImage(value)) return '';
    if (value.startsWith('data:')) return value;
    if (!cache.has(value)) cache.set(value, readImage(value));
    const result = await cache.get(value);
    if (!safeImage(result) || !result.startsWith('data:')) throw new Error('截图读取失败，请重试导出。');
    return result;
  };
  for (const source of copy.sources.filter(s=>opportunity.sourceIds.includes(s.id))) {
    if (source.image) source.image = await embed(source.image);
  }
  for (const board of opportunity.boards || []) if (board.proposalImage) board.proposalImage = await embed(board.proposalImage);
  return copy;
}

// Review state is evaluated on the original records, before portable image substitution.
export function reportBody(project, language = 'en', portable = project) {
  const opportunity = selectedOpportunity(project), draft = project.drafts[draftKey(project,language)];
  if (!opportunity || !draft || project.decision === 'no-pitch') throw new Error('请先完成并选择可导出的提案。');
  const zh = language === 'zh';
  const reviewed = project.reviewedRevision === `${project.revision}:${language}` && !reviewBlockers(project,language).length;
  return `<div class="report"><header class="report-brand"><b>LINA / DESIGN REVIEW & PROPOSAL</b><span>${e(project.name)} · ${e(project.url)}</span></header><p class="report-status">${reviewed ? (zh?'已人工复核':'Human-reviewed') : (zh?'研究草稿 · 待复核':'Research draft · not reviewed')}${project.mode==='sample' ? (zh?' · 研究样例':' · research sample') : ''}</p>${draftStale(project,draft) ? `<p class="report-stale">${zh?'研究已更新，文字草稿与图文建议仍需核对一致。':'Research has changed. Reconcile the written draft and visual recommendations before sharing.'}</p>` : ''}<article class="prose">${markdownView(draft.proposal)}</article>${visualBoards(portable,language)}
  <section class="report-appendix"><h2>${zh?'来源与范围':'Sources & coverage'}</h2><ul class="report-sources">${project.sources.filter(s=>opportunity.sourceIds.includes(s.id)).map(s=>sourceCopy(s,language)).map(s=>`<li><a href="${e(s.url)}" target="_blank" rel="noopener noreferrer">${e(s.title)}</a><small>${e(s.locator)} · ${e(s.capturedAt)} · ${s.verified?(zh?'已核对':'Checked'):(zh?'待核对':'Not checked')}</small><small>${e(s.limitation)}</small></li>`).join('')}</ul></section><p class="report-footer">${zh?'方案图用于说明设计方向，尚未上线；预期效果需结合用户与业务目标验证。':'Concepts illustrate design directions and are not implemented. Expected outcomes require validation with users and business priorities.'}</p></div>`;
}

export function reportHtml(project, language = 'en', portable = project) {
  return `<!doctype html><html lang="${language==='zh'?'zh-CN':'en'}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${e(project.name)} · Design proposal</title><style>${reportStyles}</style></head><body>${reportBody(project,language,portable)}</body></html>`;
}
