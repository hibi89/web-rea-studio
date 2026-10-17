import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPassiveSupportPacket} from '../studio/support-packet.mjs';
import {buildPassivePermissionPreflight} from '../studio/permission-preflight.mjs';
import {assessSavedQ1Failure} from '../studio/q1-failure-assessment.mjs';

function sample(network,{report={}}={}){
 const args={mode:'dynamic-passive',
  report:{verdict:'FAIL',fetch_attempts:1,fetch_rejections:1,
   resource_blocked:0,application_fetch_error_visible:true,...report},
  diagnosis:{diagnosis:'PASSIVE_EXTERNAL_FETCH_REJECTED',
   next_action:'password=SECRET_SENTINEL'},
  inspection:{mode:'dynamic-passive',
   page:{title:'PRIVATE_SITE',controls:[{label:'SECRET_SENTINEL'}]},network}};
 return {packet:buildPassiveSupportPacket(args),
  preflight:buildPassivePermissionPreflight(args)};
}
const pair=host=>[
 {kind:'fetch-attempt',scope:'other-origin',host,
  raw_url:'https://'+host+'/private?token=SECRET_SENTINEL'},
 {kind:'fetch-rejected',scope:'other-origin',host}
];
test('Q1 offline classifier distinguishes local policy compatibility from a proven remote cause',()=>{
 const result=assessSavedQ1Failure(sample(pair('api.vendor.example.org')));
 assert.equal(result.kind,'rea-q1-offline-failure-assessment');
 assert.equal(result.finding,'LOCAL_POLICY_BOUNDARY_COMPATIBLE_NOT_CAUSAL');
 assert.equal(result.evidence_status,'BOUNDED');
 assert.equal(result.local_policy.off_origin_get_denied,true);
 assert.equal(result.local_policy.connect_src_self_only,true);
 assert.equal(result.observed.matched_external_host_count,1);
 assert.equal(result.observed.browser_blocked,0);
 assert.equal(result.browser_blocked_zero_does_not_prove_api_access,true);
 assert.equal(result.cause_identified,false);
 assert.equal(result.network_permission_granted,false);
 assert.equal(result.remote_api_healthy_verified,false);
 assert.equal(result.cors_verified,false);
 assert.equal(result.network_requests_issued,0);
 assert.equal(result.browser_actions_executed,0);
 assert.doesNotMatch(JSON.stringify(result),/SECRET_SENTINEL|PRIVATE_SITE|api\.vendor|token=|\/private/);
});
test('no matched host, missing count, incomplete or omitted evidence never becomes a verified cause',()=>{
 const unmatched=assessSavedQ1Failure(sample([
  {kind:'fetch-attempt',scope:'other-origin',host:'one.example.org'},
  {kind:'fetch-rejected',scope:'other-origin',host:'two.example.org'}
 ]));
 assert.equal(unmatched.finding,'FETCH_FAILURE_CAUSE_UNATTRIBUTED');
 assert.equal(unmatched.observed.matched_external_host_count,0);
 assert.equal(unmatched.evidence_status,'PARTIAL');
 const omitted=assessSavedQ1Failure(sample([...pair('api.vendor.example.org'),
  {kind:'made-up',raw:'SECRET_SENTINEL'}]));
 assert.equal(omitted.finding,'LOCAL_POLICY_BOUNDARY_COMPATIBLE_NOT_CAUSAL');
 assert.equal(omitted.evidence_status,'PARTIAL');
 assert.equal(omitted.cause_identified,false);
});
test('tampered packet or incongruent preflight fails closed and never echoes injected values',()=>{
 const original=sample(pair('api.vendor.example.org'));
 for(const mutation of [
  x=>{x.packet.capture.fetch_rejections=2;},
  x=>{x.preflight.host_candidates[0].host='secret.invalid';},
  x=>{x.preflight.decision='APPROVED';},
  x=>{x.packet.kind='malicious';},
  x=>{x.packet.network.permission_review.candidate_hosts.push('secret.invalid');}
 ]){
  const input=structuredClone(original);mutation(input);
  const result=assessSavedQ1Failure(input);
  assert.equal(result.finding,'EVIDENCE_CONFLICT');
  assert.equal(result.evidence_status,'INCONSISTENT');
  assert.equal(result.decision,'BLOCK_NETWORK_EXPANSION');
  assert.equal(result.network_permission_granted,false);
  assert.doesNotMatch(JSON.stringify(result),/secret\.invalid|api\.vendor/);
 }
});
test('invalid missing inputs and completed capture never claim success',()=>{
 const empty=assessSavedQ1Failure();
 assert.equal(empty.finding,'EVIDENCE_CONFLICT');
 assert.equal(empty.network_permission_granted,false);
 const finished=assessSavedQ1Failure(sample(pair('api.vendor.example.org'),{
  report:{verdict:'PASS'}
 }));
 assert.equal(finished.finding,'CAPTURE_FAILURE_NOT_CONFIRMED');
 assert.equal(finished.cause_identified,false);
});
