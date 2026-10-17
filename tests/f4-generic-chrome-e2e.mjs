import assert from 'node:assert/strict';
import {observeGenericControlledApp,verifyGenericControlledReplay,
  listGenericSyntheticFixtures,classifyGenericFixtureRequest} from '../studio/generic-fixture-browser.mjs';
import {generateGenericBehaviorHtml,normalizeGenericBehaviorEvidence} from '../studio/generic-behavior.mjs';
const fixtures=listGenericSyntheticFixtures();
assert.deepEqual(fixtures,['catalog','analytics']);
assert.equal(classifyGenericFixtureRequest('https://webrea-generic-fixture.example.org/','GET'),'document');
assert.equal(classifyGenericFixtureRequest('https://webrea-generic-fixture.example.org/api/items?category=summer','GET'),'items');
assert.equal(classifyGenericFixtureRequest('https://webrea-generic-fixture.example.org/api/metrics?range=month','GET'),'metrics');
assert.equal(classifyGenericFixtureRequest('https://webrea-generic-fixture.example.org/api/items?category=summer&token=DO_NOT_ALLOW','GET'),null);
assert.equal(classifyGenericFixtureRequest('https://elsewhere.example.org/','GET'),null);
assert.equal(classifyGenericFixtureRequest('https://webrea-generic-fixture.example.org/api/items?category=summer','POST'),null);
assert.equal(classifyGenericFixtureRequest('https://webrea-generic-fixture.example.org/api/items?category=summer','GET',{replay:true}),null);
for(const appId of fixtures){
 const evidence=await observeGenericControlledApp({browserPath:process.env.CHROME_BIN,appId});
 const policy=evidence.execution_policy;
 assert.equal(policy.source,'controlled-action-audit');
 assert.equal(policy.scope,'in-memory-synthetic-only');
 assert.equal(policy.authorized_controls,3);
 assert.ok(policy.denied_controls>=4);
 assert.equal(policy.unauthorized_actions_executed,0);
 assert.equal(policy.external_navigation_performed,false);
 assert.equal(policy.form_submissions_performed,0);
 assert.deepEqual(policy.approved_action_ids.sort(),
  (appId==='catalog'?['filter','layout','reset']:['range','chart','reset']).sort());
 assert.doesNotMatch(JSON.stringify(evidence),/DONT_COLLECT_SECRET_VALUE|offsite-denied|PRIVATE|\/api\/delete/);
 const graph=normalizeGenericBehaviorEvidence(evidence);
 assert.equal(graph.scope,'verified-synthetic-only');
 assert.equal(evidence.steps.length,3);
 assert.equal(evidence.observed_action_api_links,1);
 assert.equal(graph.reachable_state_count,4);
 assert.equal(graph.actions.length,2);
 assert.equal(graph.edges.length,3);
 const html=generateGenericBehaviorHtml(evidence);
 assert.doesNotMatch(html,/fetch\s*\(|XMLHttpRequest|<iframe\b|https?:\/\//);
 const verified=await verifyGenericControlledReplay({browserPath:process.env.CHROME_BIN,evidence,html});
 assert.equal(verified.source,'controlled-generic-replay');
 assert.equal(verified.verified_steps,3);
 assert.equal(verified.actual_api_calls,0);
 assert.equal(verified.simulated_api_calls,1);
 assert.equal(verified.branching,true);
 console.log(JSON.stringify({f4_generic_chrome:'PASS',app_id:appId,
  observed_actions:evidence.steps.length,branching_paths:2,policy_approved:policy.authorized_controls,policy_denied:policy.denied_controls,
  reachable_states:graph.reachable_state_count,generated_html_bytes:Buffer.byteLength(html),
  replay_verified:verified.verified_steps,actual_api_calls:verified.actual_api_calls,
  simulated_api_calls:verified.simulated_api_calls}));
}
