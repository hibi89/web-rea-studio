import assert from 'node:assert/strict';
import {observeGenericControlledApp,verifyGenericControlledReplay,
  listGenericSyntheticFixtures,classifyGenericFixtureRequest} from '../studio/generic-fixture-browser.mjs';
import {generateGenericBehaviorHtml,normalizeGenericBehaviorEvidence} from '../studio/generic-behavior.mjs';
import {buildObservedFeatureGraph,markObservedFeatureGraphVerified} from '../studio/behavior-exploration.mjs';
import {compileObservedStateContract} from '../studio/reconstruction-contract.mjs';
const fixtures=listGenericSyntheticFixtures();
assert.deepEqual(fixtures,['catalog','analytics','planner']);
assert.equal(classifyGenericFixtureRequest('https://webrea-generic-fixture.example.org/','GET'),'document');
assert.equal(classifyGenericFixtureRequest('https://webrea-generic-fixture.example.org/api/items?category=summer','GET'),'items');
assert.equal(classifyGenericFixtureRequest('https://webrea-generic-fixture.example.org/api/metrics?range=month','GET'),'metrics');
assert.equal(classifyGenericFixtureRequest('https://webrea-generic-fixture.example.org/api/calendar?day=tuesday','GET'),'calendar');
assert.equal(classifyGenericFixtureRequest('https://webrea-generic-fixture.example.org/api/calendar?day=monday','GET'),null);
assert.equal(classifyGenericFixtureRequest('https://webrea-generic-fixture.example.org/api/calendar?day=tuesday&token=x','GET'),null);
assert.equal(classifyGenericFixtureRequest('https://webrea-generic-fixture.example.org/api/calendar?day=tuesday','POST'),null);
assert.equal(classifyGenericFixtureRequest('https://webrea-generic-fixture.example.org/api/calendar?day=tuesday','GET',{replay:true}),null);
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
  (appId==='catalog'?['filter','layout','reset']:appId==='analytics'?['range','chart','reset']:['day','view','reset']).sort());
 assert.doesNotMatch(JSON.stringify(evidence),/DONT_COLLECT_SECRET_VALUE|offsite-denied|PRIVATE|\/api\/delete/);
 const graph=normalizeGenericBehaviorEvidence(evidence);
 assert.equal(graph.scope,'verified-synthetic-only');
 assert.equal(evidence.steps.length,3);
 assert.equal(evidence.observed_action_api_links,1);
 assert.equal(graph.reachable_state_count,4);
 assert.equal(graph.actions.length,2);
 assert.equal(graph.edges.length,3);
 const planned=buildObservedFeatureGraph(evidence);
 assert.equal(planned.metrics.unique_states,4);
 assert.equal(planned.metrics.route_count,2);
 assert.equal(planned.metrics.planned_clicks,3);
 assert.deepEqual(planned.coverage_routes.map(r=>r.actions),appId==='catalog'?
  [['filter','layout'],['layout']]:appId==='analytics'? [['range','chart'],['chart']]:[['day','view'],['view']]);
 const html=generateGenericBehaviorHtml(evidence);
 assert.doesNotMatch(html,/fetch\s*\(|XMLHttpRequest|<iframe\b|https?:\/\//);
 const verified=await verifyGenericControlledReplay({browserPath:process.env.CHROME_BIN,evidence,html});
 assert.equal(verified.source,'controlled-generic-replay');
 assert.equal(verified.verified_steps,3);
 assert.equal(verified.observed_edge_coverage,3);
 assert.deepEqual(verified.verified_route_ids,['route0','route1']);
 const certified=markObservedFeatureGraphVerified(planned,verified);
 const runnableContract=compileObservedStateContract({evidence,verifiedGraph:certified,replay:verified,html});
 assert.equal(runnableContract.app_id,appId);
 assert.equal(runnableContract.states.length,4);
 if(appId==='planner'){
  assert.deepEqual(runnableContract.initial_state,{day:'monday',layout:'list',slots:4});
  assert.deepEqual(runnableContract.actions.map(a=>a.id),['day','view']);
  assert.equal(runnableContract.backend.recovered_original_api,false);
 }
 assert.equal(runnableContract.replay.verified_edges,3);
 assert.ok(runnableContract.replay.rejected_unobserved_events>=4);
 assert.equal(runnableContract.backend.real_endpoint_calls,0);
 assert.equal(runnableContract.product_ready,false);
 assert.equal(certified.verification.status,'verified-replayed-synthetic-only');
 assert.equal(certified.verification.routes_verified,2);
 assert.equal(certified.verification.observed_edges_verified,3);
 assert.equal(verified.actual_api_calls,0);
 assert.equal(verified.simulated_api_calls,1);
 assert.equal(verified.branching,true);
 assert.ok(verified.unobserved_transitions_rejected>=4,
  'unobserved action events must not change state, counters or issue HTTP');
 console.log(JSON.stringify({f4_generic_chrome:'PASS',app_id:appId,
  observed_actions:evidence.steps.length,branching_paths:2,policy_approved:policy.authorized_controls,policy_denied:policy.denied_controls,
  reachable_states:graph.reachable_state_count,graph_edges_verified:certified.verification.observed_edges_verified,planned_routes:certified.verification.routes_verified,generated_html_bytes:Buffer.byteLength(html),
  replay_verified:verified.verified_steps,actual_api_calls:verified.actual_api_calls,
  simulated_api_calls:verified.simulated_api_calls,
  unobserved_transitions_rejected:verified.unobserved_transitions_rejected}));
}
