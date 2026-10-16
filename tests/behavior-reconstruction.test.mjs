import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeControlledBehavior,generateControlledInteractiveHtml} from '../studio/behavior-reconstruction.mjs';

const before={period:7,rows:3,order:'asc',view:'table',ready:true};
const changes=[
 {id:'change-period',after:{...before,period:30,rows:8},fields:['period','rows'],calls:1},
 {id:'sort-rows',after:{...before,period:30,rows:8,order:'desc'},fields:['order'],calls:0},
 {id:'open-help',after:{...before,period:30,rows:8,order:'desc',view:'help'},fields:['view'],calls:0},
 {id:'refresh',after:{...before,period:30,rows:8,order:'desc',view:'help'},fields:[],calls:1}
];
let prior=before;
const syntheticSteps=changes.map(x=>{
 const v={step_id:x.id,action:'click',status:'completed',state_before:prior,state_after:x.after,
  changed_fields:x.fields,network_requests:x.calls,endpoint_paths:x.calls?['/api/rows']:[],
  attribution:'verified-in-controlled-single-action-window'};
 prior=x.after;return v;
});
const fixture={source:'controlled-f2-chrome',scope:'in-memory-synthetic-only',
 verified_actions:4,verified_action_api_links:2,initial_api_requests:1,steps:syntheticSteps};
test('F4 produces a self-contained synthetic interactive HTML from verified fixed steps only',()=>{
 const blueprint=normalizeControlledBehavior(fixture);
 assert.equal(blueprint.kind,'controlled-behavior-blueprint');
 assert.equal(blueprint.steps.length,4);
 assert.equal(blueprint.network_mode,'local-simulation-no-requests');
 assert.deepEqual(blueprint.steps.map(s=>s.simulated_api_delta),[1,0,0,1]);
 assert.deepEqual(blueprint.steps.map(s=>s.observed_changes),[
  ['period','rows'],['order'],['view'],[]
 ]);
 const html=generateControlledInteractiveHtml(fixture);
 assert.match(html,/<!doctype html>/);
 assert.match(html,/data-action="change-period"/);
 assert.match(html,/data-action="sort-rows"/);
 assert.match(html,/data-action="open-help"/);
 assert.match(html,/data-action="refresh"/);
 assert.match(html,/id="api-simulated"/);
 assert.match(html,/connect-src &#39;none&#39;/);
 assert.match(html,/script-src &#39;unsafe-inline&#39;/);
 assert.match(html,/Synthetic Behavior Replay/);
 assert.doesNotMatch(html,/fetch\s*\(|XMLHttpRequest|https?:\/\/|<iframe\b|<form\b|<link\b/);
 assert.ok(Buffer.byteLength(html)<80000);
});
test('F4 refuses altered provenance, unverified APIs and arbitrary state',()=>{
 const alter=mutation=>{
  const x=structuredClone(fixture);
  mutation(x);
  assert.throws(()=>generateControlledInteractiveHtml(x),/F4_UNVERIFIED_BEHAVIOR_EVIDENCE/);
 };
 alter(x=>x.scope='approved-read-only');
 alter(x=>x.source='passive-browser');
 alter(x=>x.verified_action_api_links=0);
 alter(x=>x.initial_api_requests=3);
 alter(x=>x.steps[0].network_requests=2);
 alter(x=>x.steps[0].endpoint_paths=['/admin']);
 alter(x=>x.steps[1].step_id='delete-user');
 alter(x=>x.steps[1].attribution='inferred');
 alter(x=>x.steps[2].state_after={...x.steps[2].state_after,secret:'PRIVATE'});
 alter(x=>x.steps[0].state_after.rows=-20);
 alter(x=>x.steps[2].changed_fields=['view','unknown']);
 alter(x=>x.steps[1].state_before.rows=500);
});
test('F4 generated blueprint never copies arbitrary labels, credentials or URL parameters',()=>{
 const x=structuredClone(fixture);
 x.untrusted_source_url='https://evil.example/?token=DO_NOT_COPY';
 x.steps[0].label='<script>alert("BYPASS")</script>';
 x.steps[0].state_before.extra='SECRET';
 assert.throws(()=>normalizeControlledBehavior(x),/F4_UNVERIFIED_BEHAVIOR_EVIDENCE/);
 const y=structuredClone(fixture);
 y.untrusted_source_url='https://evil.example/?token=DO_NOT_COPY';
 y.steps[0].label='<script>alert("BYPASS")</script>';
 const html=generateControlledInteractiveHtml(y);
 assert.doesNotMatch(html,/evil\.example|DO_NOT_COPY|BYPASS|alert\(/);
});
