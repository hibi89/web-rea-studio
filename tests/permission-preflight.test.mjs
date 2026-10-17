import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPassivePermissionPreflight} from '../studio/permission-preflight.mjs';

function sample(network,{fetchRejections=1,verdict='FAIL'}={}){
 return buildPassivePermissionPreflight({mode:'dynamic-passive',
  report:{verdict,fetch_rejections:fetchRejections,application_fetch_error_visible:true},
  diagnosis:{diagnosis:'PASSIVE_EXTERNAL_FETCH_REJECTED',next_action:'secret=ABSOLUTELY_PRIVATE'},
  inspection:{mode:'dynamic-passive',
   page:{title:'SECRET_PROJECT',interaction_inventory:{source:'passive-controls',
    counts:{total:2},controls:[{label:'private token ABSOLUTELY_PRIVATE'}]}},
   network}});
}
test('observed external host produces bounded non-executable explicit permission checklist',()=>{
 const p=sample([
  {kind:'fetch-attempt',scope:'other-origin',host:'api.example.org',
   url:'https://api.example.org/secret/path?token=ABSOLUTELY_PRIVATE'},
  {kind:'fetch-rejected',scope:'other-origin',host:'api.example.org'},
 ]);
 assert.equal(p.kind,'rea-q1-offline-permission-preflight');
 assert.equal(p.network_requests_issued,0);
 assert.equal(p.browser_actions_executed,0);
 assert.equal(p.executable_policy_generated,false);
 assert.equal(p.auto_allowlist_changes,0);
 assert.equal(p.decision,'BLOCK_NETWORK_EXPANSION');
 assert.equal(p.permission_status,'NOT_APPROVED');
 assert.deepEqual(p.host_candidates.map(x=>x.host),['api.example.org']);
 assert.equal(p.host_candidates[0].host_class,'hostname_only_unverified');
 assert.equal(p.host_candidates[0].network_permission_granted,false);
 assert.ok(p.blockers.includes('host_ownership_or_permission_not_verified'));
 assert.ok(p.authorization_requirements.length>=10);
 assert.ok(p.authorization_requirements.every(x=>x.value===null&&x.status==='not_verified'));
 assert.doesNotMatch(JSON.stringify(p),/ABSOLUTELY_PRIVATE|SECRET_PROJECT|\/secret\/path|token=/);
});
test('unmatched and missing evidence do not invent a host or grant access',()=>{
 const missing=sample([]);
 assert.deepEqual(missing.host_candidates,[]);
 assert.equal(missing.evidence.evidence_incomplete,true);
 assert.ok(missing.blockers.includes('matched_external_host_evidence_missing'));
 const unmatched=sample([
  {kind:'fetch-attempt',scope:'other-origin',host:'one.example.org'},
  {kind:'fetch-rejected',scope:'other-origin',host:'two.example.org'},
 ]);
 assert.deepEqual(unmatched.host_candidates,[]);
 assert.equal(unmatched.decision,'BLOCK_NETWORK_EXPANSION');
});
test('IP addresses and special-use hostname candidates remain explicit blockers',()=>{
 for(const host of ['127.0.0.1','foo.local','foo.internal','foo.test','foo.invalid',
  'x.localhost','internal.onion','router.home.arpa']){
  const p=sample([
   {kind:'fetch-attempt',scope:'other-origin',host},
   {kind:'fetch-rejected',scope:'other-origin',host},
  ]);
  assert.equal(p.decision,'BLOCK_NETWORK_EXPANSION');
  assert.equal(p.host_candidates[0]?.host_class,'special_use_or_address',host);
  assert.ok(p.blockers.includes('unsafe_or_non_public_host_candidate'),host);
 }
});
test('unknown and completed reports never return runnable approval',()=>{
 const unknown=buildPassivePermissionPreflight({mode:'dynamic-passive',inspection:{mode:'dynamic-passive'}});
 assert.equal(unknown.decision,'BLOCK_NETWORK_EXPANSION');
 assert.equal(unknown.evidence.capture_verdict,'UNKNOWN');
 assert.ok(unknown.blockers.includes('failing_capture_not_confirmed'));
 const completed=sample([{kind:'fetch-attempt',scope:'other-origin',host:'api.example.org'},
  {kind:'fetch-rejected',scope:'other-origin',host:'api.example.org'}],{verdict:'PASS'});
 assert.equal(completed.permission_status,'NOT_APPROVED');
 assert.ok(completed.blockers.includes('failing_capture_not_confirmed'));
 assert.throws(()=>buildPassivePermissionPreflight({mode:'static-visual',inspection:{mode:'static-visual'}}),/PASSIVE_SUPPORT_ONLY/);
});
