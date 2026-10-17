import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildReviewedDelivery} from '../studio/reviewed-delivery.mjs';

const html='<!doctype html><html><body>synthetic fixture only</body></html>';
const meta=(mode='static-visual')=>({mode,status:'completed',
 target_url:'https://SECRET_HOST.example.org/private?key=TOPSECRET'});
const visual=()=>({status:'OFFLINE_ARTIFACTS_VERIFIED',
 stages:{static_visual_gate:{status:'THRESHOLD_MET'}}});
const synthetic=()=>({status:'SYNTHETIC_SAVED_CHAIN_CONSISTENT',
 stages:{f5_replay_claim:{status:'CONSISTENT_SAVED_CLAIM'}}});

test('static reviewed export requires saved consistency AND separate visual threshold',()=>{
 const receipt=buildReviewedDelivery({meta:meta(),audit:visual(),html});
 assert.equal(receipt.export_eligible,true);
 assert.equal(receipt.artifact.filename,'rea-reviewed-static-preview.html');
 assert.equal(receipt.artifact.sha256,createHash('sha256').update(html).digest('hex'));
 assert.equal(receipt.artifact.bytes,Buffer.byteLength(html));
 assert.equal(receipt.artifact_sha256_signed,false);
 assert.equal(receipt.functional_equivalence_verified,false);
 assert.equal(receipt.product_ready,false);
 assert.doesNotMatch(JSON.stringify(receipt),/SECRET_HOST|TOPSECRET|synthetic fixture only/);
 const failed=visual();failed.stages.static_visual_gate.status='BLOCKED';
 const blocked=buildReviewedDelivery({meta:meta(),audit:failed,html});
 assert.equal(blocked.export_eligible,false);
 assert.equal(blocked.reason,'VISUAL_OR_SAVED_REPLAY_GATE_NOT_MET');
 assert.equal(blocked.artifact,null);
});

test('synthetic reviewed export is explicit about only saved replay consistency',()=>{
 for(const mode of ['fixture-generic-catalog','fixture-generic-analytics','fixture-generic-planner']){
  const r=buildReviewedDelivery({meta:meta(mode),audit:synthetic(),html});
  assert.equal(r.export_eligible,true);
  assert.equal(r.analysis_scope,'controlled-synthetic-only');
  if(mode==='fixture-generic-planner')assert.equal(r.artifact.filename,'rea-reviewed-synthetic-planner.html');
  assert.equal(r.evidence.synthetic_replay,'SAVED_CLAIM_CONSISTENT_NO_FRESH_REPLAY');
  assert.equal(r.original_api_or_backend_parity,false);
  assert.equal(r.source_authenticity_verified,false);
  assert.equal(r.artifact_sha256_signed,false);
 }
});

test('tampering, missing artifact, unsupported and incomplete runs fail closed',()=>{
 const cases=[
  {meta:meta(),audit:{status:'EVIDENCE_CONFLICT',stages:{}},html},
  {meta:meta(),audit:visual(),html:null},
  {meta:meta(),audit:visual(),html:'A'.repeat(250001)},
  {meta:meta('fixture-generic-catalog'),audit:{status:'INCOMPLETE'},html},
  {meta:meta('fixture-generic-analytics'),audit:synthetic(),html:'A'.repeat(50001)},
  {meta:meta('dynamic-passive'),audit:synthetic(),html},
  {meta:{...meta(),status:'running'},audit:visual(),html}
 ];
 for(const args of cases){
  const r=buildReviewedDelivery(args);
  assert.equal(r.export_eligible,false);
  assert.equal(r.artifact,null);
  assert.equal(r.browser_actions_executed,0);
  assert.equal(r.existing_saved_files_mutated,false);
 }
});

test('receipts are deterministic from the exact generated HTML bytes',()=>{
 const first=buildReviewedDelivery({meta:meta(),audit:visual(),html});
 const same=buildReviewedDelivery({meta:meta(),audit:visual(),html});
 const changed=buildReviewedDelivery({meta:meta(),audit:visual(),html:html+' '});
 assert.deepEqual(first,same);
 assert.notEqual(first.artifact.sha256,changed.artifact.sha256);
 assert.equal(changed.artifact.bytes,first.artifact.bytes+1);
});
