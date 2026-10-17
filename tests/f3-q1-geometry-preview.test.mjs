import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer as tcpServer} from 'node:net';
import {buildAnonymousGeometryPreview} from '../studio/f3-q1-geometry-preview.mjs';
import {createStudioServer} from '../studio/server.mjs';

const mode='dynamic-passive',SECRET='SECRET_01_PRIVATE';
function saved(){
 const controls=[
  {kind:'button',label:SECRET,rect:{x:40,y:85,width:170,height:40}},
  {kind:'input',type:'password',value:SECRET,rect:{x:800,y:160,width:200,height:45}},
  {kind:'link',label:SECRET,navigation:'offsite',rect:{x:260,y:580,width:220,height:36}}
 ];
 return {mode,page:{frontend_blueprint:{source:'computed-dom',viewport:{w:1440,h:900}},
  interaction_inventory:{source:'passive-controls',verification:'presence-only',
   actions_executed:0,counts:{total:3,buttons:1,inputs:1,links:1},controls}},
  screen_capture:{width:1440,height:900},
  network:[
   {kind:'fetch-attempt',scope:'other-origin',host:'private-data.example.org'},
   {kind:'fetch-rejected',scope:'other-origin',host:'private-data.example.org'}
  ]};
}
const report=()=>({analysis_mode:mode,verdict:'FAIL',
 fetch_attempts:1,fetch_rejections:1,application_fetch_error_visible:true,
 screenshot_width:1440,screenshot_height:900});
const diagnosis={diagnosis:'PASSIVE_EXTERNAL_FETCH_REJECTED'};
test('only consistent actual passive rectangles yield anonymous 3x3 zones',()=>{
 const x=buildAnonymousGeometryPreview({mode,inspection:saved(),report:report(),diagnosis});
 assert.equal(x.status,'OFFLINE_COARSE_GEOMETRY_PREVIEW');
 assert.equal(x.receipt.observed_controls,3);
 assert.equal(x.receipt.coarse_distribution.reduce((n,z)=>n+z.count,0),3);
 assert.equal(x.receipt.geometry_precision,'3x3-bins-only-no-pixel-coordinates');
 assert.equal(x.receipt.original_mobile_behavior_verified,false);
 assert.equal(x.receipt.sha256,createHash('sha256').update(x.html).digest('hex'));
 assert.match(x.html,/@media\(max-width:640px\)/);
 assert.match(x.html,/Zone 1/);
 assert.doesNotMatch(x.html,/<(?:button|input|a|form|script|textarea|select|iframe)\b/i);
 assert.doesNotMatch(x.html,/https?:\/\/|href\s*=|action\s*=|url\s*\(|@import/);
 assert.doesNotMatch(JSON.stringify(x),/SECRET_01_PRIVATE|private-data|1440|580|800/);
});
test('missing viewport, count conflict, rectangle overflow and report disagreement refuse HTML',()=>{
 const cases=[
  s=>{delete s.page.frontend_blueprint;},
  s=>{s.page.frontend_blueprint.viewport.w=700;},
  s=>{s.screen_capture.width=900;},
  s=>{s.page.interaction_inventory.verification='probe-unavailable';},
  s=>{s.page.interaction_inventory.counts.total=2;},
  s=>{s.page.interaction_inventory.controls[0].rect.x=-40;},
  s=>{s.page.interaction_inventory.controls[1].rect.x=1360;},
  s=>{s.page.interaction_inventory.controls[0].kind='not-a-control';},
  s=>{s.page.interaction_inventory.controls.pop();}
 ];
 for(const mutate of cases){
  const evidence=saved();mutate(evidence);
  const out=buildAnonymousGeometryPreview({mode,inspection:evidence,report:report(),diagnosis});
  assert.equal(out.status,'BLOCKED');assert.equal(out.html,null);assert.equal(out.receipt.sha256,null);
 }
 const mismatch=buildAnonymousGeometryPreview({mode,inspection:saved(),
  report:{...report(),screenshot_width:1300},diagnosis});
 assert.equal(mismatch.status,'BLOCKED');
 const conflict=buildAnonymousGeometryPreview({mode,inspection:saved(),
  report:{...report(),fetch_attempts:0},diagnosis});
 assert.equal(conflict.status,'BLOCKED');
 assert.throws(()=>buildAnonymousGeometryPreview({mode:'fixture-generic-planner',inspection:saved(),report:report()}),
  /F3_Q1_GEOMETRY_SCOPE_DENIED/);
});
async function port(){
 const s=tcpServer();await new Promise(ok=>s.listen(0,'127.0.0.1',ok));
 const n=s.address().port;await new Promise(ok=>s.close(ok));return n;
}
test('local saved-only HTTP preview/download/receipt repeat safely; no recapture',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'rea-coarse-geometry-'));
 const p=await port(),base='http://127.0.0.1:'+p;
 const target='https://owner-fixture.example.org/approved';
 let executions=0;
 const app=createStudioServer({studioPort:p,fixturePort:4317,storageDir:folder,
  approvedUrls:[target],dynamicExecutor:async()=>{
   executions++;return {inspection:saved(),report:report()};
  }});
 try{
  await app.init();await new Promise(ok=>app.server.listen(p,'127.0.0.1',ok));
  const created=await fetch(base+'/api/runs',{method:'POST',
   headers:{Origin:base,'Content-Type':'application/json'},
   body:JSON.stringify({target_url:target,analysis_mode:mode})});
  assert.equal(created.status,202);const id=(await created.json()).id;
  let state;
  for(let i=0;i<140;i++){
   state=await(await fetch(base+'/api/runs/'+id)).json();
   if(state.status==='failed')break;
   await new Promise(ok=>setTimeout(ok,20));
  }
  assert.equal(state.status,'failed');
  const url=base+'/api/runs/'+id+'/f3-q1-geometry-preview';
  const a=await fetch(url),b=await fetch(url+'-download'),c=await fetch(url+'-receipt');
  assert.equal(a.status,200);assert.equal(b.status,200);assert.equal(c.status,200);
  assert.match(a.headers.get('content-security-policy'),/sandbox/);
  assert.match(a.headers.get('content-security-policy'),/connect-src 'none'/);
  assert.match(a.headers.get('content-disposition'),/inline/);
  assert.match(b.headers.get('content-disposition'),/attachment/);
  const html=await a.text(),download=await b.text(),receipt=await c.json();
  assert.equal(html,download);
  assert.equal(receipt.sha256,createHash('sha256').update(html).digest('hex'));
  assert.equal(executions,1);
  assert.equal((await fetch(url)).status,200);
  assert.equal(executions,1);
  assert.doesNotMatch(html,/owner-fixture|private-data|SECRET_01_PRIVATE/);
  const other=await app.store.create({mode:'fixture-generic-planner',target_url:'http://127.0.0.1:4317/'});
  assert.equal((await fetch(base+'/api/runs/'+other.id+'/f3-q1-geometry-preview')).status,404);
  const missing=await app.store.create({mode,target_url:target});
  await app.store.update(missing.id,{status:'failed'});
  assert.equal((await fetch(base+'/api/runs/'+missing.id+'/f3-q1-geometry-preview')).status,404);
  const unavailable=await app.store.create({mode,target_url:target});
  await app.store.saveInspection(unavailable.id,{mode});
  await app.store.update(unavailable.id,{status:'failed'});
  assert.equal((await fetch(base+'/api/runs/'+unavailable.id+'/f3-q1-geometry-preview')).status,409);
  assert.equal((await fetch(base+'/api/runs/'+unavailable.id+'/f3-q1-geometry-preview-download')).status,409);
  const home=await(await fetch(base+'/')).text(),js=await(await fetch(base+'/app.js')).text();
  assert.match(home,/open-f3-q1-geometry-preview/);
  assert.match(js,/f3-q1-geometry-preview/);
 }finally{await new Promise(ok=>app.server.close(ok));await rm(folder,{recursive:true,force:true});}
});
