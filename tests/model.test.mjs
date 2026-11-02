import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, safeUrl, touch, makeDraft, draftKey, draftStale, reviewBlockers, exportMarkdown, validateWorkspace, researchFingerprint, selectedOpportunity } from '../public/model.js';
import { linkModelSample } from '../public/sample.js';
import { portableProject, reportHtml } from '../public/report.js';
import { safeImage } from '../public/visual.js';

test('new target remains empty, never inherits LinkModel observations', () => {
  const project=createProject('another-company.com');
  assert.equal(project.url,'https://another-company.com/');
  assert.equal(project.mode,'manual');
  assert.deepEqual(project.sources,[]);
  assert.deepEqual(project.opportunities,[]);
  assert.equal(project.company.audience,'');
  assert.throws(()=>createProject('javascript:alert(1)'));
  assert.equal(safeUrl('https://name:secret@example.com'),'');
});

test('sample and drafts survive strict backup validation', () => {
  const project=linkModelSample();
  assert.equal(project.url,'https://linkmodel.ai/');
  project.drafts[draftKey(project,'en')]=makeDraft(project,'en');
  assert.equal(validateWorkspace(JSON.parse(JSON.stringify({schema:1,projects:[project],activeId:project.id}))).projects.length,1);
});

test('review cannot succeed without company, source and complete draft checks', () => {
  const p=linkModelSample();
  assert.ok(reviewBlockers(p).includes('确认公司理解'));
  assert.ok(reviewBlockers(p).includes('逐条核对关联来源'));
  p.companyReviewed=true;p.sources.forEach(s=>s.verified=true);
  p.drafts[draftKey(p,'en')]=makeDraft(p,'en');
  assert.deepEqual(reviewBlockers(p),[]);
  p.reviewedRevision=`${p.revision}:en`;
  assert.match(exportMarkdown(p),/^Human-reviewed/);
  touch(p);
  assert.equal(p.reviewedRevision,null);
  assert.match(exportMarkdown(p),/^Research draft/);
});

test('research edits preserve draft and make its basis stale', () => {
  const p=linkModelSample();
  const key=draftKey(p,'en');p.drafts[key]=makeDraft(p);
  p.drafts[key].proposal='My manually edited proposal';
  p.company.goal='A newly confirmed goal';touch(p);
  assert.equal(p.drafts[key].proposal,'My manually edited proposal');
  assert.equal(draftStale(p,p.drafts[key]),true);
  assert.ok(reviewBlockers(p).includes('核对提案与最新研究是否一致'));
});

test('drafts stay separate by opportunity and language', () => {
  const p=linkModelSample();const first=draftKey(p,'en');
  p.drafts[first]=makeDraft(p);p.drafts[first].proposal='Unique first opportunity';
  p.drafts[draftKey(p,'zh')]=makeDraft(p,'zh');
  p.selectedId=p.opportunities[1].id;
  p.drafts[draftKey(p,'en')]=makeDraft(p,'en');
  assert.equal(Object.keys(p.drafts).length,3);
  p.selectedId=p.opportunities[0].id;
  assert.equal(p.drafts[draftKey(p,'en')].proposal,'Unique first opportunity');
});

test('export reflects edits and excludes internal notes and excluded sources', () => {
  const p=linkModelSample();p.company.notes='PRIVATE INTERNAL NOTE';
  p.drafts[draftKey(p,'en')]=makeDraft(p);p.drafts[draftKey(p,'en')].opening='A custom opening';
  const md=exportMarkdown(p);
  assert.ok(md.includes('A custom opening'));
  assert.ok(!md.includes('PRIVATE INTERNAL NOTE'));
  assert.ok(!md.includes(p.sources[2].title));
  p.decision='no-pitch';assert.throws(()=>exportMarkdown(p));
  p.decision='pitch';p.opportunities[0].status='excluded';assert.throws(()=>exportMarkdown(p));
});

test('unsafe or incomplete backups are rejected before touching current data', () => {
  const make=()=>{const p=linkModelSample();return {schema:1,projects:[p],activeId:p.id};};
  for(const mutate of [x=>x.projects[0].sources[0].url='javascript:alert(1)',x=>x.projects[0].url='linkmodel.ai',x=>x.projects[0].sources[0].image='data:image/svg+xml;base64,bad',x=>x.projects[0].opportunities[0].sourceIds=['missing'],x=>x.projects[0].company=null,x=>x.projects[0].drafts={bad:{}},x=>x.projects[0].opportunities[0].copy={en:{title:{malformed:true}}}]){
    const data=make();mutate(data);assert.throws(()=>validateWorkspace(data));
  }
});

test('evidence changes invalidate drafts without embedding images in their basis', () => {
  const p=linkModelSample();const source=p.sources.find(s=>selectedOpportunity(p).sourceIds.includes(s.id));source.image='data:image/png;base64,'+'a'.repeat(1000000);
  const before=researchFingerprint(p);assert.ok(before.length<50);
  source.image=source.image.slice(0,-1)+'b';
  assert.notEqual(researchFingerprint(p),before);
});

test('visual reports embed both sides, preserve edits and exclude internal notes', async () => {
  const p=linkModelSample();p.company.notes='PRIVATE INTERNAL NOTE';
  p.companyReviewed=true;p.sources.forEach(s=>s.verified=true);
  p.drafts[draftKey(p,'en')]=makeDraft(p);p.drafts[draftKey(p,'en')].proposal='# My edited proposal\n\n<script>alert(1)</script>';
  p.reviewedRevision=`${p.revision}:en`;
  const image='data:image/webp;base64,YWJj';
  const portable=await portableProject(p,async()=>image);
  const html=reportHtml(p,'en',portable);
  assert.equal((html.match(/<img /g)||[]).length,4);
  assert.ok(!html.includes('src="./assets/'));
  assert.ok(html.includes('Human-reviewed'));
  assert.ok(html.includes('My edited proposal'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('PRIVATE INTERNAL NOTE'));
  assert.ok(html.includes('Concept · not implemented'));
  assert.ok(p.sources.find(s=>s.id==='E4').image.startsWith('./assets/'));
  assert.ok(exportMarkdown(p).includes('![Original screenshot]'));
  assert.ok(exportMarkdown(p).includes('![Design concept]'));
  await assert.rejects(()=>portableProject(p,async()=>'<svg>unsafe</svg>'));
});

test('visual evidence, recommendations and language are included in review gates', () => {
  const p=linkModelSample();p.companyReviewed=true;p.sources.forEach(s=>s.verified=true);
  p.drafts[draftKey(p,'en')]=makeDraft(p);
  const o=selectedOpportunity(p);
  const before=researchFingerprint(p);
  o.boards[0].copy.en.recommendation='An edited design recommendation';
  assert.notEqual(researchFingerprint(p),before);
  assert.ok(draftStale(p,p.drafts[draftKey(p,'en')]));
  delete o.boards[0].copy.en;
  assert.ok(reviewBlockers(p).includes('补齐当前语言的图文建议'));
  delete p.sources.find(s=>s.id===o.boards[0].sourceId).image;
  assert.ok(reviewBlockers(p).includes('为图文建议补充原页面截图'));
});

test('old backups still open; malformed visual attachments cannot bypass validation', () => {
  const make=()=>{const p=linkModelSample();return {schema:1,projects:[p],activeId:p.id};};
  const old=make();old.projects[0].opportunities.forEach(o=>{delete o.boards;delete o.discipline;});
  old.projects[0].sources.forEach(s=>delete s.image);delete old.projects[0].sampleVersion;
  assert.equal(validateWorkspace(old),old);
  for(const mutate of [p=>p.opportunities[0].boards[0].sourceId='E1',p=>p.opportunities[0].boards[0].proposalImage='https://evil.example/track.png',p=>p.opportunities[0].boards[0].dimension='__proto__',p=>p.opportunities[0].boards[0].copy.en.title={},p=>p.opportunities[0].boards=[null],p=>p.opportunities[0].discipline='bad']){
    const value=make();mutate(value.projects[0]);
    assert.throws(()=>validateWorkspace(value));
  }
  for(const input of ['./assets/../secret','./assets/unknown.webp','data:image/svg+xml;base64,YWJj','https://evil.example/a.png'])assert.equal(safeImage(input),'');
});
