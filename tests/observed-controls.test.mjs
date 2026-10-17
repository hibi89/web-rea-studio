import test from 'node:test';
import assert from 'node:assert/strict';
import {buildObservedControlContract,generateObservedControlMapHtml} from '../studio/observed-controls.mjs';

const geometry={
 source:'p4-geometry',viewport:{width:1440,height:900},document:{width:1440,height:1200},
 body_color:'rgb(250, 250, 255)',
 boxes:[{tag:'main',x:0,y:0,w:1440,h:1200,depth:2,background:'rgb(250, 250, 255)',radius:'0px',border_width:'0px'}],
 titles:[]};
const observed={
 source:'passive-controls',verification:'presence-only',actions_executed:0,
 controls:[
  {id:'control-001',kind:'button',label:'Refresh',rect:{x:50,y:50,width:120,height:35}},
  {id:'control-002',kind:'link',label:'Offsite',navigation:'offsite',rect:{x:220,y:50,width:130,height:35}},
  {id:'control-003',kind:'input',type:'password',label:'VERY_PRIVATE_INPUT',rect:{x:50,y:110,width:230,height:40}},
  {id:'control-004',kind:'tab',label:'Trends',rect:{x:400,y:50,width:110,height:35}}
 ]};
test('read-only control map preserves coordinates but never exports field values or link destinations',()=>{
 const contract=buildObservedControlContract(geometry,observed);
 assert.equal(contract.source,'read-only-control-map');
 assert.equal(contract.total,4);
 assert.equal(contract.behavior_verified,false);
 assert.equal(contract.actions_executed,0);
 assert.equal(contract.controls[0].x,50);
 assert.equal(contract.controls[1].kind,'link');
 assert.equal(contract.controls[2].label,'');
 const html=generateObservedControlMapHtml(geometry,contract);
 assert.match(html,/data-id="control-001"/);
 assert.match(html,/width:120px;height:35px/);
 assert.match(html,/script-src &#39;none&#39;/);
 assert.match(html,/connect-src &#39;none&#39;/);
 assert.match(html,/<button type="button" disabled/);
 assert.doesNotMatch(html,/<script\b|<input\b|<form\b|<a\s+href|https?:\/\/|VERY_PRIVATE_INPUT/);
 assert.equal((html.match(/class="mapped"/g)||[]).length,4);
});
test('unsupported or unverified control evidence cannot create a control map',()=>{
 assert.equal(buildObservedControlContract(geometry,null),null);
 assert.equal(buildObservedControlContract(geometry,{...observed,actions_executed:1}),null);
 assert.equal(buildObservedControlContract(geometry,{...observed,verification:'behavior-verified'}),null);
 const contract=buildObservedControlContract(geometry,observed);
 assert.throws(()=>generateObservedControlMapHtml(geometry,{...contract,behavior_verified:true}),/CONTROL_MAP_EVIDENCE_UNAVAILABLE/);
});
test('sanitized labels and dangerous data cannot be injected into standalone HTML',()=>{
 const contaminated=structuredClone(observed);
 contaminated.controls[0].label='<script>alert(1)</script> https://example.org?key=PRIVATE';
 contaminated.controls[1].label='tester@example.com';
 contaminated.controls.push({id:'control-005',kind:'link',label:'BAD',rect:{x:20000,y:10,width:30,height:30}});
 contaminated.controls.push({id:'control-001',kind:'button',label:'DUPLICATE',rect:{x:500,y:10,width:60,height:40}});
 const contract=buildObservedControlContract(geometry,contaminated);
 assert.equal(contract.total,4);
 const html=generateObservedControlMapHtml(geometry,contract);
 assert.doesNotMatch(html,/<script\b|alert\(1\)|example.org|tester@example.com|DUPLICATE|PRIVATE/);
 assert.match(html,/&lt;|&gt;|\[EMAIL\]/);
});
