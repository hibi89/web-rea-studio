import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPassiveSiteBlueprint} from '../studio/passive-blueprint.mjs';

test('F1/F2 export is explicitly read-only and cannot invent action/API causality',()=>{
 const spec=buildPassiveSiteBlueprint({mode:'dynamic-passive',report:{verdict:'FAIL',fetch_rejections:1},
  inspection:{mode:'dynamic-passive',scope:'explicit-https-allowlist',
   page:{interaction_inventory:{source:'passive-controls',controls:[
    {kind:'button',label:'Show report',rect:{x:2,y:2,width:80,height:24}},
    {kind:'input',type:'password',rect:{x:2,y:30,width:80,height:24}}
   ]}},
   network:[{kind:'fetch-attempt',scope:'other-origin',host:'api.example.net'},
    {kind:'fetch-rejected',scope:'other-origin',host:'api.example.net'}]
  }});
 assert.equal(spec.controls.total,2);
 assert.equal(spec.controls.items[1].label,null);
 assert.equal(spec.network.causal_links_verified,0);
 assert.deepEqual(spec.network.control_to_api_links,[]);
 assert.deepEqual(spec.network.permission_review.candidate_hosts,['api.example.net']);
 assert.equal(spec.network_requests_issued,0);
 assert.equal(spec.actions_executed,0);
 assert.equal(spec.evidence.capture_verdict,'capture-failed');
});
test('unknown legacy data stays unknown; synthetic modes do not qualify',()=>{
 const spec=buildPassiveSiteBlueprint({mode:'dynamic-passive',inspection:{mode:'dynamic-passive'}});
 assert.equal(spec.controls.total,0);
 assert.equal(spec.evidence.capture_verdict,'unknown');
 assert.equal(spec.evidence.incomplete_network,true);
 assert.throws(()=>buildPassiveSiteBlueprint({mode:'rea-browser',inspection:{mode:'dynamic-passive'}}),/PASSIVE_BLUEPRINT_ONLY/);
 assert.throws(()=>buildPassiveSiteBlueprint({mode:'dynamic-passive',inspection:{mode:'static-visual'}}),/PASSIVE_BLUEPRINT_ONLY/);
});
