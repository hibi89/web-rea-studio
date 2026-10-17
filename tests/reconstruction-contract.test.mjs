import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {generateGenericBehaviorHtml} from '../studio/generic-behavior.mjs';
import {buildObservedFeatureGraph,markObservedFeatureGraphVerified} from '../studio/behavior-exploration.mjs';
import {compileObservedStateContract,compileF3LinkedReconstructionContract,
 matchesStoredReconstructionContract} from '../studio/reconstruction-contract.mjs';

function caseData(appId='planner'){
 const p=appId==='planner';
 const initial=p?{day:'monday',layout:'list',slots:4}:
  appId==='catalog'?{category:'all',count:8,layout:'grid'}:{chart:'bar',range:'week',total:12};
 const one=p?{...initial,day:'tuesday',slots:2}:
  appId==='catalog'?{...initial,category:'summer',count:3}:{...initial,range:'month',total:31};
 const two={...one,layout:p?'grid':undefined};
 if(!p)delete two.layout;
 if(!p)Object.assign(two,appId==='catalog'?{layout:'list'}:{chart:'line'});
 const alternate=p?{...initial,layout:'grid'}:
  appId==='catalog'?{...initial,layout:'list'}:{...initial,chart:'line'};
 const a=p?'next':appId==='catalog'?'filter':'range';
 const b=p?'layout':appId==='catalog'?'layout':'chart';
 const endpoint=p?'/api/calendar':appId==='catalog'?'/api/items':'/api/metrics';
 const edge=(id,before,after,request_count=0)=>({
  id,label:id==='next'?'다음 날짜':id==='filter'?'필터':id==='range'?'기간':'표시 전환',
  action:'click',status:'completed',attribution:'controlled-single-action-window',
  before,after,changed_fields:Object.keys(before).sort().filter(k=>before[k]!==after[k]),
  request_count,endpoint_paths:request_count?[endpoint]:[]
 });
 const evidence={source:'controlled-generic-chrome',scope:'synthetic-only',
  verification:'real-isolated-chrome',app_id,title:p?'일정 관리 실험':'목록 및 차트 실험',
  initial,observed_action_api_links:1,
  steps:[edge(a,initial,one,1),edge(b,one,two),edge(b,initial,alternate)]};
 const planned=buildObservedFeatureGraph(evidence);
 const replay={source:'controlled-generic-replay',scope:'synthetic-only',actual_api_calls:0,
  verified_steps:planned.metrics.planned_clicks,observed_edge_coverage:planned.edges.length,
  verified_route_ids:planned.coverage_routes.map(r=>r.id),
  simulated_api_calls:1,unobserved_transitions_rejected:5};
 const verifiedGraph=markObservedFeatureGraphVerified(planned,replay);
 const html=generateGenericBehaviorHtml(evidence);
 const manifest={schema_version:1,kind:'evidence-manifest',
  analysis_mode:`fixture-generic-${appId}`,evidence_scope:'controlled-local-fixture',
  network:{attribution_scope:'controlled-synthetic-only',causal_links_verified:1},
  generated_artifacts:{generic_branching_prototype:true,verified_feature_graph:true,
   interaction_verification_scope:'synthetic-only'},
  findings:[{id:'observed-function-graph',status:'verified-synthetic-only'}],
  controlled_scenario:{feature_graph:{verification_scope:'controlled-synthetic-only',
   unique_states:planned.states.length,observed_edges:planned.edges.length,
   verified_routes:planned.coverage_routes.length,replay_steps:replay.verified_steps},
   permission_policy:{scope:'in-memory-synthetic-only',unauthorized_actions_executed:0}}};
 return {evidence,verifiedGraph,replay,html,manifest};
}
test('third unseen synthetic schema compiles to the exact same generic F4 engine',()=>{
 const input=caseData('planner');
 const c=compileObservedStateContract(input);
 assert.equal(c.app_id,'planner');assert.equal(c.state_fields.length,3);
 assert.equal(c.transitions.length,3);assert.equal(c.actions.length,2);
 assert.equal(c.replay.verified_edges,3);assert.equal(c.backend.real_endpoint_calls,0);
 assert.equal(c.product_ready,false);
 assert.equal(c.executable_html_sha256,createHash('sha256').update(input.html).digest('hex'));
 assert.match(input.html,/id="state-slots"/);
 assert.match(input.html,/id="action-next"/);
 assert.doesNotMatch(input.html,/fetch\\s*\\(|XMLHttpRequest|<iframe/);
 assert.throws(()=>compileF3LinkedReconstructionContract(input),/F4_CONTRACT_EVIDENCE_MISMATCH/);
});
for(const id of ['catalog','analytics']){
 test(`F1/F2→F3→F4 contract binds verified ${id} chain`,()=>{
  const input=caseData(id),c=compileF3LinkedReconstructionContract(input);
  assert.equal(c.f3.verification,'cross-stage-consistent-synthetic-only');
  assert.equal(c.replay.verified_routes,2);
  assert.equal(c.replay.rejected_unobserved_events,5);
  assert.equal(c.unknowns.includes('original_backend'),true);
  assert.equal(matchesStoredReconstructionContract(c,input),true);
  assert.equal(matchesStoredReconstructionContract(c,{...input,html:input.html+' '}),false);
  assert.equal(matchesStoredReconstructionContract(c,{...input,manifest:{...input.manifest,network:{}}}),false);
  assert.equal(matchesStoredReconstructionContract(c,{...input,verifiedGraph:{...input.verifiedGraph,states:[]}}),false);
  for(const modified of [
   {...input,html:'<html>fake</html>'},
   {...input,verifiedGraph:{...input.verifiedGraph,edges:[]}},
   {...input,replay:{...input.replay,simulated_api_calls:2}},
   {...input,manifest:{...input.manifest,analysis_mode:'dynamic-passive'}},
   {...input,manifest:{...input.manifest,network:{causal_links_verified:9,attribution_scope:'controlled-synthetic-only'}}},
   {...input,manifest:{...input.manifest,controlled_scenario:{...input.manifest.controlled_scenario,permission_policy:{unauthorized_actions_executed:1}}}}
  ])assert.throws(()=>compileF3LinkedReconstructionContract(modified));
 });
}
test('unverified or sensitive source is never promoted to runnable F4',()=>{
 const x=caseData('planner');
 assert.throws(()=>compileObservedStateContract({...x,evidence:{...x.evidence,source:'real-unapproved-site'}}));
 assert.throws(()=>compileObservedStateContract({...x,evidence:{...x.evidence,initial:{...x.evidence.initial,token:'private'}}}));
 assert.throws(()=>compileObservedStateContract({...x,replay:{...x.replay,actual_api_calls:1}}));
 assert.throws(()=>compileObservedStateContract({...x,replay:{...x.replay,unobserved_transitions_rejected:0}}));
});
