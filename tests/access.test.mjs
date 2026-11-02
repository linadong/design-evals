import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {handleBeta} from '../server/access.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const env={DESIGN_EVALS_BETA_CODES:JSON.stringify([{id:'fixtureA',hash:hash('fixture-code-not-real')}]),DESIGN_EVALS_SESSION_SECRET:'fixture-secret-not-real-01234567890123456789'};
const origin='https://linadong.design';let sequence=0;
function request(path,{method='GET',body,cookie,site=origin}={}){return new Request(origin+'/api/design-evals/'+path,{method,headers:{origin:site,'content-type':'application/json','x-forwarded-for':'fixture-'+(++sequence),...(cookie?{cookie}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});}
async function unlock(now=Date.now()){const r=await handleBeta(request('unlock',{method:'POST',body:{code:'fixture-code-not-real'}}),env,{},now);assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
test('configuration fails closed and anonymous callers cannot consume model or collection resources',async()=>{
 assert.equal((await handleBeta(request('session'),{})).status,503);
 for(const route of ['collect','analyze','status'])assert.equal((await handleBeta(request(route,{method:route==='status'?'GET':'POST',body:route==='status'?undefined:{}}),env,{transport:()=>assert.fail('No unauthenticated work')})).status,401);
});
test('valid test code yields a secure HTTP-only eight-hour session, without returning the code or hash',async()=>{
 const r=await handleBeta(request('unlock',{method:'POST',body:{code:'fixture-code-not-real'}}),env);
 assert.equal(r.status,200);for(const flag of ['HttpOnly','SameSite=Strict','Secure','Max-Age=28800'])assert.ok(r.headers.get('set-cookie').includes(flag));assert.deepEqual(await r.json(),{authenticated:true});
 const cookie=r.headers.get('set-cookie').split(';')[0];assert.deepEqual(await(await handleBeta(request('session',{cookie}),env)).json(),{authenticated:true});
});
test('incorrect, forged, expired and revoked codes cannot grant access',async()=>{
 assert.equal((await handleBeta(request('unlock',{method:'POST',body:{code:'wrong'}}),env)).status,401);
 const now=Date.now(),cookie=await unlock(now);
 assert.deepEqual(await(await handleBeta(request('session',{cookie:cookie+'x'}),env,{},now)).json(),{authenticated:false});
 assert.deepEqual(await(await handleBeta(request('session',{cookie}),env,{},now+28800001)).json(),{authenticated:false});
 const revoked={...env,DESIGN_EVALS_BETA_CODES:JSON.stringify([{id:'fixtureB',hash:hash('different-fixture')}])};
 assert.equal((await handleBeta(request('status',{cookie}),revoked)).status,401);
});
test('cross-origin POST cannot unlock or invoke authenticated actions',async()=>{
 assert.equal((await handleBeta(request('unlock',{method:'POST',site:'https://other.example.com',body:{code:'fixture-code-not-real'}}),env)).status,403);
 const cookie=await unlock();assert.equal((await handleBeta(request('analyze',{method:'POST',site:'https://other.example.com',cookie,body:{}}),env)).status,403);
});
test('authenticated status exposes configuration state but never server credentials',async()=>{
 const cookie=await unlock();const r=await handleBeta(request('status',{cookie}),{...env,AI_PROVIDER:'deepseek',DEEPSEEK_API_KEY:'fixture-key-private'});
 assert.equal(r.status,200);const body=await r.text();assert.ok(body.includes('deepseek'));assert.ok(!body.includes('fixture-key-private'));assert.ok(!body.includes('SESSION_SECRET'));
});
test('logout expires authorization and sign-in rate limiting rejects repeated guesses',async()=>{
 const cookie=await unlock();const r=await handleBeta(request('logout',{method:'POST',cookie,body:{}}),env);assert.ok(r.headers.get('set-cookie').includes('Max-Age=0'));
 const make=()=>new Request(origin+'/api/design-evals/unlock',{method:'POST',headers:{origin,'content-type':'application/json','x-forwarded-for':'fixture-limited'},body:JSON.stringify({code:'wrong'})});
 for(let i=0;i<10;i++)assert.equal((await handleBeta(make(),env,{},1000)).status,401);assert.equal((await handleBeta(make(),env,{},1000)).status,429);
});
test('one running task per test code prevents parallel duplicate work',async()=>{
 const cookie=await unlock();let release,entered;const started=new Promise(resolve=>entered=resolve);const waiting=new Promise(resolve=>release=resolve);
 const dependencies={transport:async()=>{entered();await waiting;return new Response('<html><body>'+('Public fixture evidence. '.repeat(10))+'</body></html>',{headers:{'content-type':'text/html'}});}};
 const first=handleBeta(request('collect',{method:'POST',cookie,body:{url:'https://example.com/'}}),env,dependencies);await started;
 const second=await handleBeta(request('collect',{method:'POST',cookie,body:{url:'https://example.com/'}}),env,dependencies);assert.equal(second.status,429);release();assert.equal((await first).status,200);
});


test('anonymous waitlist sign-up saves privately without issuing authorization',async()=>{
 let saved;
 const r=await handleBeta(request('waitlist',{method:'POST',body:{email:'  Applicant@Example.com  ',website:''}}),env,{saveWaitlist:async record=>saved=record});
 assert.equal(r.status,201);assert.deepEqual(await r.json(),{saved:true});assert.equal(r.headers.get('set-cookie'),null);assert.equal(saved.email,'applicant@example.com');assert.match(saved.id,/^[a-f0-9]{64}$/);assert.ok(!saved.id.includes('applicant'));
 assert.equal((await handleBeta(request('status'),env)).status,401);
});
test('invalid, cross-site and failed waitlist submissions never claim successful storage',async()=>{
 let writes=0;const dependencies={saveWaitlist:async()=>{writes++;throw Error('Storage failed');}};
 for(const email of ['','broken','a@local','<script>@example.com'])assert.equal((await handleBeta(request('waitlist',{method:'POST',body:{email}}),env,dependencies)).status,400);
 assert.equal((await handleBeta(request('waitlist',{method:'POST',site:'https://other.example.com',body:{email:'test@example.com'}}),env,dependencies)).status,403);
 assert.equal((await handleBeta(request('waitlist',{method:'POST',body:{email:'test@example.com'}}),env,dependencies)).status,503);assert.equal(writes,1);
});
test('repeat requests use one deterministic record and honeypot does not write',async()=>{
 const records=[];const dependencies={saveWaitlist:async record=>records.push(record)};
 for(let i=0;i<2;i++)await handleBeta(request('waitlist',{method:'POST',body:{email:'repeat@example.com'}}),env,dependencies);
 assert.equal(records[0].id,records[1].id);
 await handleBeta(request('waitlist',{method:'POST',body:{email:'bot@example.com',website:'https://spam.example.com'}}),env,dependencies);assert.equal(records.length,2);
});
