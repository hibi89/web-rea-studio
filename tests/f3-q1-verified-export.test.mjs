import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer as netServer} from 'node:net';
import {createStudioServer} from '../studio/server.mjs';
import {buildAnonymousGeometryPreview} from '../studio/f3-q1-geometry-preview.mjs';
import {reviewAnonymousLayout,ACCEPTANCE_FILENAME} from '../studio/f3-q1-acceptance.mjs';

const mode='dynamic-passive',approved='https://owner-fixture.example.org/';
const secret='PRIVATE_FORM_VALUE_999';
function evidence(){
 const inspection={mode,screen_capture:{width:1440,height:900},
  page:{frontend_blueprint:{source:'computed-dom',viewport:{w:1440,h:900}},
   interaction_inventory:{source:'passive-controls',verification:'presence-only',
    actions_executed:0,counts:{total:3},controls:[
     {kind:'button',label:secret,rect:{x:50,y:70,width:180,height:34}},
     {kind:'link',label:secret,rect:{x:1030,y:180,width:210,height:34}},
     {kind:'input',value:secret,rect:{x:420,y:610,width:220,height:34}}
    ]}},
  network:[{kind:'fetch-attempt',scope:'other-origin',host:'private.example.org'},
   {kind:'fetch-rejected',scope:'other-origin',host:'private.example.org'}]};
 const report={analysis_mode:mode,verdict:'FAIL',fetch_attempts:1,fetch_rejections:1,
  screenshot_width:1440,screenshot_height:900};
 return {inspection,report,mode,diagnosis:{diagnosis:'PASSIVE_EXTERNAL_FETCH_REJECTED'}};
}
const sha=s=>createHash('sha256').update(s).digest('hex');
function fakeChrome(){
 let n=0;
 const run=async({target,relay,offlineViewport,scriptsDisabled,observeAnonymousLayout})=>{
  n++;assert.equal(scriptsDisabled,true);assert.equal(observeAnonymousLayout,true);
  const response=await relay(target);
  assert.match(response.body.toString(),/NOT A REPLICA/);
  const width=offlineViewport.width,mobile=width===390,cols=mobile?1:3;
  const left=mobile?12:20,unit=mobile?366:300;
  return {report:{verdict:'PASS',scripts_executed:false,fetch_attempts:0,
   fetch_rejections:0,resource_blocked:0,screenshot_width:width,
   screenshot_height:mobile?1087:900},
   inspection:{page:{interaction_inventory:{controls:[]},
    offline_anonymous_layout:{viewport:width,document_client_width:width,
     document_scroll_width:width,computed_grid_columns:cols,
     grid:[left,130,mobile?366:948,1200],zone_count:9,native_controls:0,
     zones:Array.from({length:9},(_,i)=>[
      left+(i%cols)*(unit+12),150+Math.floor(i/cols)*125,unit,112])
    }}}};
 };
 return {run,get calls(){return n}};
}
async function port(){const s=netServer();await new Promise(ok=>s.listen(0,'127.0.0.1',ok));const p=s.address().port;await new Promise(ok=>s.close(ok));return p;}
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'rea-verified-export-'));
 const p=await port(),base='http://127.0.0.1:'+p,chrome=fakeChrome();
 let directCapture=0;
 const app=createStudioServer({studioPort:p,fixturePort:4317,storageDir:root,
  approvedUrls:[approved],dynamicExecutor:async()=>{directCapture++;throw Error('NEVER_CAPTURE');},
  anonymousAcceptanceExecutor:async args=>reviewAnonymousLayout({
   ...args,browserPath:'fake',replayExecutor:chrome.run})});
 await app.init();
 const ev=evidence(),meta=await app.store.create({mode,target_url:approved});
 await app.store.saveInspection(meta.id,ev.inspection);
 await app.store.saveReport(meta.id,ev.report);
 await app.store.update(meta.id,{status:'failed'});
 await new Promise(ok=>app.server.listen(p,'127.0.0.1',ok));
 return {root,base,app,meta,chrome,get captures(){return directCapture},
  close:async()=>{await new Promise(ok=>app.server.close(ok));await rm(root,{force:true,recursive:true});}};
}
test('verified-only export is blocked when not run; unsupported statuses and modes never leak HTML',async()=>{
 const f=await fixture(),url=f.base+'/api/runs/'+f.meta.id+'/f3-q1-verified-offline-export';
 try{
  const missing=await fetch(url);assert.equal(missing.status,404);
  assert.match(missing.headers.get('content-type'),/application\/json/);
  assert.equal(f.chrome.calls,0);
  const completed=await f.app.store.create({mode,target_url:approved});
  await f.app.store.update(completed.id,{status:'completed'});
  assert.equal((await fetch(f.base+'/api/runs/'+completed.id+'/f3-q1-verified-offline-export')).status,409);
  const synthetic=await f.app.store.create({mode:'fixture-generic-planner',target_url:'http://127.0.0.1:4317/'});
  assert.equal((await fetch(f.base+'/api/runs/'+synthetic.id+'/f3-q1-verified-offline-export')).status,404);
  const noInspection=await f.app.store.create({mode,target_url:approved});
  await f.app.store.update(noInspection.id,{status:'failed'});
  assert.equal((await fetch(f.base+'/api/runs/'+noInspection.id+'/f3-q1-verified-offline-export')).status,404);
 }finally{await f.close();}
});
test('accepted two Chrome views unlock exact SHA HTML bytes while repeated download remains read-only',async()=>{
 const f=await fixture(),url=f.base+'/api/runs/'+f.meta.id+'/f3-q1-verified-offline-export';
 try{
  const post=await fetch(f.base+'/api/runs/'+f.meta.id+'/f3-q1-layout-acceptance',{
   method:'POST',headers:{Origin:f.base,'Content-Type':'application/json'},
   body:JSON.stringify({confirm:'offline-anonymous-layout-review'})});
  assert.equal(post.status,202);
  let r;for(let i=0;i<100;i++){
   r=await fetch(url);if(r.status===200)break;
   await new Promise(ok=>setTimeout(ok,20));
  }
  assert.equal(r.status,200);
  const html=await r.text(),ev=evidence();
  const expected=buildAnonymousGeometryPreview(ev);
  assert.equal(html,expected.html);
  assert.equal(sha(html),expected.receipt.sha256);
  assert.equal(r.headers.get('x-rea-html-sha256'),sha(html));
  assert.equal(r.headers.get('x-rea-verification-scope'),'synthetic-offline-only');
  assert.match(r.headers.get('content-disposition'),/attachment.*verified-synthetic-offline-only/);
  assert.match(r.headers.get('content-security-policy'),/script-src 'none'/);
  assert.match(r.headers.get('content-security-policy'),/connect-src 'none'/);
  assert.match(r.headers.get('content-security-policy'),/sandbox/);
  assert.doesNotMatch(html,/PRIVATE_FORM_VALUE_999|private.example.org/);
  assert.doesNotMatch(html,/<(?:script|button|input|form|a)\b/i);
  for(let i=0;i<4;i++){
   const next=await fetch(url);
   assert.equal(next.status,200);assert.equal(await next.text(),html);
  }
  assert.equal(f.chrome.calls,2);assert.equal(f.captures,0);
  const page=await(await fetch(f.base+'/')).text(),js=await(await fetch(f.base+'/app.js')).text();
  assert.match(page,/download-f3-q1-verified-offline-export/);
  assert.match(js,/f3-q1-verified-offline-export/);
 }finally{await f.close();}
});
test('tampering the accepted receipt or stored source blocks verified export, but preserves general preview',async()=>{
 const f=await fixture(),root=f.app.store.pathFor(f.meta.id),url=f.base+'/api/runs/'+f.meta.id+'/f3-q1-verified-offline-export';
 try{
  const accepted=await fetch(f.base+'/api/runs/'+f.meta.id+'/f3-q1-layout-acceptance',{
   method:'POST',headers:{Origin:f.base,'Content-Type':'application/json'},
   body:JSON.stringify({confirm:'offline-anonymous-layout-review'})});
  assert.equal(accepted.status,202);
  let first;
  for(let i=0;i<100;i++){
   first=await fetch(url);
   if(first.status===200)break;
   await new Promise(ok=>setTimeout(ok,20));
  }
  assert.equal(first.status,200);
  const path=join(root,ACCEPTANCE_FILENAME);
  const original=JSON.parse(await readFile(path,'utf8'));
  await writeFile(path,JSON.stringify({...original,views:[
   original.views[0],{...original.views[1],columns:3}]}));
  const denied=await fetch(url);
  assert.equal(denied.status,409);
  assert.match(denied.headers.get('content-type'),/json/);
  assert.equal((await fetch(f.base+'/api/runs/'+f.meta.id+'/f3-q1-geometry-preview-download')).status,200);
  await writeFile(path,JSON.stringify(original));
  const report={...evidence().report,resource_requests:42};
  await f.app.store.saveReport(f.meta.id,report);
  assert.equal((await fetch(url)).status,409);
  assert.equal(f.chrome.calls,2);
 }finally{await f.close();}
});
