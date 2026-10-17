import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {fixtureActionPolicy,decideFixtureAction,auditFixtureInventory,
 SYNTHETIC_CONTROL_PROBE,getFixtureActionSelector} from '../studio/fixture-permissions.mjs';
const item=(id,tag='button',type='button',visible=true,disabled=false)=>
 ({id,tag,type,visible,disabled});
const sample=()=>({
 source:'controlled-dom-inventory',origin:'https://webrea-generic-fixture.example.org',
 items:[
  item('src-filter'),item('src-layout'),item('source-reset'),
  item('src-delete'),item('src-submit','button','submit'),
  item('outside-link','a','button'),item('credential','input','password'),
  item('invisible','button','button',false)
 ]});
test('F2 exact local capability scope rejects external origins and unknown apps',()=>{
 assert.throws(()=>fixtureActionPolicy({appId:'catalog',origin:'https://approved-site.example.org'}),/F2_POLICY_SCOPE_DENIED/);
 assert.throws(()=>fixtureActionPolicy({appId:'unknown'}),/F2_POLICY_SCOPE_DENIED/);
 const p=fixtureActionPolicy({appId:'catalog'});
 assert.equal(p.external_navigation,false);
 assert.equal(p.form_submission,false);
 assert.equal(p.unknown_actions,false);
 assert.deepEqual(Object.values(p.allowed).sort(),['filter','layout','reset']);
 assert.equal(decideFixtureAction(item('src-filter'),p).decision,'approved');
 assert.equal(decideFixtureAction(item('src-delete'),p).reason,'not-allowlisted');
 assert.equal(decideFixtureAction(item('src-submit','button','submit'),p).reason,'not-an-explicit-button');
 assert.equal(decideFixtureAction(item('outside-link','a'),p).reason,'not-an-explicit-button');
 assert.equal(decideFixtureAction(item('credential','input','password'),p).reason,'not-an-explicit-button');
 assert.equal(decideFixtureAction(item('src-filter','button','button',false),p).reason,'hidden-or-disabled');
 assert.equal(decideFixtureAction(item('src-filter','button','button',true,true),p).reason,'hidden-or-disabled');
 assert.equal(decideFixtureAction(item('<script>'),p).reason,'invalid-id');
});
test('F1 discovery is read-only, excludes input values, and a denied decoy never becomes an approved action',()=>{
 const p=fixtureActionPolicy({appId:'catalog'});
 const audit=auditFixtureInventory(sample(),p);
 assert.equal(audit.authorized_controls,3);
 assert.equal(audit.denied_controls,5);
 assert.equal(audit.unauthorized_actions_executed,0);
 assert.equal(getFixtureActionSelector('filter',audit),'src-filter');
 assert.equal(getFixtureActionSelector('reset',audit),'source-reset');
 assert.throws(()=>getFixtureActionSelector('delete',audit),/F2_ACTION_NOT_PERMITTED/);
 const duplicated=sample();duplicated.items.push(item('src-filter'));
 const updated=auditFixtureInventory(duplicated,p);
 assert.equal(updated.denied_controls,6);
 assert.equal(updated.authorized_controls,3);
 const tampered=sample();tampered.items[0].type='submit';
 assert.throws(()=>auditFixtureInventory(tampered,p),/F2_POLICY_REQUIRED_ACTIONS_MISSING/);
 assert.doesNotMatch(SYNTHETIC_CONTROL_PROBE,/\.(?:value|innerHTML|outerHTML)\b|\bfetch\s*\(|\bclick\s*\(|\bsubmit\s*\(/);
});
test('F2 policy rejects mislabeled/forged inventory and wrong app action IDs',()=>{
 const p=fixtureActionPolicy({appId:'analytics'});
 const raw=sample();
 assert.throws(()=>auditFixtureInventory(raw,p),/F2_POLICY_REQUIRED_ACTIONS_MISSING/);
 raw.items[0].id='src-range';raw.items[1].id='src-chart';
 const data=auditFixtureInventory(raw,p);
 assert.equal(data.authorized_controls,3);
 assert.equal(getFixtureActionSelector('chart',data),'src-chart');
 assert.throws(()=>getFixtureActionSelector('filter',data),/F2_ACTION_NOT_PERMITTED/);
});
test('F1 controlled DOM probe reads only a safe structural projection',()=>{
 const nodes=[
  {tagName:'BUTTON',id:'src-filter',disabled:false,
   getAttribute:()=>null,getBoundingClientRect:()=>({width:100,height:40})},
  {tagName:'INPUT',id:'credential',disabled:false,
   getAttribute:key=>key==='type'?'password':null,
   getBoundingClientRect:()=>({width:200,height:30})}
 ];
 Object.defineProperty(nodes[1],'value',{get(){throw Error('secret read')}});
 const raw=runInNewContext(SYNTHETIC_CONTROL_PROBE,{
  document:{querySelectorAll:()=>nodes},
  getComputedStyle:()=>({display:'block',visibility:'visible'}),
  location:{origin:'https://webrea-generic-fixture.example.org'}
 },{timeout:1000});
 assert.equal(raw.items.length,2);
 assert.equal(raw.items[1].type,'password');
 assert.doesNotMatch(JSON.stringify(raw),/value|secret/i);
});
