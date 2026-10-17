import test from 'node:test';
import assert from 'node:assert/strict';
import {buildObservedFeatureGraph,markObservedFeatureGraphVerified} from '../studio/behavior-exploration.mjs';
function fixture(id='catalog'){
 const analytics=id==='analytics';
 const initial=analytics?{chart:'bar',range:'week',total:12}:{category:'all',count:8,layout:'grid'};
 const filtered=analytics?{...initial,range:'month',total:31}:{...initial,category:'summer',count:3};
 const full=analytics?{...filtered,chart:'line'}:{...filtered,layout:'list'};
 const alternative=analytics?{...initial,chart:'line'}:{...initial,layout:'list'};
 const names=analytics?['range','chart']:['filter','layout'];
 const endpoints=analytics?'/api/metrics':'/api/items';
 const step=(id,label,before,after,request_count=0)=>({
  id,label,before,after,status:'completed',action:'click',
  attribution:'controlled-single-action-window',request_count,
  endpoint_paths:request_count?[endpoints]:[],
  changed_fields:Object.keys(before).sort().filter(k=>before[k]!==after[k])
 });
 return {source:'controlled-generic-chrome',scope:'synthetic-only',
  verification:'real-isolated-chrome',app_id:id,title:analytics?'분석 대시보드 실험':'상품 목록 실험',
  initial,observed_action_api_links:1,
  steps:[
   step(names[0],'기간·필터 변경',initial,filtered,1),
   step(names[1],'보기 변경',filtered,full),
   step(names[1],'보기 변경',initial,alternative)
  ]};
}
test('F1 shortest routes and observed edge-cover give 100% evidence-scoped coverage',()=>{
 const plan=buildObservedFeatureGraph(fixture());
 assert.equal(plan.kind,'observed-function-graph');
 assert.equal(plan.scope,'controlled-synthetic-only');
 assert.equal(plan.metrics.unique_states,4);
 assert.equal(plan.metrics.observed_transitions,3);
 assert.equal(plan.metrics.action_kinds,2);
 assert.equal(plan.metrics.api_linked_transitions,1);
 assert.equal(plan.metrics.route_count,2);
 assert.equal(plan.metrics.planned_clicks,3);
 assert.equal(plan.metrics.coverage_of_observed_edges_pct,100);
 assert.deepEqual(plan.test_cases.map(x=>x.actions),[
  ['filter'],['filter','layout'],['layout']
 ]);
 assert.deepEqual(plan.coverage_routes.map(x=>x.actions),[
  ['filter','layout'],['layout']
 ]);
 assert.deepEqual(plan.edges.map(x=>[x.from,x.to]),[
  ['s0','s1'],['s1','s2'],['s0','s3']
 ]);
 assert.deepEqual(plan.relationships.find(x=>x.action==='filter').changed_fields,['category','count']);
 assert.deepEqual(plan.relationships.find(x=>x.action==='filter').api_paths,['/api/items']);
 assert.equal(plan.relationships.find(x=>x.action==='layout').observed_transitions,2);
 assert.equal(plan.verification,undefined);
});
test('F1 same observed graph logic works on analytics with different state dimensions',()=>{
 const plan=buildObservedFeatureGraph(fixture('analytics'));
 assert.deepEqual(plan.test_cases.map(x=>x.actions),[['range'],['range','chart'],['chart']]);
 assert.deepEqual(plan.coverage_routes.map(x=>x.actions),[['range','chart'],['chart']]);
 assert.equal(plan.metrics.unique_states,4);
 assert.deepEqual(plan.relationships.find(x=>x.action==='range').changed_fields,['range','total']);
 assert.deepEqual(plan.relationships.find(x=>x.action==='range').api_paths,['/api/metrics']);
});
test('F2 graph certifies route coverage only after independent Chrome replay',()=>{
 const plan=buildObservedFeatureGraph(fixture());
 assert.throws(()=>markObservedFeatureGraphVerified(plan,{
  source:'controlled-generic-replay',scope:'synthetic-only',actual_api_calls:0,
  verified_steps:3,observed_edge_coverage:2,verified_route_ids:['route0','route1']
 }),/F2_UNVERIFIED_GRAPH/);
 assert.throws(()=>markObservedFeatureGraphVerified(plan,{
  source:'controlled-generic-replay',scope:'synthetic-only',actual_api_calls:1,
  verified_steps:3,observed_edge_coverage:3,verified_route_ids:['route0','route1']
 }),/F2_UNVERIFIED_GRAPH/);
 assert.throws(()=>markObservedFeatureGraphVerified(plan,{
  source:'controlled-generic-replay',scope:'synthetic-only',actual_api_calls:0,
  verified_steps:3,observed_edge_coverage:3,verified_route_ids:['route1','route0']
 }),/F2_UNVERIFIED_GRAPH/);
 const verified=markObservedFeatureGraphVerified(plan,{
  source:'controlled-generic-replay',scope:'synthetic-only',actual_api_calls:0,
  verified_steps:3,observed_edge_coverage:3,verified_route_ids:['route0','route1']
 });
 assert.equal(verified.verification.status,'verified-replayed-synthetic-only');
 assert.equal(verified.verification.observed_edges_verified,3);
 assert.equal(verified.verification.routes_verified,2);
 assert.deepEqual(verified.coverage_routes.map(r=>r.verified_in_source),[true,true]);
});
test('F1 graph rejects unverified sites and poisoned control labels/endpoint values',()=>{
 const modify=f=>{
  const x=fixture();f(x);
  assert.throws(()=>buildObservedFeatureGraph(x),/F4_GENERIC_UNVERIFIED_EVIDENCE|F2_UNVERIFIED_GRAPH/);
 };
 modify(x=>x.scope='approved-read-only');
 modify(x=>x.source='external-browser');
 modify(x=>x.steps[0].endpoint_paths=['/api/items?token=SECRET']);
 modify(x=>x.steps[0].endpoint_paths=['https://offsite.example/private']);
 modify(x=>x.steps[2].before={category:'unknown',count:8,layout:'grid'});
 modify(x=>x.steps[0].label='<script>alert(1)</script>');
 const plan=buildObservedFeatureGraph(fixture());
 assert.doesNotMatch(JSON.stringify(plan),/https?:\/\/|<script|SECRET|password|cookie/);
});
test('F1 routes re-enter a verified state by shortest prefix if edge order is nontrivial',()=>{
 const x=fixture();
 // Observation order does not determine shortest routes.
 const temp=x.steps[1];x.steps[1]=x.steps[2];x.steps[2]=temp;
 const plan=buildObservedFeatureGraph(x);
 assert.deepEqual(plan.test_cases.map(r=>r.actions),[['filter'],['layout'],['filter','layout']]);
 assert.deepEqual(plan.coverage_routes.map(r=>r.actions),[['filter','layout'],['layout']]);
 assert.equal(plan.metrics.planned_clicks,3);
 assert.equal(plan.metrics.coverage_of_observed_edges_pct,100);
});
