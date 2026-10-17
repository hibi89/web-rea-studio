import test from 'node:test';
import assert from 'node:assert/strict';
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
 return {meta,report,inspection,manifest,graph,html};
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
