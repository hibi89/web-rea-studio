import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPassiveSupportPacket} from '../studio/support-packet.mjs';

test('shareable packet has diagnostic evidence without secrets, page labels, paths or raw URLs',()=>{
 const p=buildPassiveSupportPacket({
  mode:'dynamic-passive',
  report:{verdict:'FAIL',render_fidelity:'incomplete',application_fetch_error_visible:true,
   failures:['fetch_requests_rejected','TOP_SECRET'],fetch_attempts:1,fetch_rejections:1,
   resource_requests:3,resource_fulfilled:2,resource_blocked:1,critical_resources_blocked:1},
  diagnosis:{diagnosis:'PASSIVE_EXTERNAL_FETCH_REJECTED',next_action:'raw password=SUPER_SECRET'},
  inspection:{mode:'dynamic-passive',network_diagnostics:{fetch_rejections:1},
   page:{title:'PRIVATE_COMPANY',interaction_inventory:{source:'passive-controls',
    counts:{total:3,buttons:1,inputs:1,links:1},
    controls:[{label:'Secret Password 1234',type:'password',value:'SUPER_SECRET'}]}},
   network:[
    {kind:'fetch-attempt',scope:'other-origin',host:'api.example.net',
     raw_url:'https://api.example.net/private/orders?token=SUPER_SECRET'},
    {kind:'fetch-rejected',scope:'other-origin',host:'api.example.net'},
    {kind:'requested',path:'/api/order',query:'SUPER_SECRET'},
    {kind:'blocked',path:'/api/order',reason:'HTTP_REJECTED'},
    {kind:'requested',path:'/personal/12345678',secret:'SUPER_SECRET'},
   ]}});
 assert.equal(p.kind,'rea-local-support-packet');
 assert.equal(p.network_requests_issued,0);
 assert.equal(p.actions_executed,0);
 assert.equal(p.diagnosis_code,'PASSIVE_EXTERNAL_FETCH_REJECTED');
 assert.equal(p.capture.verdict,'FAIL');
 assert.equal(p.control_inventory.total,3);
 assert.equal(p.network.verified_control_to_api_links,0);
 assert.deepEqual(p.network.permission_review.candidate_hosts,['api.example.net']);
 assert.equal(p.network.groups.find(g=>g.scope==='approved-origin').path_category,'api-candidate');
 assert.deepEqual(p.capture.failures,['fetch_requests_rejected']);
 assert.equal(p.privacy.review_before_sharing,true);
 assert.equal(p.privacy.contains_full_urls,false);
 const serialized=JSON.stringify(p);
 for(const secret of ['SUPER_SECRET','TOP_SECRET','PRIVATE_COMPANY','Secret Password','/api/order',
  '/personal/','12345678','/private/orders','raw password','token='])
  assert.equal(serialized.includes(secret),false,'packet leaked: '+secret);
});
test('missing legacy evidence emits unknown rather than guessed external cause',()=>{
 const p=buildPassiveSupportPacket({mode:'dynamic-passive',inspection:{mode:'dynamic-passive'}});
 assert.equal(p.diagnosis_code,'UNKNOWN');
 assert.equal(p.capture.verdict,'UNKNOWN');
 assert.equal(p.control_inventory.available,false);
 assert.equal(p.network.evidence_incomplete,true);
 assert.deepEqual(p.network.groups,[]);
 assert.deepEqual(p.network.permission_review.candidate_hosts,[]);
 assert.equal(p.network.permission_review.approved,false);
});
test('privacy contract rejects nonpassive and mismatched inspections',()=>{
 assert.throws(()=>buildPassiveSupportPacket({mode:'static-visual',inspection:{mode:'static-visual'}}),/PASSIVE_SUPPORT_ONLY/);
 assert.throws(()=>buildPassiveSupportPacket({mode:'dynamic-passive',inspection:{mode:'fixture-causal'}}),/PASSIVE_SUPPORT_ONLY/);
});
test('host matching only yields review candidate, never automatic network permission',()=>{
 const p=buildPassiveSupportPacket({mode:'dynamic-passive',inspection:{mode:'dynamic-passive',network:[
  {kind:'fetch-attempt',scope:'other-origin',host:'api.alpha.example'},
  {kind:'fetch-rejected',scope:'other-origin',host:'api.beta.example'},
 ]}});
 assert.equal(p.network.permission_review.requires_explicit_approval,false);
 assert.equal(p.network.permission_review.approved,false);
 assert.equal(p.network.verified_control_to_api_links,0);
});
