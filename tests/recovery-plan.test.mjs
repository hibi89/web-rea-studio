import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRecoveryPlan} from '../studio/recovery-plan.mjs';
const meta={status:'failed',mode:'dynamic-passive',target_url:'https://private.example/a?secret=abc',error:'secret-123'};
test('failed run provides read-only plan without leaking saved URL or error',()=>{
 const p=buildRecoveryPlan({meta,report:{verdict:'FAIL'},inspection:{mode:'dynamic-passive'},manifest:{kind:'evidence'}});
 assert.equal(p.evidence_status,'SAVED_ARTIFACTS_PRESENT');
 assert.equal(p.auto_resume_allowed,false);
 assert.equal(p.new_run_requires_explicit_post,true);
 assert.ok(!JSON.stringify(p).includes('private.example'));
 assert.ok(!JSON.stringify(p).includes('secret-123'));
});
test('interrupted partial evidence is a manual review, not a checkpoint',()=>{
 const p=buildRecoveryPlan({meta:{...meta,status:'interrupted'},report:null,inspection:{},manifest:null});
 assert.equal(p.evidence_status,'PARTIAL_SAVED_EVIDENCE');assert.equal(p.checkpoint_verified,false);
});
test('missing evidence and conflicts fail closed',()=>{
 const n=buildRecoveryPlan({meta:{...meta},report:null,inspection:null,manifest:null});
 assert.equal(n.evidence_status,'NO_SAVED_EVIDENCE');
 const c=buildRecoveryPlan({meta,report:{verdict:'PASS'},inspection:{mode:'static-visual'}});
 assert.equal(c.evidence_status,'EVIDENCE_CONFLICT');
 assert.equal(c.next_action,'REVIEW_SAVED_EVIDENCE_CONFLICT');
});
test('never treat a successful, running or unsupported mode as safely recoverable',()=>{
 for(const status of ['completed','running','queued'])assert.throws(()=>buildRecoveryPlan({meta:{...meta,status}}));
 const x=buildRecoveryPlan({meta:{...meta,mode:'unapproved-run'},report:null});
 assert.equal(x.evidence_status,'EVIDENCE_CONFLICT');assert.equal(x.auto_resume_allowed,false);
});
