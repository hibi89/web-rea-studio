import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer as netServer} from 'node:net';
import {makeStore} from '../studio/core.mjs';
import {createStudioServer} from '../studio/server.mjs';
import {reviewAnonymousLayout,readAcceptanceReceipt,ACCEPTANCE_FILENAME}
 from '../studio/f3-q1-acceptance.mjs';
const mode='dynamic-passive';
function data(){
 const inspection={mode,screen_capture:{width:1440,height:900},
  page:{frontend_blueprint:{source:'computed-dom',viewport:{w:1440,h:900}},
   interaction_inventory:{source:'passive-controls',verification:'presence-only',
    actions_executed:0,counts:{total:3},controls:[
     {kind:'button',label:'SECRET_ABC',rect:{x:50,y:70,width:180,height:34}},
     {kind:'link',label:'SECRET_ABC',rect:{x:1030,y:180,width:210,height:34}},
     {kind:'input',type:'password',value:'SECRET_ABC',rect:{x:420,y:610,width:220,height:34}}
    ]}},
  network:[{kind:'fetch-attempt',scope:'other-origin',host:'secret.example.org'},
   {kind:'fetch-rejected',scope:'other-origin',host:'secret.example.org'}]};
 return {mode,inspection,report:{analysis_mode:mode,verdict:'FAIL',
  fetch_attempts:1,fetch_rejections:1,screenshot_width:1440,screenshot_height:900},
  diagnosis:{diagnosis:'PASSIVE_EXTERNAL_FETCH_REJECTED'}};
}
async function setup(){
 const root=await mkdtemp(join(tmpdir(),'rea-acceptance-test-'));
 const store=makeStore(root);await store.init();
 const meta=await store.create({target_url:'https://owner.test.example/',mode});
 const {inspection,report}=data();await store.saveInspection(meta.id,inspection);
 await store.saveReport(meta.id,report);await store.update(meta.id,{status:'failed'});
 return {root,store,id:meta.id};
}
function fake({wrong=false,fail=false}={}){
 let n=0;return {get calls(){return n},run:async({target,relay,offlineViewport,scriptsDisabled,observeAnonymousLayout})=>{
  n++;assert.equal(scriptsDisabled,true);assert.equal(observeAnonymousLayout,true);
  const body=await relay(target);assert.match(body.body.toString(),/NOT A REPLICA/);
  const width=offlineViewport.width,isMobile=width===390;
  if(isMobile&&fail)throw Error('CHROME_FAIL');
  const columns=isMobile?(wrong?3:1):3;
  const left=isMobile?12:20,unit=isMobile?366:300;
  return {report:{verdict:'PASS',scripts_executed:false,
   fetch_attempts:0,fetch_rejections:0,resource_blocked:0,
   screenshot_width:width,screenshot_height:isMobile?1087:900},
   inspection:{page:{interaction_inventory:{controls:[]},offline_anonymous_layout:{
    viewport:width,document_client_width:width,document_scroll_width:width,
    computed_grid_columns:columns,grid:[left,130,isMobile?366:948,1200],
    zone_count:9,native_controls:0,
    zones:Array.from({length:9},(_,i)=>[left+(i%columns)*(unit+12),
     150+Math.floor(i/columns)*125,unit,112])
   }}}};
 }};
}
test('two successfully replayed synthetic views yield write-once evidence-bound receipt',async()=>{
 const {root,store,id}=await setup(),runner=fake();
 try{
  const p=await reviewAnonymousLayout({store,id,...data(),browserPath:'fake',
   replayExecutor:runner.run});
  assert.equal(runner.calls,2);assert.equal(p.status,'VERIFIED_SYNTHETIC_LAYOUT_ONLY');
  assert.deepEqual(p.views.map(x=>x.columns),[3,1]);
  assert.equal(p.permission_status,'NOT_APPROVED');
  assert.equal(p.original_site_parity_verified,false);
  assert.equal(p.html_sha256.length,64);assert.equal(p.evidence_sha256.length,64);
  assert.equal((await readAcceptanceReceipt({store,id,...data()})).status,p.status);
  assert.doesNotMatch(JSON.stringify(p),/SECRET_ABC|secret.example.org/);
  await assert.rejects(reviewAnonymousLayout({store,id,...data(),
   browserPath:'fake',replayExecutor:runner.run}),e=>e.code==='EEXIST');
 }finally{await rm(root,{recursive:true,force:true});}
});
test('failed second Chrome or wrong mobile columns never produce positive receipts',async()=>{
 for(const opts of [{wrong:true},{fail:true}]){
  const {root,store,id}=await setup(),runner=fake(opts);
  try{
   await assert.rejects(reviewAnonymousLayout({store,id,...data(),
    browserPath:'fake',replayExecutor:runner.run}));
   assert.equal(await readAcceptanceReceipt({store,id,...data()}),null);
   await assert.rejects(readFile(join(store.pathFor(id),ACCEPTANCE_FILENAME)),e=>e.code==='ENOENT');
  }finally{await rm(root,{recursive:true,force:true});}
 }
});
test('tampered source and stored receipt are read as conflict, never verified',async()=>{
 const {root,store,id}=await setup(),runner=fake();
 try{
  await reviewAnonymousLayout({store,id,...data(),browserPath:'fake',replayExecutor:runner.run});
  const changed=data();changed.inspection.page.interaction_inventory.controls[0].rect.x=88;
  assert.equal((await readAcceptanceReceipt({store,id,...changed})).status,'EVIDENCE_CONFLICT');
  const path=join(store.pathFor(id),ACCEPTANCE_FILENAME);
  const receipt=JSON.parse(await readFile(path,'utf8'));
  receipt.views[1].columns=3;await writeFile(path,JSON.stringify(receipt));
  assert.equal((await readAcceptanceReceipt({store,id,...data()})).status,'EVIDENCE_CONFLICT');
 }finally{await rm(root,{recursive:true,force:true});}
});
async function port(){const s=netServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
test('Studio POST confirmation is mandatory; GET repeated never runs Chrome',async()=>{
 const root=await mkdtemp(join(tmpdir(),'rea-acceptance-http-'));
 const p=await port(),base='http://127.0.0.1:'+p;
 let calls=0,release;const holding=new Promise(ok=>{release=ok});
 const app=createStudioServer({studioPort:p,fixturePort:4317,storageDir:root,
  approvedUrls:['https://owner.test.example/'],
  anonymousAcceptanceExecutor:async args=>{
   calls++;await holding;return reviewAnonymousLayout({...args,browserPath:'fake',
    replayExecutor:fake().run});
  }});
 try{
  await app.init();
  const meta=await app.store.create({target_url:'https://owner.test.example/',mode});
  const d=data();await app.store.saveInspection(meta.id,d.inspection);
  await app.store.saveReport(meta.id,d.report);await app.store.update(meta.id,{status:'failed'});
  await new Promise(ok=>app.server.listen(p,'127.0.0.1',ok));
  const end=base+'/api/runs/'+meta.id+'/f3-q1-layout-acceptance';
  const post=(body,headers={})=>fetch(end,{method:'POST',
   headers:{Origin:base,'Content-Type':'application/json',...headers},
   body:JSON.stringify(body)});
  assert.equal((await fetch(end)).status,404);
  assert.equal((await post({confirm:'invalid'})).status,400);
  assert.equal((await post({confirm:'offline-anonymous-layout-review',extra:true})).status,400);
  assert.equal((await post({confirm:'offline-anonymous-layout-review'},{Origin:'http://evil.test'})).status,403);
  assert.equal((await post({confirm:'offline-anonymous-layout-review'})).status,202);
  assert.equal((await fetch(end)).status,202);
  assert.equal((await post({confirm:'offline-anonymous-layout-review'})).status,409);
  assert.equal(calls,1);release();
  let receipt;
  for(let i=0;i<80;i++){
   const r=await fetch(end);
   if(r.status===200){receipt=await r.json();break;}
   await new Promise(ok=>setTimeout(ok,20));
  }
  assert.equal(receipt?.status,'VERIFIED_SYNTHETIC_LAYOUT_ONLY');
  await fetch(end);await fetch(end);assert.equal(calls,1);
  assert.equal((await post({confirm:'offline-anonymous-layout-review'})).status,409);
  assert.doesNotMatch(JSON.stringify(receipt),/SECRET_ABC|secret.example.org/);
  const page=await(await fetch(base+'/')).text(),js=await(await fetch(base+'/app.js')).text();
  assert.match(page,/run-f3-q1-layout-acceptance/);
  assert.match(js,/offline-anonymous-layout-review/);
 }finally{release?.();await new Promise(ok=>app.server.close(ok));await rm(root,{recursive:true,force:true});}
});
