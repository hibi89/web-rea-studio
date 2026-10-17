import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer as tcpServer} from 'node:net';
import {assessF3Q1Readiness} from '../studio/f3-q1-readiness.mjs';
import {createStudioServer} from '../studio/server.mjs';

const scope='dynamic-passive';
const secret='SECRET_PRIVATE_API_ROUTE';
function observation(host='api.private-source.example.org'){
 return {mode:scope,scope:'explicit-https-allowlist',
  page:{interaction_inventory:{source:'passive-controls',
   controls:[{kind:'button',label:'Customer '+secret,rect:{x:12,y:18,width:110,height:36}},
    {kind:'input',type:'password',value:secret,rect:{x:12,y:58,width:110,height:30}}]}},
  network:[
   {kind:'requested',path:'/',status:200},
   {kind:'fulfilled',path:'/',status:200},
   {kind:'fetch-attempt',scope:'other-origin',host,url:'https://'+host+'/'+secret+'?token='+secret},
   {kind:'fetch-rejected',scope:'other-origin',host},
   {kind:'xhr-open',scope:'other-origin',host:'other.example.org'}
  ]};
}
function failure(fetch_attempts=1,fetch_rejections=1){
 return {analysis_mode:scope,verdict:'FAIL',fetch_attempts,fetch_rejections,
  resource_requests:1,resource_fulfilled:1,resource_blocked:0,
  application_fetch_error_visible:true};
}
const diagnosis={diagnosis:'PASSIVE_EXTERNAL_FETCH_REJECTED'};
test('F3-Q1 joins bounded source/UI gaps and existing denial with no data exposure',()=>{
 const x=assessF3Q1Readiness({mode:scope,inspection:observation(),report:failure(),diagnosis});
 assert.equal(x.kind,'rea-f3-q1-offline-reconstruction-readiness');
 assert.equal(x.decision,'BLOCK_REAL_SITE_RECONSTRUCTION');
 assert.equal(x.network_decision,'BLOCK_NETWORK_EXPANSION');
 assert.equal(x.permission_status,'NOT_APPROVED');
 assert.equal(x.offline_structure_planning,'OBSERVED_UI_CATEGORIES_ONLY');
 assert.equal(x.evidence.observed_ui_controls,2);
 assert.equal(x.evidence.saved_external_groups,2);
 assert.equal(x.evidence.saved_origin_groups,1);
 assert.equal(x.evidence.matched_host_candidates_count,1);
 assert.equal(x.evidence.fetch_rejections_reported,1);
 assert.equal(x.evidence.integrity,'BOUNDED_SAVED_OBSERVATIONS');
 assert.equal(x.evidence.q1_local_policy_finding,'LOCAL_POLICY_BOUNDARY_COMPATIBLE_NOT_CAUSAL');
 assert.deepEqual(x.evidence.conflicts,[]);
 assert.ok(x.evidence.authorization_missing_fields.includes('allowed_methods'));
 assert.ok(x.unresolved_gap_ids.includes('response-field-schema'));
 assert.equal(x.execution.network_requests_issued,0);
 assert.equal(x.execution.product_ready,false);
 const output=JSON.stringify(x);
 for(const t of [secret,'private-source','other.example.org','/?token=','/api/'])
  assert.ok(!output.includes(t),'leaked '+t);
});
test('Q1 count conflicts and incomplete passive evidence never result in readiness',()=>{
 const conflicting=assessF3Q1Readiness({
  mode:scope,inspection:observation(),report:failure(0,1),diagnosis});
 assert.equal(conflicting.evidence.integrity,'CONFLICTING_SAVED_OBSERVATIONS');
 assert.equal(conflicting.offline_structure_planning,'INSUFFICIENT_OR_CONFLICTING_EVIDENCE');
 assert.ok(conflicting.evidence.conflicts.includes('Q1_EVIDENCE_CONFLICT'));
 const partial=assessF3Q1Readiness({
  mode:scope,inspection:{mode:scope},report:failure(3,3),diagnosis});
 assert.equal(partial.evidence.integrity,'PARTIAL_SAVED_OBSERVATIONS');
 assert.equal(partial.evidence.observed_ui_controls,0);
 assert.equal(partial.evidence.matched_host_candidates_count,0);
 assert.equal(partial.permission_status,'NOT_APPROVED');
 for(const args of [{mode:'fixture-generic-planner',inspection:observation(),report:failure()},
  {mode:scope,inspection:{mode:'static-html'},report:failure()},
  {mode:scope,inspection:observation(),report:{...failure(),analysis_mode:'static-visual'}}])
  assert.throws(()=>assessF3Q1Readiness(args),/F3_Q1_SCOPE_DENIED/);
});
async function port(){
 const s=tcpServer();await new Promise(ok=>s.listen(0,'127.0.0.1',ok));
 const p=s.address().port;await new Promise(ok=>s.close(ok));return p;
}
test('Q1/F3 HTTP GET refuses unsupported runs and reuses same saved failed run without Chrome',async()=>{
 const root=await mkdtemp(join(tmpdir(),'f3-q1-readiness-'));
 const number=await port(),base='http://127.0.0.1:'+number;
 let executions=0;
 const target='https://private-approved.example.org/';
 const app=createStudioServer({studioPort:number,fixturePort:4317,storageDir:root,
  approvedUrls:[target],dynamicExecutor:async()=>{
   executions++;return {report:failure(),inspection:observation()};
  }});
 try{
  await app.init();
  await new Promise(ok=>app.server.listen(number,'127.0.0.1',ok));
  const created=await fetch(base+'/api/runs',{method:'POST',
   headers:{Origin:base,'Content-Type':'application/json'},
   body:JSON.stringify({target_url:target,analysis_mode:scope})});
  assert.equal(created.status,202);
  const id=(await created.json()).id;
  for(let i=0;i<150;i++){
   const meta=await(await fetch(base+'/api/runs/'+id)).json();
   if(meta.status==='failed')break;
   await new Promise(ok=>setTimeout(ok,25));
  }
  const url=base+'/api/runs/'+id+'/f3-q1-readiness';
  const r=await fetch(url);assert.equal(r.status,200);
  assert.match(r.headers.get('content-disposition'),/attachment.*json/);
  const body=await r.json();
  assert.equal(body.decision,'BLOCK_REAL_SITE_RECONSTRUCTION');
  assert.equal(body.permission_status,'NOT_APPROVED');
  assert.equal(body.execution.browser_launched,false);
  for(let i=0;i<2;i++)assert.deepEqual(await(await fetch(url)).json(),body);
  assert.equal(executions,1);
  assert.doesNotMatch(JSON.stringify(body),/private-approved|private-source|SECRET_PRIVATE/);
  const good=await app.store.create({target_url:target,mode:scope});
  await app.store.update(good.id,{status:'completed'});
  assert.equal((await fetch(base+'/api/runs/'+good.id+'/f3-q1-readiness')).status,409);
  const other=await app.store.create({target_url:'http://127.0.0.1:4317/',mode:'fixture-generic-planner'});
  assert.equal((await fetch(base+'/api/runs/'+other.id+'/f3-q1-readiness')).status,404);
  const missing=await app.store.create({target_url:target,mode:scope});
  await app.store.update(missing.id,{status:'failed'});
  assert.equal((await fetch(base+'/api/runs/'+missing.id+'/f3-q1-readiness')).status,404);
  const html=await(await fetch(base+'/')).text(),js=await(await fetch(base+'/app.js')).text();
  assert.match(html,/download-f3-q1-readiness/);
  assert.match(js,/\/f3-q1-readiness/);
 }finally{await new Promise(ok=>app.server.close(ok));await rm(root,{recursive:true,force:true});}
});
