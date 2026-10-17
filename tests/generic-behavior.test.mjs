import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGenericBehaviorEvidence,generateGenericBehaviorHtml} from '../studio/generic-behavior.mjs';
function demo(){
 const initial={category:'all',count:8,layout:'grid'};
 const filtered={...initial,category:'summer',count:3};
 const list={...filtered,layout:'list'};
 const baseList={...initial,layout:'list'};
 const edge=(id,label,before,after,request_count=0)=>({
  id,label,before,after,action:'click',status:'completed',
  changed_fields:Object.keys(before).sort().filter(k=>before[k]!==after[k]),
  request_count,endpoint_paths:request_count?['/api/items']:[],
  attribution:'controlled-single-action-window'
 });
 return {source:'controlled-generic-chrome',scope:'synthetic-only',
  verification:'real-isolated-chrome',app_id:'catalog',title:'상품 목록 실험',
  initial,observed_action_api_links:1,
  steps:[
   edge('filter','카테고리 변경',initial,filtered,1),
   edge('layout','목록 표시',filtered,list),
   edge('layout','목록 표시',initial,baseList)
  ]};
}
test('generic branching graph supports different observed transitions from one state',()=>{
 const model=normalizeGenericBehaviorEvidence(demo());
 assert.equal(model.kind,'controlled-branching-replay');
 assert.equal(model.reachable_state_count,4);
 assert.equal(model.actions.length,2);
 assert.equal(model.edges.length,3);
 assert.equal(model.network_mode,'local-counter-no-http');
 assert.equal(model.observed_action_api_links,1);
 assert.deepEqual(model.fields,['category','count','layout']);
 assert.equal(model.edges[2].before.layout,'grid');
 const html=generateGenericBehaviorHtml(demo());
 assert.match(html,/id="action-filter"/);
 assert.match(html,/id="action-layout"/);
 assert.match(html,/id="reset-flow"/);
 assert.match(html,/id="state-count"/);
 assert.match(html,/connect-src &#39;none&#39;/);
 assert.match(html,/Web REA · Controlled Generic Replay/);
 assert.doesNotMatch(html,/fetch\s*\(|XMLHttpRequest|<iframe\b|<form\b|https?:\/\/|<link\b/);
 assert.ok(Buffer.byteLength(html)<50000);
});
test('generic graph works for a distinct analytics field schema',()=>{
 const a={chart:'bar',range:'week',total:12};
 const b={...a,range:'month',total:31};
 const c={...b,chart:'line'};
 const d={...a,chart:'line'};
 const sample={...demo(),app_id:'analytics',title:'분석 대시보드 실험',initial:a,steps:[
  {id:'range',label:'기간 확대',before:a,after:b,action:'click',status:'completed',
   changed_fields:['range','total'],request_count:1,endpoint_paths:['/api/metrics'],
   attribution:'controlled-single-action-window'},
  {id:'chart',label:'차트 전환',before:b,after:c,action:'click',status:'completed',
   changed_fields:['chart'],request_count:0,endpoint_paths:[],attribution:'controlled-single-action-window'},
  {id:'chart',label:'차트 전환',before:a,after:d,action:'click',status:'completed',
   changed_fields:['chart'],request_count:0,endpoint_paths:[],attribution:'controlled-single-action-window'}
 ]};
 const graph=normalizeGenericBehaviorEvidence(sample);
 assert.equal(graph.fields.includes('category'),false);
 assert.equal(graph.fields.includes('total'),true);
 assert.equal(graph.reachable_state_count,4);
 assert.match(generateGenericBehaviorHtml(sample),/state-chart/);
});
test('generic model refuses unverified provenance, remote API paths and unsafe state fields',()=>{
 const alter=fn=>{const data=demo();fn(data);
  assert.throws(()=>normalizeGenericBehaviorEvidence(data),/F4_GENERIC_UNVERIFIED_EVIDENCE/);};
 alter(x=>x.scope='approved-read-only');
 alter(x=>x.verification='inferred');
 alter(x=>x.source='untrusted-site');
 alter(x=>x.initial.password='secret');
 alter(x=>x.initial.email='person@example.com');
 alter(x=>x.initial.account='99999999');
 alter(x=>x.steps[0].request_count=5);
 alter(x=>x.steps[0].endpoint_paths=['/api/items?token=1']);
 alter(x=>x.steps[0].endpoint_paths=['https://other.example/data']);
 alter(x=>x.steps[0].changed_fields=['count']);
 alter(x=>x.steps[1].before.count=2);
 alter(x=>x.steps[1].label='<script>bad</script>');
 alter(x=>x.steps[0].label='https://unsafe.example');
 alter(x=>x.steps[0].after.category='<img src=x>');
 alter(x=>x.steps[1].id=' ');
 alter(x=>x.observed_action_api_links=9);
 alter(x=>x.steps[2].before={category:'lost',count:8,layout:'grid'});
 alter(x=>x.steps.push(structuredClone(x.steps[0])));
});
test('generic prototype does not copy unrelated evidence keys or external URLs',()=>{
 const x=demo();
 x.secret_value='DO_NOT_COPY';
 x.remote_target='https://someone.example/?token=LEAK';
 x.steps[0].raw_dom='<script>alert(1)</script>';
 x.steps[0].response_payload='SECRET_HTTP_RESPONSE';
 const html=generateGenericBehaviorHtml(x);
 assert.doesNotMatch(html,/LEAK|DO_NOT_COPY|SECRET_HTTP_RESPONSE|someone.example|alert\(1\)/);
});
