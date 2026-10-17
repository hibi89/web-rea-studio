import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer as tcpServer} from 'node:net';
import {planF3Q1Work} from '../studio/f3-q1-work-plan.mjs';
import {createStudioServer} from '../studio/server.mjs';
const mode='dynamic-passive';
const secret='SECRET_PLAN_ONLY';
function inspection(){
 return {mode,scope:'explicit-https-allowlist',
  page:{interaction_inventory:{source:'passive-controls',controls:[
   {kind:'button',label:secret,rect:{x:0,y:0,width:80,height:25}},
   {kind:'input',type:'password',value:secret,rect:{x:0,y:50,width:80,height:25}},
   {kind:'link',label:'Private '+secret,navigation:'offsite',rect:{x:0,y:85,width:80,height:25}}
  ]}},
  network:[
   {kind:'requested',path:'/',status:200},{kind:'fulfilled',path:'/',status:200},
   {kind:'fetch-attempt',scope:'other-origin',host:'private-api.example.org',url:'https://private-api.example.org/private?token='+secret},
   {kind:'fetch-rejected',scope:'other-origin',host:'private-api.example.org'}]};
}
const report=(attempts=1,rejections=1)=>({analysis_mode:mode,verdict:'FAIL',
 fetch_attempts:attempts,fetch_rejections:rejections,resource_requests:1,
 resource_fulfilled:1,resource_blocked:0,application_fetch_error_visible:true});
const diagnosis={diagnosis:'PASSIVE_EXTERNAL_FETCH_REJECTED'};
test('F3/Q1 plan prioritizes only evidence-backed, non-executable UI presence outlines',()=>{
 const p=planF3Q1Work({mode,inspection:inspection(),report:report(),diagnosis});
 assert.equal(p.status,'UI_PRESENCE_PLANNING_ONLY');
 assert.equal(p.overall_decision,'BLOCK_REAL_SITE_RECONSTRUCTION');
 assert.equal(p.permission_status,'NOT_APPROVED');
 assert.equal(p.counts.plannable_offline,3);
 assert.equal(p.counts.review_required,1);
 assert.deepEqual(p.items.filter(x=>x.status==='PLANNABLE_OFFLINE_ONLY').map(x=>x.id),
  ['presence-plan-button','presence-plan-link','presence-plan-input']);
 assert.deepEqual(p.items.filter(x=>x.status==='PLANNABLE_OFFLINE_ONLY').map(x=>x.observed_controls),
  [1,1,1]);
 for(const id of ['verify-real-action-transitions','verify-control-api-links',
  'specify-response-fields','backend-and-database','external-api-permission',
  'prove-original-parity']){
  const x=p.items.find(t=>t.id===id);assert.equal(x.status,'BLOCKED');assert.equal(x.verified_implementation,false);
 }
 assert.equal(p.output_constraints.html_generated,false);
 assert.equal(p.output_constraints.real_api_used,false);
 assert.equal(p.output_constraints.source_requests_issued,0);
 assert.equal(p.output_constraints.product_ready,false);
 for(const privateValue of [secret,'private-api','/?token','/private'])
  assert.ok(!JSON.stringify(p).includes(privateValue),'leak '+privateValue);
});
test('incomplete or contradicting evidence blocks any UI planning as well as real reconstruction',()=>{
 const bad=planF3Q1Work({mode,inspection:inspection(),report:report(0,1),diagnosis});
 assert.equal(bad.status,'EVIDENCE_CONFLICT');
 assert.equal(bad.counts.plannable_offline,0);
 assert.equal(bad.next_step,'RECONCILE_SAVED_EVIDENCE_BEFORE_PLANNING');
 const empty=planF3Q1Work({mode,inspection:{mode},report:report(3,3),diagnosis});
 assert.equal(empty.status,'INSUFFICIENT_EVIDENCE');
 assert.equal(empty.counts.plannable_offline,0);
 assert.ok(empty.items.some(t=>t.id==='presence-plan-unavailable'&&t.status==='BLOCKED'));
 for(const args of [{mode:'fixture-generic-planner',inspection:inspection(),report:report()},
  {mode,inspection:{mode:'static-visual'},report:report()},
  {mode,inspection:inspection(),report:{...report(),analysis_mode:'static-html'}}])
  assert.throws(()=>planF3Q1Work(args),/F3_Q1_PLAN_SCOPE_DENIED/);
});
async function freePort(){const s=tcpServer();await new Promise(ok=>s.listen(0,'127.0.0.1',ok));const p=s.address().port;await new Promise(ok=>s.close(ok));return p;}
test('saved failed-run plan endpoint is repeatable and non-executing; other modes/states denied',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'rea-f3-q1-plan-'));
 const port=await freePort(),base='http://127.0.0.1:'+port;
 const origin='https://approved-site.example.org/';
 let captures=0;
 const server=createStudioServer({studioPort:port,fixturePort:4317,storageDir:dir,
  approvedUrls:[origin],dynamicExecutor:async()=>{captures++;return {report:report(),inspection:inspection()};}});
 try{
  await server.init();await new Promise(ok=>server.server.listen(port,'127.0.0.1',ok));
  const r=await fetch(base+'/api/runs',{method:'POST',
   headers:{Origin:base,'Content-Type':'application/json'},
   body:JSON.stringify({target_url:origin,analysis_mode:mode})});
  assert.equal(r.status,202);const id=(await r.json()).id;
  let state;for(let i=0;i<160;i++){state=await(await fetch(base+'/api/runs/'+id)).json();if(state.status==='failed')break;await new Promise(ok=>setTimeout(ok,20));}
  assert.equal(state.status,'failed');
  const url=base+'/api/runs/'+id+'/f3-q1-work-plan';
  const a=await fetch(url);assert.equal(a.status,200);
  assert.match(a.headers.get('content-disposition'),/attachment.*json/);
  const p=await a.json();assert.equal(p.status,'UI_PRESENCE_PLANNING_ONLY');
  for(let i=0;i<3;i++)assert.deepEqual(await(await fetch(url)).json(),p);
  assert.equal(captures,1);
  const good=await server.store.create({mode,target_url:origin});await server.store.update(good.id,{status:'completed'});
  assert.equal((await fetch(base+'/api/runs/'+good.id+'/f3-q1-work-plan')).status,409);
  const other=await server.store.create({mode:'fixture-generic-planner',target_url:'http://127.0.0.1:4317/'});
  assert.equal((await fetch(base+'/api/runs/'+other.id+'/f3-q1-work-plan')).status,404);
  const missing=await server.store.create({mode,target_url:origin});await server.store.update(missing.id,{status:'failed'});
  assert.equal((await fetch(base+'/api/runs/'+missing.id+'/f3-q1-work-plan')).status,404);
  const html=await(await fetch(base+'/')).text(),js=await(await fetch(base+'/app.js')).text();
  assert.match(html,/download-f3-q1-work-plan/);assert.match(js,/\/f3-q1-work-plan/);
  assert.doesNotMatch(JSON.stringify(p),/approved-site|private-api|SECRET_PLAN_ONLY/);
 }finally{await new Promise(ok=>server.server.close(ok));await rm(dir,{recursive:true,force:true});}
});
