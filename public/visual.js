export const dimensions = {
  hierarchy: '视觉层级', typography: '字体与可读性', color: '色彩与对比',
  layout: '布局与留白', consistency: '组件一致性', imagery: '图像与品牌表达',
};
export const disciplines = { product: '产品策略', interaction: '交互体验', visual: '视觉设计' };
export const sampleAssets = [
  './assets/linkmodel-home-before.webp', './assets/linkmodel-models-before.webp',
  './assets/linkmodel-home-proposal.webp', './assets/linkmodel-models-proposal.webp',
];
export const safeImage = value => typeof value === 'string' && (sampleAssets.includes(value) || (value.length <= 1800000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value))) ? value : '';
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const e = escapeHtml;

export const sourceCopy = (source, language) => ({...source, ...source?.copy?.[language]});

export function boardCopy(board, language) {
  return board.copy?.[language] || board.copy?.zh || { title: '', finding: '', rationale: '', recommendation: '', caption: '' };
}

export function markdownView(text) {
  return text.split('\n').map(line => {
    if (line.startsWith('### ')) return `<h4>${e(line.slice(4))}</h4>`;
    if (line.startsWith('## ')) return `<h3>${e(line.slice(3))}</h3>`;
    if (line.startsWith('# ')) return `<h2>${e(line.slice(2))}</h2>`;
    if (line === '---') return '<hr>';
    return line ? `<p>${e(line)}</p>` : '<div class="paragraph-gap"></div>';
  }).join('');
}

export function visualBoards(project, language = 'en', editable = false) {
  const o = project.opportunities.find(x => x.id === project.selectedId && x.status !== 'excluded');
  const zh = language === 'zh';
  const boards = o?.boards || [];
  if (!boards.length && !editable) return '';
  return `<section class="visual-section"><div class="visual-heading"><div><span class="eyebrow">DESIGN REVIEW / ${String(boards.length).padStart(2,'0')} STUDIES</span><h2>${zh ? '从页面证据，到设计建议' : 'From page evidence to design recommendations'}</h2><p>${zh ? '原页面、专业判断与方案示意，放在一起讨论。' : 'Original screens, design reasoning and proposed directions, side by side.'}</p></div>${editable ? '<button class="button secondary" data-action="board-add">＋ 添加图文建议</button>' : ''}</div>
  ${boards.length ? boards.map((board,index) => {
    const c = boardCopy(board,language), source = sourceCopy(project.sources.find(s=>s.id===board.sourceId),language);
    const dimensionEn = {hierarchy:'Visual hierarchy',typography:'Typography',color:'Color & contrast',layout:'Layout & spacing',consistency:'Component consistency',imagery:'Imagery & brand'};
    return `<article class="visual-study"><header class="study-header"><div><span class="study-number">${String(index+1).padStart(2,'0')}</span><span class="badge">${e(zh ? dimensions[board.dimension] : dimensionEn[board.dimension])}</span>${!board.copy?.[language] ? `<span class="badge amber">${zh?'当前内容尚未翻译':'Original language · translation needed'}</span>` : ''}<h3>${e(c.title)}</h3></div>${editable ? `<button class="text-button" data-action="board-edit" data-id="${e(board.id)}">编辑图文</button>` : ''}</header>
    <div class="comparison-grid"><figure><figcaption><b>${zh?'现有页面':'CURRENT PAGE'}</b><span>${e(source?.capturedAt || '')}</span></figcaption>${safeImage(source?.image) ? `<a class="screen-link" href="${e(safeImage(source.image))}" download title="${zh?'下载原尺寸图片':'Download full-size image'}"><img src="${e(safeImage(source.image))}" alt="${e(source.title)}" loading="eager"></a>` : `<div class="missing-screen">${zh?'请为关联来源补充真实截图':'Add an original screenshot to the linked source.'}</div>`}<p class="image-caption">${e(source?.title || '')} · ${e(source?.locator || '')}</p></figure>
    <figure class="proposed-screen"><figcaption><b>${zh?'建议方案':'PROPOSED DIRECTION'}</b><span>${zh?'概念示意 · 未上线':'Concept · not implemented'}</span></figcaption>${safeImage(board.proposalImage) ? `<a class="screen-link" href="${e(safeImage(board.proposalImage))}" download title="${zh?'下载原尺寸图片':'Download full-size image'}"><img src="${e(safeImage(board.proposalImage))}" alt="${e(c.caption || c.title)}" loading="eager"></a>` : `<div class="missing-screen">${zh?'尚未添加方案图；下方保留文字建议。':'No concept image yet. See the recommendation below.'}</div>`}<p class="image-caption">${e(c.caption)}</p></figure></div>
    <div class="design-reasoning">${[['finding',zh?'页面观察':'What I see'],['rationale',zh?'设计判断':'My design assessment'],['recommendation',zh?'建议怎么改':'What I recommend']].map(([key,label])=>`<div><h4>${label}</h4><p>${e(c[key])}</p></div>`).join('')}</div>
    <footer class="study-source"><span>${zh?'证据':'Evidence'} ${e(source?.id || '')} · <a href="${e(source?.url || '#')}" target="_blank" rel="noopener noreferrer">${e(source?.url || '')}</a></span><p>${e(source?.limitation || '')}</p></footer></article>`;
  }).join('') : '<div class="visual-empty"><b>让客户看见你的设计判断</b><p>关联一张现有页面截图，写下观察、判断与建议，再上传你的方案图。支持产品、交互与视觉方向。</p></div>'}</section>`;
}

export const reportStyles = `
*{box-sizing:border-box}body{margin:0;background:#f4f5ef;color:#263c34;font:15px/1.75 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif}.report{max-width:1200px;margin:auto;padding:54px;font:15px/1.75 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif}.report-brand{display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid #cbd3c6;padding-bottom:20px;margin-bottom:34px;font-size:12px;letter-spacing:1px}.report-status{color:#766038;font-size:12px}.report h1,.report h2,.report h3{line-height:1.35;letter-spacing:-.025em}.report h2{font-size:30px;font-family:inherit;font-weight:600;margin:.83em 0;color:#263c34}.report h3{font-size:20px}.report p{white-space:pre-wrap;overflow-wrap:anywhere}.report a{color:#244d42;overflow-wrap:anywhere}.report .prose{max-width:800px}.report .prose h3{margin:30px 0 10px}.report .prose p{margin:8px 0;font-size:15px;line-height:1.75;color:#263c34}.report .paragraph-gap{height:6px}.report-appendix{border-top:1px solid #cbd3c6;margin-top:50px;padding-top:24px}.report-appendix h3{font-size:18px}.report-sources li{margin:18px 0;overflow-wrap:anywhere}.report-sources small{display:block;color:#5c6956}.eyebrow{font-size:11px;letter-spacing:1.4px;color:#63765c}.badge{display:inline-block;font-size:11px;border:1px solid #d5deca;padding:3px 8px;border-radius:4px}.visual-section{margin-top:40px}.visual-heading{display:flex;justify-content:space-between;gap:20px;align-items:center;margin-bottom:25px}.visual-heading h2{font-size:26px;margin:10px 0}.visual-heading p{font-size:13px;color:#5d6d56;margin:0}.visual-study{background:white;border:1px solid #dce3d4;border-radius:10px;overflow:hidden;margin-bottom:28px}.study-header{padding:22px 26px;display:flex;justify-content:space-between;align-items:center;gap:16px}.study-header h3{margin:10px 0 0;font-size:22px}.study-number{font-family:Georgia,serif;font-size:20px;color:#647f53;margin-right:14px}.comparison-grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#dce3d4;border-top:1px solid #dce3d4;border-bottom:1px solid #dce3d4}.comparison-grid figure{margin:0;padding:20px;background:#f5f6f1;min-width:0}.comparison-grid .proposed-screen{background:#edf2e5}.comparison-grid figcaption{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:11px;margin-bottom:14px}.comparison-grid figcaption b{letter-spacing:1px;font-size:11px}.comparison-grid figcaption span{color:#64725c;font-size:10px}.screen-link{display:block;border:1px solid #d5dccb;border-radius:5px;overflow:hidden;background:#fff}.screen-link img{display:block;width:100%;height:auto}.image-caption{font-size:11px;color:#5d7053;margin:12px 0 0;line-height:1.65}.design-reasoning{display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;padding:26px}.design-reasoning h4{font-size:12px;color:#526b41;margin:0 0 9px}.design-reasoning p{font-size:13px;line-height:1.85;margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.study-source{padding:0 26px 22px;color:#66745f;font-size:10px;overflow-wrap:anywhere}.study-source p{font-size:10px;margin:5px 0 0;line-height:1.65}.missing-screen{min-height:200px;display:grid;place-items:center;padding:25px;border:1px dashed #a9b89a;border-radius:5px;color:#63765c;font-size:13px}.visual-empty{padding:35px;border:1px dashed #aebd9d;border-radius:8px}.visual-empty p{font-size:13px;margin-top:10px}.report-stale{padding:12px;background:#fff0ce;color:#765a25}.report-footer{font-size:11px;color:#63765c;margin:40px 0 0}
@media(max-width:700px){.report{padding:22px}.report-brand{flex-direction:column}.comparison-grid,.design-reasoning{grid-template-columns:1fr}.visual-heading{align-items:flex-start;flex-direction:column}.study-header{padding:18px}.design-reasoning{padding:20px;gap:18px}.comparison-grid figure{padding:16px}.study-header h3{font-size:20px}.visual-heading h2{font-size:23px}.study-source{padding:0 20px 20px}}
@media print{body{background:#fff}.report{max-width:none;padding:0}.report-brand{margin-bottom:20px}.visual-section{break-before:page}.visual-study{break-before:page;border-color:#c5cdbf}.visual-study:first-of-type{break-before:auto}.study-header,.comparison-grid,.design-reasoning,.study-source{break-inside:avoid}.comparison-grid{grid-template-columns:1fr 1fr}.comparison-grid figure{padding:10px}.design-reasoning{grid-template-columns:1fr;gap:10px;padding:16px}.design-reasoning p{font-size:10pt;line-height:1.5}.design-reasoning h4{margin-bottom:4px}.report h2{font-size:23pt}.study-header h3{font-size:16pt}.report-appendix{break-before:page}a{color:inherit!important;text-decoration:none}.report-footer{font-size:9pt}@page{size:A4;margin:15mm}}
`;
