const api='/api/design-evals';
let pending;
export async function betaSession(){
 try{const r=await fetch(api+'/session',{cache:'no-store'});const data=await r.json();const allowed=!!(r.ok&&data.authenticated);document.body.dataset.betaAuthorized=String(allowed);return allowed;}catch{document.body.dataset.betaAuthorized='false';return false;}
}
export async function requireBetaAccess(){
 if(await betaSession())return true;
 if(pending)return pending;
 pending=new Promise(resolve=>{
  const prior=document.activeElement,dialog=document.createElement('dialog');dialog.className='modal beta-access-modal';dialog.setAttribute('aria-labelledby','beta-access-title');
  dialog.innerHTML=`<div class="modal-top"><span class="eyebrow">INVITATION BETA</span><button type="button" class="icon-button" data-close-access aria-label="关闭口令窗口">×</button></div><h2 id="beta-access-title">开始研究前，输入测试口令</h2><p class="muted">浏览首页与样例无需口令。真实采集和 AI 分析需要内测授权。</p><button type="button" class="button secondary" data-preview-sample data-action="sample">先看看样例</button><p class="small muted">无需口令，先体验完整的图文研究与提案。</p><form id="beta-unlock"><label class="field"><span>测试口令</span><input name="code" type="password" autocomplete="one-time-code" required maxlength="200" placeholder="粘贴你的测试口令"></label><button class="button primary" type="submit">验证并继续研究</button><p data-unlock-feedback role="alert"></p></form><div class="beta-waitlist"><form id="beta-waitlist"><label class="field"><span>联系邮箱</span><input name="email" type="email" autocomplete="email" required maxlength="254" placeholder="you@example.com"></label><label class="beta-honeypot" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label><button class="button secondary" type="submit">请求口令</button><p class="small muted">邮箱仅用于内测邀请与申请联系，不会公开；申请后由 Lina 审核并分发口令，不会自动开通。</p><p data-waitlist-feedback role="status" aria-live="polite"></p></form></div>`;
  document.body.append(dialog);let authorized=false;
  dialog.addEventListener('close',()=>{dialog.remove();pending=undefined;prior?.focus();resolve(authorized);});
  dialog.querySelector('[data-close-access]').addEventListener('click',()=>dialog.close());
  dialog.querySelector('[data-preview-sample]').addEventListener('click',()=>dialog.close());
  dialog.querySelector('#beta-unlock').addEventListener('submit',async event=>{
   event.preventDefault();const form=event.currentTarget,button=form.querySelector('button'),feedback=form.querySelector('[data-unlock-feedback]');button.disabled=true;feedback.textContent='正在验证…';
   try{const r=await fetch(api+'/unlock',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:new FormData(form).get('code')})});const data=await r.json();if(!r.ok){feedback.textContent=data.error||'暂时无法验证，请重试。';return;}document.body.dataset.betaAuthorized='true';authorized=true;dialog.close();}catch{feedback.textContent='连接失败，请重试；你输入的网址仍保留。';}finally{button.disabled=false;}
  });
  dialog.querySelector('#beta-waitlist').addEventListener('submit',async event=>{
   event.preventDefault();const form=event.currentTarget,button=form.querySelector('button'),feedback=form.querySelector('[data-waitlist-feedback]');button.disabled=true;feedback.textContent='正在提交申请…';
   try{const data=new FormData(form);const r=await fetch(api+'/waitlist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:data.get('email'),website:data.get('website')})});const result=await r.json();if(!r.ok){feedback.textContent=result.error||'申请未保存，请稍后重试。';return;}feedback.textContent='口令申请已记录，后续会通过此邮箱联系。';form.elements.email.readOnly=true;button.textContent='已提交申请';}catch{feedback.textContent='申请未保存：连接失败，请稍后重试。';}finally{if(!form.elements.email.readOnly)button.disabled=false;}
  });
  dialog.showModal();
 });
 return pending;
}
document.addEventListener('click',async event=>{if(!event.target.closest('[data-beta-logout]'))return;await fetch(api+'/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});location.reload();});
