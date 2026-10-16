import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer as netServer} from 'node:net';
import {request as httpRequest} from 'node:http';
import {createStudioServer} from '../studio/server.mjs';
import {validateTarget,createScenario,makeStore} from '../studio/core.mjs';

async function freePort(){const s=netServer();await new Promise((ok,bad)=>s.once('error',bad).listen(0,'127.0.0.1',ok));const p=s.address().port;await new Promise(ok=>s.close(ok));return p;}
async function until(check,ms=3000){const end=Date.now()+ms;while(Date.now()<end){const x=await check();if(x)return x;await new Promise(ok=>setTimeout(ok,15));}throw Error('Timed out waiting for run');}
let port,fixturePort,home,studio,url,count=0,waitRelease=null;
before(async()=>{
 port=await freePort();fixturePort=await freePort();home=await mkdtemp(join(tmpdir(),'studio-p1-test-'));
 studio=createStudioServer({studioPort:port,fixturePort,storageDir:join(home,'runs'),browserPath:'/test/chrome',executor:async()=>{
  count++;if(waitRelease)await new Promise(ok=>{const release=waitRelease;waitRelease=()=>{release();ok();};});
  return {report:{verdict:'PASS',failures:[],step_count:7,completed_steps:7,api_responses_200:1,screenshot_saved:false},inspection:{schema_version:1,scope:'controlled-fixture-only',steps:[{step_id:'sort',status:'completed'}],network:[]}};
 }});
 await studio.init();await new Promise((ok,bad)=>studio.server.once('error',bad).listen(port,'127.0.0.1',ok));url=`http://127.0.0.1:${port}`;
});
after(async()=>{if(studio?.server.listening)await new Promise(ok=>studio.server.close(ok));if(home)await rm(home,{recursive:true,force:true});});
const expected=()=>`http://127.0.0.1:${fixturePort}/`;
const post=(target=expected(),opts={})=>fetch(url+'/api/runs',{method:'POST',headers:{'Origin':url,'Content-Type':'application/json',...opts.headers},body:JSON.stringify({target_url:target})});

test('target admission is exact and rejects bypasses',()=>{
 assert.equal(validateTarget({target_url:expected()},fixturePort),expected());
 for(const x of [`http://localhost:${fixturePort}/`,`http://127.0.0.1:${fixturePort}/admin`,`http://127.0.0.1:${fixturePort}/?token=x`,`http://127.0.0.1:${fixturePort}@evil.test/`,'http://169.254.169.254/','https://example.com']){
  assert.throws(()=>validateTarget({target_url:x},fixturePort));
 }
 assert.throws(()=>validateTarget({target_url:expected(),payload:'extra'},fixturePort));
});
test('scenario uses pinned six actions and bounded capture types',()=>{
 const x=createScenario('/test/chrome',expected());assert.equal(x.actions.length,6);assert.equal(x.start_url.url,expected());assert.ok(x.capture.at_end.includes('screenshot'));assert.equal(x.capture.network,undefined);
});
test('studio serves UI with restrictive security headers',async()=>{
 for(const path of ['/','/app.js','/style.css']){const r=await fetch(url+path);assert.equal(r.status,200);assert.match(r.headers.get('content-security-policy'),/script-src 'self'/);assert.equal(r.headers.get('x-frame-options'),'DENY');}
});
test('chat tracking query on UI landing page redirects safely without bypassing API query checks',async()=>{
 const tracked=await fetch(url+'/?utm_source=chatgpt.com',{redirect:'manual'});
 assert.equal(tracked.status,302);
 assert.equal(tracked.headers.get('location'),'/');
 assert.equal(tracked.headers.get('cache-control'),'no-store');
 const destination=await fetch(url+'/?utm_source=chatgpt.com');
 assert.equal(destination.status,200);
 assert.match(await destination.text(),/Web REA Studio/);
 for(const path of [
  '/?secret=123',
  '/?utm_source=chatgpt.com&next=https://example.com/',
  '/?utm_source='+('x'.repeat(129)),
  '/api/runs?utm_source=chatgpt.com',
  '/app.js?utm_source=chatgpt.com',
 ]){
  const response=await fetch(url+path,{redirect:'manual'});
  assert.equal(response.status,400,`should reject ${path}`);
  assert.equal((await response.json()).error,'unexpected_query');
 }
});
test('studio rejects hostile host and cross-origin submissions',async()=>{
 const hostStatus=await new Promise((ok,bad)=>{const req=httpRequest({hostname:'127.0.0.1',port,path:'/api/runs',headers:{Host:'localhost:'+port}},res=>{res.resume();ok(res.statusCode)});req.on('error',bad);req.end();});assert.equal(hostStatus,403);
 const origin=await fetch(url+'/api/runs',{method:'POST',headers:{Origin:'http://evil.invalid','Content-Type':'application/json'},body:JSON.stringify({target_url:expected()})});assert.equal(origin.status,403);
});
test('studio blocks unauthorized remote targets before scheduling',async()=>{
 const r=await post('https://example.com/');assert.equal(r.status,400);assert.equal(count,0);
});
test('studio rejects content types, oversized payloads and unknown API',async()=>{
 const a=await fetch(url+'/api/runs',{method:'POST',headers:{Origin:url,'Content-Type':'text/plain'},body:'hi'});assert.equal(a.status,415);
 const b=await fetch(url+'/api/runs',{method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:'{'+'x'.repeat(5000)});assert.equal(b.status,413);
 const c=await fetch(url+'/api/runs/../../admin');assert.equal(c.status,404);
});
test('POST executes exactly one run and GET never invokes analyzer again',async()=>{
 const a=await post();assert.equal(a.status,202);const data=await a.json();assert.match(data.id,/^[0-9a-f-]{36}$/);
 const completed=await until(async()=>{const r=await(await fetch(`${url}/api/runs/${data.id}`)).json();return r.status==='completed'?r:null;});
 assert.equal(completed.verdict,'PASS');const report=await(await fetch(`${url}/api/runs/${data.id}/report`)).json();assert.equal(report.completed_steps,7);
 const inspection=await(await fetch(`${url}/api/runs/${data.id}/inspection`)).json();assert.equal(inspection.scope,'controlled-fixture-only');assert.equal(inspection.steps[0].step_id,'sort');
 const before=count;await fetch(url+'/');await fetch(url+'/api/runs');await fetch(`${url}/api/runs/${data.id}`);await fetch(`${url}/api/runs/${data.id}/report`);await fetch(`${url}/api/runs/${data.id}/inspection`);assert.equal(count,before);
});
test('concurrent run requests cannot start twice',async()=>{
 let unblock;const barrier=new Promise(ok=>{unblock=ok});
 const previous=studio.server;void previous;
 // Swap the executor in a new isolated server so the other tests stay deterministic.
 const p=await freePort(),root=join(home,'concurrent');let launched=0;
 const s=createStudioServer({studioPort:p,fixturePort,storageDir:root,browserPath:'/test/chrome',executor:async()=>{launched++;await barrier;return {report:{verdict:'PASS',failures:[]},inspection:{schema_version:1,steps:[],network:[]}};}});await s.init();await new Promise(ok=>s.server.listen(p,'127.0.0.1',ok));
 const endpoint=`http://127.0.0.1:${p}`,payload=JSON.stringify({target_url:expected()}),headers={Origin:endpoint,'Content-Type':'application/json'};
 try{
 const a=await fetch(endpoint+'/api/runs',{method:'POST',headers,body:payload});assert.equal(a.status,202);
 const b=await fetch(endpoint+'/api/runs',{method:'POST',headers,body:payload});assert.equal(b.status,409);await until(async()=>launched===1);assert.equal(launched,1);
 unblock();const id=(await a.json()).id;await until(async()=>{const r=await(await fetch(`${endpoint}/api/runs/${id}`)).json();return r.status==='completed';});
 }finally{unblock();await new Promise(ok=>s.server.close(ok));}
});
test('runs remain queryable after opening a new store instance',async()=>{
 const list=await(await fetch(url+'/api/runs')).json();assert.ok(list.runs.length>=1);
 const other=makeStore(join(home,'runs'));await other.init();assert.equal((await other.get(list.runs[0].id)).status,'completed');
});
test('crashed queued/running jobs become interrupted on restart',async()=>{
 const root=join(home,'recover');const s=makeStore(root);await s.init();const job=await s.create({target_url:expected()});await s.update(job.id,{status:'running'});
 const afterRestart=makeStore(root);await afterRestart.init();assert.equal((await afterRestart.get(job.id)).status,'interrupted');
});
test('missing evidence is never presented as a screenshot',async()=>{
 const list=await(await fetch(url+'/api/runs')).json();const id=list.runs[0].id;
 const r=await fetch(`${url}/api/runs/${id}/screenshot`);assert.equal(r.status,404);
});

test('UI exposes inspection section and visible failure state',async()=>{
 const r=await fetch(url+'/');const html=await r.text();
 assert.equal(r.status,200);assert.match(html,/id="inspector-steps"/);assert.match(html,/id="run-error"/);
});
test('failed analyzer records safe diagnostics without exposing raw stderr',async()=>{
 const p=await freePort(),root=join(home,'failed-diagnostic');
 const s=createStudioServer({studioPort:p,fixturePort,storageDir:root,browserPath:'/test/chrome',executor:async()=>{throw Object.assign(Error('REA subprocess exited with status 1; inspect local stderr log'),{code:'REA_EXIT_NONZERO'});}});
 await s.init();await new Promise(ok=>s.server.listen(p,'127.0.0.1',ok));
 const endpoint=`http://127.0.0.1:${p}`;
 try{
  const r=await fetch(endpoint+'/api/runs',{method:'POST',headers:{Origin:endpoint,'Content-Type':'application/json'},body:JSON.stringify({target_url:expected()})});
  assert.equal(r.status,202);const meta=await r.json();
  const failed=await until(async()=>{const x=await(await fetch(`${endpoint}/api/runs/${meta.id}`)).json();return x.status==='failed'?x:null;});
  assert.equal(failed.error_code,'REA_EXIT_NONZERO');assert.equal(failed.error.includes('stderr'),true);
  assert.match(failed.diagnostic_path,/^results\/studio\/runs\/[a-f0-9-]+\/rea-stderr\.log$/);
  assert.equal((await fetch(`${endpoint}/api/runs/${meta.id}/inspection`)).status,404);
 }finally{await new Promise(ok=>s.server.close(ok));}
});
