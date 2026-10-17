import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer as tcpServer} from 'node:net';
import {buildPassiveWireframe,PASSIVE_WIREFRAME_CSP} from '../studio/f3-q1-wireframe.mjs';
import {createStudioServer} from '../studio/server.mjs';
const mode='dynamic-passive',secret='SUPER_SECRET_SOURCE';
function observation(){
 return {mode,scope:'explicit-https-allowlist',page:{
  interaction_inventory:{source:'passive-controls',controls:[
   {kind:'button',label:secret,rect:{x:3,y:5,width:80,height:30}},
   {kind:'link',label:'see '+secret,rect:{x:3,y:50,width:80,height:30}},
   {kind:'input',type:'password',value:secret,rect:{x:3,y:100,width:80,height:30}}
  ]}},network:[
  {kind:'requested',path:'/',status:200},{kind:'fulfilled',path:'/',status:200},
  {kind:'fetch-attempt',scope:'other-origin',host:'secret-api.example.org',url:'https://secret-api.example.org/'+secret},
  {kind:'fetch-rejected',scope:'other-origin',host:'secret-api.example.org'}]};
}
const report=(fetch_attempts=1,fetch_rejections=1)=>({
 analysis_mode:mode,verdict:'FAIL',fetch_attempts,fetch_rejections,
 resource_requests:1,resource_fulfilled:1,resource_blocked:0,application_fetch_error_visible:true});
const diagnosis={diagnosis:'PASSIVE_EXTERNAL_FETCH_REJECTED'};
test('wireframe only uses category counts, no browser controls, scripts, URLs or secrets',()=>{
 const a=buildPassiveWireframe({mode,inspection:observation(),report:report(),diagnosis});
 const b=buildPassiveWireframe({mode,inspection:observation(),report:report(),diagnosis});
 assert.equal(a.status,'OFFLINE_NONINTERACTIVE_PREVIEW');
 assert.deepEqual(a,b);
 assert.deepEqual(a.receipt.categories.map(x=>[x.category,x.count]),
  [['button',1],['link',1],['input',1]]);
 assert.equal(a.receipt.original_site_look_and_feel_verified,false);
 assert.equal(a.receipt.chrome_render_verified_by_this_receipt,false);
 assert.equal(a.receipt.permission_status,'NOT_APPROVED');
 assert.equal(a.receipt.sha256,createHash('sha256').update(a.html).digest('hex'));
 assert.equal(a.receipt.bytes,Buffer.byteLength(a.html));
 assert.match(a.html,/<!doctype html>/);
 assert.match(a.html,/Noninteractive, offline synthetic placeholder/);
 assert.match(PASSIVE_WIREFRAME_CSP,/connect-src 'none'/);
 assert.match(PASSIVE_WIREFRAME_CSP,/sandbox/);
 assert.doesNotMatch(a.html,/<(?:script|form|button|input|select|textarea|iframe|a)(?:\s|>)/i);
 assert.doesNotMatch(a.html,/https?:\/\/|(?:src|href|action)\s*=|url\s*\(|@import/);
 assert.doesNotMatch(JSON.stringify(a),/SUPER_SECRET_SOURCE|secret-api|\/\w+PRIVATE/);
});
test('missing or inconsistent evidence blocks HTML generation, not merely labels',()=>{
 const conflict=buildPassiveWireframe({mode,inspection:observation(),report:report(0,1),diagnosis});
 assert.equal(conflict.status,'BLOCKED');assert.equal(conflict.html,null);
 assert.equal(conflict.receipt.sha256,null);
 const noControls=buildPassiveWireframe({mode,inspection:{mode},report:report(),diagnosis});
 assert.equal(noControls.status,'BLOCKED');assert.equal(noControls.html,null);
 for(const x of [
  {mode:'fixture-generic-planner',inspection:observation(),report:report()},
  {mode,inspection:{mode:'static-visual'},report:report()},
  {mode,inspection:observation(),report:{...report(),analysis_mode:'static-visual'}}
 ])assert.throws(()=>buildPassiveWireframe(x),/F3_WIREFRAME_SCOPE_DENIED/);
});
async function freePort(){
 const s=tcpServer();await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));
 const p=s.address().port;await new Promise(resolve=>s.close(resolve));return p;
}
test('Studio wireframe inline/download/receipt derive identical saved evidence without recapture',async()=>{
 const root=await mkdtemp(join(tmpdir(),'rea-anon-wireframe-'));
 const port=await freePort(),base='http://127.0.0.1:'+port;
 const target='https://offline-owner.example.org/approved';
 let captures=0;
 const app=createStudioServer({studioPort:port,fixturePort:4317,storageDir:root,
  approvedUrls:[target],dynamicExecutor:async()=>{
   captures++;return {report:report(),inspection:observation()};
  }});
 try{
  await app.init();await new Promise(resolve=>app.server.listen(port,'127.0.0.1',resolve));
  const response=await fetch(base+'/api/runs',{method:'POST',
   headers:{Origin:base,'Content-Type':'application/json'},
   body:JSON.stringify({target_url:target,analysis_mode:mode})});
  assert.equal(response.status,202);const id=(await response.json()).id;
  let run;
  for(let i=0;i<160;i++){
   run=await(await fetch(base+'/api/runs/'+id)).json();
   if(run.status==='failed')break;
   await new Promise(resolve=>setTimeout(resolve,20));
  }
  assert.equal(run.status,'failed');
  const basePath=base+'/api/runs/'+id;
  const inline=await fetch(basePath+'/f3-q1-wireframe');
  const download=await fetch(basePath+'/f3-q1-wireframe-download');
  const receipt=await fetch(basePath+'/f3-q1-wireframe-receipt');
  for(const r of [inline,download,receipt])assert.equal(r.status,200);
  assert.match(inline.headers.get('content-type'),/text\/html/);
  assert.match(inline.headers.get('content-security-policy'),/connect-src 'none'/);
  assert.match(inline.headers.get('content-security-policy'),/sandbox/);
  assert.match(inline.headers.get('content-disposition'),/inline/);
  assert.match(download.headers.get('content-disposition'),/attachment/);
  const html=await inline.text(),file=await download.text(),info=await receipt.json();
  assert.equal(html,file);
  assert.equal(info.sha256,createHash('sha256').update(html).digest('hex'));
  assert.equal(captures,1);
  assert.equal((await fetch(basePath+'/f3-q1-wireframe')).status,200);
  assert.equal(captures,1);
  assert.doesNotMatch(html,/offline-owner|secret-api|SUPER_SECRET_SOURCE/);
  const completed=await app.store.create({mode,target_url:target});
  await app.store.update(completed.id,{status:'completed'});
  assert.equal((await fetch(base+'/api/runs/'+completed.id+'/f3-q1-wireframe')).status,409);
  const synthetic=await app.store.create({mode:'fixture-generic-planner',target_url:'http://127.0.0.1:4317/'});
  assert.equal((await fetch(base+'/api/runs/'+synthetic.id+'/f3-q1-wireframe')).status,404);
  const absent=await app.store.create({mode,target_url:target});
  await app.store.update(absent.id,{status:'failed'});
  assert.equal((await fetch(base+'/api/runs/'+absent.id+'/f3-q1-wireframe')).status,404);
  const htmlPage=await(await fetch(base+'/')).text();
  const js=await(await fetch(base+'/app.js')).text();
  assert.match(htmlPage,/open-f3-q1-wireframe/);
  assert.match(htmlPage,/download-f3-q1-wireframe/);
  assert.match(js,/\/f3-q1-wireframe/);
 }finally{await new Promise(resolve=>app.server.close(resolve));await rm(root,{recursive:true,force:true});}
});
