import test from 'node:test';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer as netServer} from 'node:net';
import {createStudioServer} from '../studio/server.mjs';

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildEvidenceManifest} from '../studio/evidence-manifest.mjs';
import {buildObservedFeatureGraph,markObservedFeatureGraphVerified} from '../studio/behavior-exploration.mjs';
import {generateGenericBehaviorHtml} from '../studio/generic-behavior.mjs';
import {auditSavedControlledChain} from '../studio/controlled-chain-audit.mjs';

export function syntheticChainFixture(){
 const initial={category:'all',count:8,layout:'grid'};
 const steps=[
  {id:'filter',label:'카테고리 변경',action:'click',status:'completed',
   attribution:'controlled-single-action-window',before:initial,
   after:{category:'summer',count:3,layout:'grid'},
   changed_fields:['category','count'],request_count:1,endpoint_paths:['/api/items']},
  {id:'layout',label:'목록 표시',action:'click',status:'completed',
   attribution:'controlled-single-action-window',
   before:{category:'summer',count:3,layout:'grid'},
   after:{category:'summer',count:3,layout:'list'},
   changed_fields:['layout'],request_count:0,endpoint_paths:[]},
  {id:'layout',label:'목록 표시',action:'click',status:'completed',
   attribution:'controlled-single-action-window',before:initial,
   after:{category:'all',count:8,layout:'list'},
   changed_fields:['layout'],request_count:0,endpoint_paths:[]}
 ];
 const evidence={source:'controlled-generic-chrome',scope:'synthetic-only',
  verification:'real-isolated-chrome',app_id:'catalog',title:'상품 목록 실험',
  initial,steps,observed_action_api_links:1};
 const planned=buildObservedFeatureGraph(evidence);
 const graph=markObservedFeatureGraphVerified(planned,{
  source:'controlled-generic-replay',scope:'synthetic-only',actual_api_calls:0,
  verified_steps:planned.metrics.planned_clicks,
  observed_edge_coverage:planned.edges.length,
  verified_route_ids:planned.coverage_routes.map(r=>r.id)
 });
 const report={verdict:'PASS',synthetic_fixture_only:true,
  analysis_mode:'fixture-generic-catalog',feature_graph_available:true,
  feature_graph_source:'observed-controlled-synthetic-only',
  generic_prototype_available:true,generic_replay_verified_steps:3,
  generic_replay_real_api_calls:0,generic_branch_paths:2,
  generic_schema_version:2,feature_graph_verified_edges:3,
  feature_graph_routes:2,feature_graph_states:4,
  feature_graph_planned_clicks:3,unauthorized_actions_executed:0,
  action_policy_checked:true,evidence_manifest_available:true};
 const inspection={schema_version:5,mode:'fixture-generic-catalog',
  scope:'controlled-fixture-only',page:{title:evidence.title,private_token:'SUPER_PRIVATE'},
  exploration:{source:'controlled-fixture-scenario',execution:'controlled-only',
   permission_policy:{source:'controlled-action-audit',
    scope:'in-memory-synthetic-only',authorized_controls:3,denied_controls:4,
    unauthorized_actions_executed:0,external_navigation_performed:false},
   actions_observed:3,successful_steps:3,verified_action_api_links:1,
   feature_graph_summary:{source:'observed-function-graph',scope:'controlled-synthetic-only',
    state_count:4,edge_count:3,coverage_routes:2,verified_replay_steps:3,
    relationships:graph.relationships},
   observed_endpoint_paths:['/api/items'],
   state_transitions:{source:'controlled-fixture-state-diff',steps:steps.map(s=>({
    step_id:s.id,action:'click',status:'completed',
    changed:s.changed_fields.map(field=>({field,from:s.before[field],to:s.after[field]}))
   }))},
   steps:steps.map(s=>({step_id:s.id,action:'click',status:'completed'}))}
 };
 const meta={mode:'fixture-generic-catalog',status:'completed',
  target_url:'https://SECRET-ORIGIN.example.org/?key=SUPER_PRIVATE'};
 const manifest=buildEvidenceManifest(inspection,report);
 const html=generateGenericBehaviorHtml(evidence);
 return {meta,report,inspection,manifest,graph,html,evidence};
}

test('saved F1/F2/F3/F4/F5 synthetic records are cross-checked without new replay',()=>{
 const result=auditSavedControlledChain(syntheticChainFixture());
 assert.equal(result.status,'SYNTHETIC_SAVED_CHAIN_CONSISTENT',JSON.stringify(result));
 assert.equal(result.stages.f3_manifest.status,'VERIFIED');
 assert.equal(result.stages.f2_graph.status,'VERIFIED');
 assert.equal(result.stages.f4_independent_app.status,'VERIFIED');
 assert.equal(result.stages.f5_replay_claim.status,'CONSISTENT_SAVED_CLAIM');
 assert.deepEqual(result.counts,{states:4,edges:3,routes:2});
 assert.equal(result.replay_independently_reexecuted,false);
 assert.equal(result.network_requests_issued,0);
 assert.equal(result.product_ready,false);
 assert.doesNotMatch(JSON.stringify(result),/SUPER_PRIVATE|SECRET-ORIGIN|상품 목록|\/api\/items|<script/i);
});

test('tampered F3 manifest, F2 graph, F4 HTML and F5 counters are rejected',()=>{
 const a=syntheticChainFixture();a.manifest.controls.total=500;
 const b=syntheticChainFixture();b.graph.edges[0].to='s19';
 const c=syntheticChainFixture();c.html+='<!-- untrusted -->';
 const d=syntheticChainFixture();d.report.generic_replay_verified_steps=99;
 const e=syntheticChainFixture();e.graph.verification.routes_verified=99;
 for(const v of [a,b,c,d,e]){
  const result=auditSavedControlledChain(v);
  assert.equal(result.status,'EVIDENCE_CONFLICT',JSON.stringify(result));
  assert.ok(Object.values(result.stages).some(s=>s.status==='CONFLICT'));
  assert.equal(result.network_requests_issued,0);
  assert.equal(result.product_ready,false);
 }
});

test('missing F4/manifest or unapproved run never passes chain',()=>{
 const missing=syntheticChainFixture();missing.html=null;
 assert.equal(auditSavedControlledChain(missing).status,'EVIDENCE_CONFLICT');
 const missingManifest=syntheticChainFixture();missingManifest.manifest=null;
 assert.equal(auditSavedControlledChain(missingManifest).status,'EVIDENCE_CONFLICT');
 for(const mode of ['dynamic-passive','static-visual','fixture-causal']){
  const data=syntheticChainFixture();data.meta.mode=mode;
  assert.equal(auditSavedControlledChain(data).status,'INCOMPLETE');
 }
 const failed=syntheticChainFixture();failed.meta.status='failed';
 assert.equal(auditSavedControlledChain(failed).status,'INCOMPLETE');
 const denied=syntheticChainFixture();denied.inspection.exploration.permission_policy.unauthorized_actions_executed=1;
 assert.equal(auditSavedControlledChain(denied).status,'INCOMPLETE');
});

test('Studio exposes repeated read-only cross-stage audit, no Chrome or network, and rejects other modes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'rea-chain-audit-test-'));
 const node=netServer();await new Promise((ok,bad)=>node.once('error',bad).listen(0,'127.0.0.1',ok));
 const port=node.address().port;await new Promise(ok=>node.close(ok));
 let browserCalls=0;
 const studio=createStudioServer({studioPort:port,storageDir:root,
  genericObserver:async()=>{browserCalls++;throw Error('UNEXPECTED_OBSERVATION');},
  genericVerifier:async()=>{browserCalls++;throw Error('UNEXPECTED_REPLAY');}});
 try{
  await studio.init();
  await new Promise((ok,bad)=>studio.server.once('error',bad).listen(port,'127.0.0.1',ok));
  const data=syntheticChainFixture();
  const meta=await studio.store.create({mode:data.meta.mode,target_url:data.meta.target_url});
  await studio.store.update(meta.id,{status:'completed'});
  await studio.store.saveReport(meta.id,data.report);
  await studio.store.saveInspection(meta.id,data.inspection);
  await studio.store.saveManifest(meta.id,data.manifest);
  await writeFile(join(studio.store.pathFor(meta.id),'function-graph.json'),JSON.stringify(data.graph));
  await writeFile(join(studio.store.pathFor(meta.id),'generic-prototype.html'),data.html);
  const api='http://127.0.0.1:'+port+'/api/runs/'+meta.id+'/controlled-chain-audit';
  for(let i=0;i<3;i++){
   const res=await fetch(api);
   assert.equal(res.status,200);
   assert.match(res.headers.get('content-disposition'),/attachment/);
   const body=await res.text(),obj=JSON.parse(body);
   assert.equal(obj.status,'SYNTHETIC_SAVED_CHAIN_CONSISTENT',body);
   assert.equal(obj.replay_independently_reexecuted,false);
   assert.doesNotMatch(body,/SUPER_PRIVATE|SECRET-ORIGIN|<script|\/api\/items/);
  }
  const origin='http://127.0.0.1:'+port;
  const pair=origin+'/api/runs/'+meta.id;
  const receipt=await(await fetch(pair+'/delivery-receipt')).json();
  assert.equal(receipt.export_eligible,true,JSON.stringify(receipt));
  assert.equal(receipt.analysis_scope,'controlled-synthetic-only');
  assert.equal(receipt.product_ready,false);
  assert.equal(receipt.original_api_or_backend_parity,false);
  assert.equal(receipt.evidence.synthetic_replay,'SAVED_CLAIM_CONSISTENT_NO_FRESH_REPLAY');
  assert.equal(receipt.artifact.sha256,createHash('sha256').update(data.html).digest('hex'));
  const download=await fetch(pair+'/reviewed-export');
  assert.equal(download.status,200);
  assert.match(download.headers.get('content-disposition'),/attachment/);
  assert.match(download.headers.get('content-security-policy'),/connect-src 'none'/);
  const served=await download.text();
  assert.equal(served,data.html);
  assert.equal(createHash('sha256').update(served).digest('hex'),receipt.artifact.sha256);
  await writeFile(join(studio.store.pathFor(meta.id),'generic-prototype.html'),data.html+'<!-- mismatch -->');
  assert.equal((await fetch(pair+'/reviewed-export')).status,409);
  assert.equal((await(await fetch(pair+'/delivery-receipt')).json()).export_eligible,false);
  await writeFile(join(studio.store.pathFor(meta.id),'generic-prototype.html'),data.html);
  assert.equal(browserCalls,0);
  const fetchedHtml=await(await fetch('http://127.0.0.1:'+port+'/')).text();
  assert.match(fetchedHtml,/id="download-controlled-chain-audit"/);
  assert.match(fetchedHtml,/id="download-reviewed-export"/);
  assert.match(fetchedHtml,/id="download-delivery-receipt"/);
  const f4Js=await(await fetch('http://127.0.0.1:'+port+'/app.js')).text();
  assert.match(f4Js,/controlled-chain-audit/);
  const invalidMode=await studio.store.create({mode:'dynamic-passive',target_url:'https://example.invalid'});
  await studio.store.update(invalidMode.id,{status:'completed'});
  assert.equal((await fetch('http://127.0.0.1:'+port+'/api/runs/'+invalidMode.id+'/controlled-chain-audit')).status,404);
  assert.equal((await fetch(origin+'/api/runs/'+invalidMode.id+'/reviewed-export')).status,404);
  const pending=await studio.store.create({mode:data.meta.mode,target_url:data.meta.target_url});
  assert.equal((await fetch('http://127.0.0.1:'+port+'/api/runs/'+pending.id+'/controlled-chain-audit')).status,409);
  assert.equal((await fetch(origin+'/api/runs/'+pending.id+'/delivery-receipt')).status,409);
  assert.equal(browserCalls,0);
  assert.equal((await studio.store.get(meta.id)).status,'completed');
 }finally{
  if(studio.server.listening)await new Promise(ok=>studio.server.close(ok));
  await rm(root,{recursive:true,force:true});
 }
});

test('normal Studio POST builds F1/F2 graph, F3 manifest and F4 HTML, then offline GET cross-checks actual saved artifacts',async()=>{
 const root=await mkdtemp(join(tmpdir(),'rea-chain-real-pipeline-'));
 const node=netServer();await new Promise((ok,bad)=>node.once('error',bad).listen(0,'127.0.0.1',ok));
 const port=node.address().port;await new Promise(ok=>node.close(ok));
 const fixture=syntheticChainFixture();
 let observations=0,replays=0;
 const studio=createStudioServer({studioPort:port,fixturePort:4317,storageDir:root,
  genericObserver:async({appId})=>{
   assert.equal(appId,'catalog');observations++;
   return {...fixture.evidence,execution_policy:{
    source:'controlled-action-audit',scope:'in-memory-synthetic-only',
    authorized_controls:3,denied_controls:4,
    unauthorized_actions_executed:0,external_navigation_performed:false,
    form_submissions_performed:0,approved_action_ids:['reset','filter','layout']}};
  },
  genericVerifier:async({evidence,html})=>{
   replays++;
   assert.equal(evidence.app_id,'catalog');
   assert.equal(html,fixture.html);
   return {source:'controlled-generic-replay',scope:'synthetic-only',
    verified_steps:3,actual_api_calls:0,simulated_api_calls:1,branching:true,
    observed_edge_coverage:3,verified_route_ids:['route0','route1']};
  }});
 try{
  await studio.init();
  await new Promise((ok,bad)=>studio.server.once('error',bad).listen(port,'127.0.0.1',ok));
  const origin='http://127.0.0.1:'+port;
  const submitted=await fetch(origin+'/api/runs',{method:'POST',
   headers:{Origin:origin,'Content-Type':'application/json'},
   body:JSON.stringify({target_url:'http://127.0.0.1:4317/',analysis_mode:'fixture-generic-catalog'})});
  assert.equal(submitted.status,202);
  const {id}=await submitted.json();
  let saved=null;
  for(let i=0;i<130;i++){
   saved=await studio.store.get(id);
   if(['completed','failed'].includes(saved?.status))break;
   await new Promise(ok=>setTimeout(ok,20));
  }
  assert.equal(saved?.status,'completed',JSON.stringify(saved));
  assert.equal(observations,1);assert.equal(replays,1);
  const response=await fetch(origin+'/api/runs/'+id+'/controlled-chain-audit');
  assert.equal(response.status,200);
  const audit=await response.json();
  assert.equal(audit.status,'SYNTHETIC_SAVED_CHAIN_CONSISTENT',JSON.stringify(audit));
  assert.equal(audit.stages.f4_independent_app.status,'VERIFIED');
  assert.equal(audit.replay_independently_reexecuted,false);
  assert.equal(observations,1,'GET audit must never repeat observations');
  assert.equal(replays,1,'GET audit must never repeat Chrome replay');
 }finally{
  if(studio.server.listening)await new Promise(ok=>studio.server.close(ok));
  await rm(root,{recursive:true,force:true});
 }
});
