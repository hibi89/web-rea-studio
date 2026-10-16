import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';
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
  assert.match(failed.diagnostic_path,/^runs\/[a-f0-9-]+\/rea-stderr\.log$/);
  assert.equal((await fetch(`${endpoint}/api/runs/${meta.id}/inspection`)).status,404);
 }finally{await new Promise(ok=>s.server.close(ok));}
});

test('P2 explicitly approved HTTPS URL submits a static-only job and keeps fixture browser path unchanged',async()=>{
 const p=await freePort(),root=join(home,'p2-static');
 const authorized='https://owner.example.org/about',calls=[];
 const s=createStudioServer({studioPort:p,fixturePort,storageDir:root,browserPath:'/test/chrome',approvedUrls:[authorized],
  executor:async()=>{calls.push('browser');return {report:{verdict:'PASS',failures:[]},inspection:{schema_version:1,scope:'fixture'}};},
  staticExecutor:async({target})=>{calls.push(target);return {report:{verdict:'PASS',analysis_mode:'static-html',step_count:1,completed_steps:1,api_responses_200:0,screenshot_saved:false,failures:[]},inspection:{scope:'explicit-https-allowlist',mode:'static-html',steps:[{step_id:'https-document',action:'GET',status:'completed'}],network:[],page:{title:'Owned page',summary:{forms:1,links:3}}}};}
 });
 await s.init();await new Promise(ok=>s.server.listen(p,'127.0.0.1',ok));
 const base=`http://127.0.0.1:${p}`,headers={Origin:base,'Content-Type':'application/json'};
 try{
  const targets=await(await fetch(base+'/api/targets')).json();
  assert.deepEqual(targets.approved_urls,[authorized]);assert.equal(targets.fixture,expected());
  for(const rejected of ['https://evil.example.com/','https://owner.example.org/','https://owner.example.org/about?x=1','http://127.0.0.1:4317/']){
   // Reject all unapproved external scope, while allowing fixture only on the configured fixture port.
   if(rejected===expected())continue;
   const r=await fetch(base+'/api/runs',{method:'POST',headers,body:JSON.stringify({target_url:rejected})});
   assert.equal(r.status,400,rejected);
  }
  const r=await fetch(base+'/api/runs',{method:'POST',headers,body:JSON.stringify({target_url:authorized})});
  assert.equal(r.status,202);
  const meta=await r.json();assert.equal(meta.mode,'static-html');
  const completed=await until(async()=>{const x=await(await fetch(base+'/api/runs/'+meta.id)).json();return x.status==='completed'?x:null;});
  assert.equal(completed.mode,'static-html');assert.deepEqual(calls,[authorized]);
  const report=await(await fetch(base+'/api/runs/'+meta.id+'/report')).json();
  assert.equal(report.analysis_mode,'static-html');
  const inspection=await(await fetch(base+'/api/runs/'+meta.id+'/inspection')).json();
  assert.equal(inspection.page.title,'Owned page');
  assert.equal((await fetch(base+'/api/runs/'+meta.id+'/screenshot')).status,404);
  const list=await(await fetch(base+'/api/runs')).json();assert.equal(list.runs[0].id,meta.id);
  await fetch(base+'/');await fetch(base+'/api/runs/'+meta.id+'/report');
  assert.deepEqual(calls,[authorized],'GET must never trigger another external request');
 }finally{await new Promise(ok=>s.server.close(ok));}
});

test('P2 missing approved URLs leaves remote host blocked',async()=>{
 const p=await freePort(),root=join(home,'p2-no-approvals');let calls=0;
 const s=createStudioServer({studioPort:p,fixturePort,storageDir:root,browserPath:'/test/chrome',approvedUrls:[],staticExecutor:async()=>{calls++;throw Error('should not run');}});
 await s.init();await new Promise(ok=>s.server.listen(p,'127.0.0.1',ok));
 try{const base=`http://127.0.0.1:${p}`;
  const r=await fetch(base+'/api/runs',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({target_url:'https://www.example.org/'})});
  assert.equal(r.status,400);assert.equal(calls,0);
 }finally{await new Promise(ok=>s.server.close(ok));}
});

test('P2 passive HTTPS run uses separate executor, stores safe report and screenshot availability',async()=>{
 const p=await freePort(),root=join(home,'p2-dynamic'),target='https://daily-dashboard-ldh-1013.clevertide128.chatgpt.site/';
 let invoked=0;
 const s=createStudioServer({studioPort:p,fixturePort,storageDir:root,approvedUrls:[target],browserPath:'/test/chrome',
  dynamicExecutor:async({target:received,browserPath,dir})=>{
   invoked++;assert.equal(received,target);assert.equal(browserPath,'/test/chrome');
   assert.match(dir,/p2-dynamic/);
   return {report:{verdict:'PASS',analysis_mode:'dynamic-passive',failures:[],step_count:1,completed_steps:1,screenshot_saved:false},inspection:{schema_version:3,scope:'explicit-https-allowlist',mode:'dynamic-passive',steps:[],network:[]}};
  }});
 await s.init();await new Promise(ok=>s.server.listen(p,'127.0.0.1',ok));
 const endpoint=`http://127.0.0.1:${p}`;
 const post=body=>fetch(endpoint+'/api/runs',{method:'POST',headers:{Origin:endpoint,'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  const forbidden=await post({target_url:'https://other.clevertide128.chatgpt.site/',analysis_mode:'dynamic-passive'});
  assert.equal(forbidden.status,400);
  const invalid=await post({target_url:target,analysis_mode:'auto-click'});assert.equal(invalid.status,400);
  const fixtureReject=await post({target_url:expected(),analysis_mode:'dynamic-passive'});assert.equal(fixtureReject.status,400);
  const r=await post({target_url:target,analysis_mode:'dynamic-passive'});assert.equal(r.status,202);
  const meta=await r.json();assert.equal(meta.mode,'dynamic-passive');
  const completed=await until(async()=>{const x=await(await fetch(`${endpoint}/api/runs/${meta.id}`)).json();return x.status==='completed'?x:null;});
  assert.equal(completed.mode,'dynamic-passive');assert.equal(invoked,1);
  const report=await(await fetch(`${endpoint}/api/runs/${meta.id}/report`)).json();assert.equal(report.analysis_mode,'dynamic-passive');
  const inspected=await(await fetch(`${endpoint}/api/runs/${meta.id}/inspection`)).json();assert.equal(inspected.scope,'explicit-https-allowlist');
  await fetch(`${endpoint}/api/runs/${meta.id}`);await fetch(`${endpoint}/api/runs`);assert.equal(invoked,1);
 }finally{await new Promise(ok=>s.server.close(ok));}
});

test('failed-run diagnosis API reads redacted persisted data, never retriggers executor',async()=>{
 const p=await freePort(),root=join(home,'diagnose-route'),target='https://owner.example.org/approved';
 let countRuns=0;
 const s=createStudioServer({studioPort:p,fixturePort,storageDir:root,approvedUrls:[target],
  dynamicExecutor:async()=>{
   countRuns++;
   return {report:{verdict:'FAIL',failures:['resource_requests_unsettled'],resource_requests:2,resource_fulfilled:1,resource_blocked:0,resource_pending:1},
    inspection:{mode:'dynamic-passive',network:[{kind:'requested',path:'/api/report',url:'https://owner.example.org/api/report?secret=HIDDEN'},{kind:'browser-failed',host:'api.owner.example.org',reason:'cors_error',query:'SECRET'}]}};
  }});
 await s.init();await new Promise(ok=>s.server.listen(p,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+p;
 try{
  const none=await fetch(base+'/api/runs/00000000-0000-4000-8000-000000000000/diagnosis');
  assert.equal(none.status,404);
  const res=await fetch(base+'/api/runs',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({target_url:target,analysis_mode:'dynamic-passive'})});
  assert.equal(res.status,202);
  const id=(await res.json()).id;
  await until(async()=>{const r=await(await fetch(base+'/api/runs/'+id)).json();return r.status==='failed';});
  const diagRes=await fetch(base+'/api/runs/'+id+'/diagnosis');
  assert.equal(diagRes.status,200);
  const x=await diagRes.json();
  assert.equal(x.passive_browser.pending,1);
  assert.equal(x.passive_browser.recent_network_events[0].path,'/api/report');
  assert.equal(JSON.stringify(x).includes('HIDDEN'),false);
  assert.equal(JSON.stringify(x).includes('SECRET'),false);
  const before=countRuns;
  await fetch(base+'/api/runs/'+id+'/diagnosis');
  await fetch(base+'/api/runs/'+id+'/report');
  assert.equal(countRuns,before);
  const success=await s.store.create({target_url:expected(),mode:'rea-browser'});
  await s.store.update(success.id,{status:'completed',verdict:'PASS'});
  assert.equal((await fetch(base+'/api/runs/'+success.id+'/diagnosis')).status,409);
 }finally{await new Promise(ok=>s.server.close(ok));}
});
test('actual local Studio has failure postmortem panel',async()=>{
 const h=await(await fetch(url+'/')).text();
 const js=await(await fetch(url+'/app.js')).text();
 assert.match(h,/id="diagnosis-panel"/);
 assert.match(js,/\/diagnosis/);
});

test('frontend blueprint inspector appears in local Studio UI, not in mock Vercel preview',async()=>{
 const page=await(await fetch(url+'/')).text();
 const js=await(await fetch(url+'/app.js')).text();
 assert.match(page,/id="frontend-blueprint"/);
 assert.match(js,/showBlueprint\(page\.frontend_blueprint\)/);
 assert.match(js,/showBlueprint\(x\.page\?\.frontend_blueprint\)/);
});

test('static visual mode is opt-in on exact approved URL, routes Chrome with scripts disabled',async()=>{
 const port2=await freePort(),root=join(home,'p3-visual-mode'),target='https://owner.example.org/visual';
 const calls=[];
 const app=createStudioServer({studioPort:port2,fixturePort,storageDir:root,browserPath:'/test/chrome',
  approvedUrls:[target],dynamicExecutor:async(args)=>{
   calls.push({target:args.target,scriptsDisabled:args.scriptsDisabled});
   return {report:{verdict:'PASS',analysis_mode:'static-visual',scripts_executed:false,
      application_render_status:'not-executed',screenshot_saved:false,failures:[]},
     inspection:{mode:'static-visual',completeness:'static-dom-visual-only',scripts_executed:false,network:[],page:{title:'Safe initial HTML'}}};
  }});
 await app.init();await new Promise(ok=>app.server.listen(port2,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+port2, post=body=>fetch(base+'/api/runs',{
  method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  const targets=await (await fetch(base+'/api/targets')).json();
  assert.ok(targets.external_modes.includes('static-visual'));
  assert.equal((await post({target_url:target+'/other',analysis_mode:'static-visual'})).status,400);
  assert.equal((await post({target_url:expected(),analysis_mode:'static-visual'})).status,400);
  const r=await post({target_url:target,analysis_mode:'static-visual'});
  assert.equal(r.status,202);
  const id=(await r.json()).id;
  const done=await until(async()=>{const meta=await (await fetch(base+'/api/runs/'+id)).json();return meta.status==='completed'?meta:null;});
  assert.equal(done.mode,'static-visual');
  assert.deepEqual(calls,[{target,scriptsDisabled:true}]);
  const report=await(await fetch(base+'/api/runs/'+id+'/report')).json();
  assert.equal(report.scripts_executed,false);
  assert.equal(report.application_render_status,'not-executed');
  const inspection=await(await fetch(base+'/api/runs/'+id+'/inspection')).json();
  assert.equal(inspection.scripts_executed,false);
  const page=await(await fetch(base+'/')).text();
  assert.match(page,/value="static-visual"/);
 }finally{await new Promise(ok=>app.server.close(ok));}
});

test('P4 static-visual capture persists isolated reconstruction once and serves it with non-executing CSP',async()=>{
 const testPort=await freePort(),root=join(home,'p4-reconstruction');
 const target='https://owner.example.org/geometry';let launched=0;
 const blueprint={source:'p4-geometry',viewport:{width:1440,height:900},document:{height:900},
  body_color:'rgb(245, 246, 252)',candidates:4,
  boxes:[{tag:'aside',depth:1,x:0,y:0,w:190,h:900,background:'rgb(255, 255, 255)',radius:'0px',border_width:'0px'}],
  titles:[{tag:'h1',x:230,y:50,w:300,h:40,text:'대시보드',font_size:'24px',font_weight:'700',color:'rgb(31, 31, 46)'}]};
 const app=createStudioServer({studioPort:testPort,fixturePort,storageDir:root,browserPath:'/test/chrome',approvedUrls:[target],
  dynamicExecutor:async({scriptsDisabled})=>{
   launched++;assert.equal(scriptsDisabled,true);
   return {report:{verdict:'PASS',analysis_mode:'static-visual',screenshot_saved:false,failures:[]},
    inspection:{mode:'static-visual',page:{reconstruction_blueprint:blueprint},network:[]}};
  }});
 await app.init();await new Promise(ok=>app.server.listen(testPort,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+testPort;
 try{
  const submitted=await fetch(base+'/api/runs',{method:'POST',
    headers:{Origin:base,'Content-Type':'application/json'},
    body:JSON.stringify({target_url:target,analysis_mode:'static-visual'})});
  assert.equal(submitted.status,202);
  const id=(await submitted.json()).id;
  await until(async()=>{const x=await (await fetch(base+'/api/runs/'+id)).json();return x.status==='completed';});
  const report=await (await fetch(base+'/api/runs/'+id+'/report')).json();
  assert.equal(report.reconstruction_available,true);
  const response=await fetch(base+'/api/runs/'+id+'/reconstruction');
  assert.equal(response.status,200);
  assert.match(response.headers.get('content-type'),/^text\/html/);
  assert.match(response.headers.get('content-security-policy'),/script-src 'none'/);
  assert.match(response.headers.get('content-security-policy'),/connect-src 'none'/);
  const html=await response.text();
  assert.match(html,/대시보드/);
  assert.match(html,/width:190px;height:900px/);
  assert.doesNotMatch(html,/<script\b|https?:\/\//);
  assert.equal(launched,1);
  await fetch(base+'/api/runs/'+id+'/reconstruction');
  assert.equal(launched,1);
  const fx=await app.store.create({target_url:expected(),mode:'rea-browser'});
  assert.equal((await fetch(base+'/api/runs/'+fx.id+'/reconstruction')).status,404);
  assert.equal((await fetch(base+'/api/runs/00000000-0000-4000-8000-000000000000/reconstruction')).status,404);
 }finally{await new Promise(ok=>app.server.close(ok));}
});
test('P4 UI exposes isolated reconstruction link while retaining original screenshot viewer',async()=>{
 const html=await(await fetch(url+'/')).text();
 const app=await(await fetch(url+'/app.js')).text();
 assert.match(html,/id="p4-panel"/);
 assert.match(html,/id="open-reconstruction"/);
 assert.match(html,/id="open-screenshot"/);
 assert.match(app,/reconstruction_available/);
 assert.match(app,/\/reconstruction/);
});

test('P5 local replay compares images once, persists JSON and image, and never fetches external hosts',async()=>{
 const p=await freePort(),root=join(home,'p5-comparison'),target='https://owner.example.org/p5';
 const palette=[20,40,60],w=24,h=16;
 const rows=[];
 for(let y=0;y<h;y++){
  const row=Buffer.alloc(1+w*3);row[0]=0;
  for(let x=0;x<w;x++)for(let channel=0;channel<3;channel++)row[1+x*3+channel]=palette[channel];
  rows.push(row);
 }
 const chunk=(type,buf)=>{const hd=Buffer.alloc(8);hd.writeUInt32BE(buf.length);hd.write(type,4);
  return Buffer.concat([hd,buf,Buffer.alloc(4)]);};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;
 const png=Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ihdr),
  chunk('IDAT',deflateSync(Buffer.concat(rows))),chunk('IEND',Buffer.alloc(0))]);
 let initialCalls=0,replayCalls=0;
 const geometry={source:'p4-geometry',viewport:{width:1440,height:900},document:{height:900},
  body_color:'rgb(245, 246, 252)',
  boxes:[{tag:'aside',depth:2,x:0,y:0,w:190,h:900,background:'rgb(255, 255, 255)',radius:'0px',border_width:'0px'}],
  titles:[{tag:'h1',x:200,y:30,w:300,h:40,text:'대시보드',font_size:'24px',font_weight:'700',color:'rgb(10, 10, 20)'}]};
 const studio=createStudioServer({studioPort:p,fixturePort,storageDir:root,browserPath:'/test/chrome',approvedUrls:[target],
  dynamicExecutor:async({dir,scriptsDisabled})=>{
   initialCalls++;assert.equal(scriptsDisabled,true);
   await writeFile(join(dir,'screenshot.png'),png);
   return {report:{verdict:'PASS',analysis_mode:'static-visual',screenshot_saved:true,failures:[]},
    inspection:{mode:'static-visual',page:{reconstruction_blueprint:geometry}}};
  },
  replayExecutor:async({target:requested,dir,relay,scriptsDisabled})=>{
   replayCalls++;assert.equal(requested,target);assert.equal(scriptsDisabled,true);
   const response=await relay(target);assert.match(response.body.toString(),/대시보드/);
   await assert.rejects(()=>relay('https://malicious.example.net/'),/P5_OFF_SCOPE/);
   await writeFile(join(dir,'screenshot.png'),png);
   return {report:{verdict:'PASS',screenshot_saved:true}};
  }});
 await studio.init();await new Promise(ok=>studio.server.listen(p,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+p;
 try{
  const posted=await fetch(base+'/api/runs',{method:'POST',
   headers:{Origin:base,'Content-Type':'application/json'},
   body:JSON.stringify({target_url:target,analysis_mode:'static-visual'})});
  assert.equal(posted.status,202);
  const id=(await posted.json()).id;
  await until(async()=>{const meta=await(await fetch(base+'/api/runs/'+id)).json();return meta.status==='completed';});
  const report=await(await fetch(base+'/api/runs/'+id+'/report')).json();
  assert.equal(report.reconstruction_available,true);
  assert.equal(report.visual_comparison_available,true);
  assert.equal(report.visual_comparison_status,'measured');
  assert.equal(report.visual_comparison_match_pct,100);
  const metricsResponse=await fetch(base+'/api/runs/'+id+'/comparison');
  assert.equal(metricsResponse.status,200);
  const metrics=await metricsResponse.json();
  assert.equal(metrics.pixel_match_pct,100);
  assert.equal(metrics.rgb_mae,0);
  assert.equal(metrics.status,'measured-not-certified');
  const replica=await fetch(base+'/api/runs/'+id+'/reconstruction-screenshot');
  assert.equal(replica.status,200);
  assert.equal(replica.headers.get('content-type'),'image/png');
  assert.deepEqual(Buffer.from(await replica.arrayBuffer()),png);
  await fetch(base+'/api/runs/'+id+'/comparison');
  await fetch(base+'/api/runs/'+id+'/reconstruction-screenshot');
  assert.equal(initialCalls,1);
  assert.equal(replayCalls,1);
  const nonexistent='00000000-0000-4000-8000-000000000000';
  assert.equal((await fetch(base+'/api/runs/'+nonexistent+'/comparison')).status,404);
  assert.equal((await fetch(base+'/api/runs/'+nonexistent+'/reconstruction-screenshot')).status,404);
 }finally{await new Promise(ok=>studio.server.close(ok));}
});
test('P5 comparison views are present in local Studio UI',async()=>{
 const html=await(await fetch(url+'/')).text();
 const app=await(await fetch(url+'/app.js')).text();
 assert.match(html,/id="p5-comparison"/);
 assert.match(html,/id="p5-replica"/);
 assert.match(app,/visual_comparison_available/);
 assert.match(app,/\/reconstruction-screenshot/);
});
