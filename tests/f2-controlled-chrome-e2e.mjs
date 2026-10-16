import assert from 'node:assert/strict';
import {verifyControlledF2Actions,verifyControlledF4Replay,classifyControlledF2Request} from '../studio/controlled-f2-browser.mjs';
import {generateControlledInteractiveHtml} from '../studio/behavior-reconstruction.mjs';
const good='https://webrea-controlled-fixture.example.org/';
assert.equal(classifyControlledF2Request(good,'GET').kind,'document');
assert.equal(classifyControlledF2Request(good+'api/rows?period=7','GET').period,7);
for(const bad of [
 'https://outside.example.org/',
 'https://webrea-controlled-fixture.example.org/api/rows?period=7&token=SECRET',
 'https://webrea-controlled-fixture.example.org/api/rows?period=999',
 'https://webrea-controlled-fixture.example.org/other',
 'http://webrea-controlled-fixture.example.org/'
])assert.equal(classifyControlledF2Request(bad,'GET'),null);
assert.equal(classifyControlledF2Request(good+'api/rows?period=30','POST'),null);
const evidence=await verifyControlledF2Actions({browserPath:process.env.CHROME_BIN});
assert.equal(evidence.source,'controlled-f2-chrome');
assert.equal(evidence.scope,'in-memory-synthetic-only');
assert.equal(evidence.verified_actions,4);
assert.equal(evidence.verified_action_api_links,2);
assert.equal(evidence.initial_api_requests,1);
assert.deepEqual(evidence.steps.map(s=>s.network_requests),[1,0,0,1]);
assert.deepEqual(evidence.steps.map(s=>s.changed_fields),[
 ['period','rows'],['order'],['view'],[]
]);
assert.deepEqual(evidence.steps.map(s=>s.endpoint_paths),[
 ['/api/rows'],[],[],['/api/rows']
]);
for(const step of evidence.steps)assert.equal(step.attribution,'verified-in-controlled-single-action-window');
assert.doesNotMatch(JSON.stringify(evidence),/password|SECRET|token=|https?:\/\//i);
console.log(JSON.stringify({controlled_f2_chrome:'PASS',
 actions:evidence.verified_actions,verified_action_api_links:evidence.verified_action_api_links,
 action_to_request_counts:evidence.steps.map(s=>s.network_requests),
 actions_with_dom_changes:evidence.steps.filter(s=>s.changed_fields.length).length,
 unknown_requests_denied:evidence.denied_unknown_requests}));

const prototypeHtml=generateControlledInteractiveHtml(evidence);
const replay=await verifyControlledF4Replay({browserPath:process.env.CHROME_BIN,prototypeHtml});
assert.equal(replay.source,'controlled-f4-replay');
assert.equal(replay.scope,'generated-synthetic-only');
assert.equal(replay.executed_actions,4);
assert.equal(replay.passed_steps,4);
assert.equal(replay.real_api_requests,0);
assert.equal(replay.simulated_api_calls,2);
assert.deepEqual(replay.steps.map(s=>s.simulated_api_calls),[1,0,0,1]);
assert.deepEqual(replay.steps.map(s=>s.state_after),evidence.steps.map(s=>s.state_after));
assert.doesNotMatch(JSON.stringify(replay),/password|SECRET|token=|https?:\/\//i);
console.log(JSON.stringify({
 controlled_f4_reconstruction:'PASS',
 generated_html_bytes:Buffer.byteLength(prototypeHtml),
 replayed_actions:replay.passed_steps,
 simulated_api_calls:replay.simulated_api_calls,
 actual_api_calls:replay.real_api_requests
}));
