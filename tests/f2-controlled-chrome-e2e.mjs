import assert from 'node:assert/strict';
import {verifyControlledF2Actions,classifyControlledF2Request} from '../studio/controlled-f2-browser.mjs';
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
