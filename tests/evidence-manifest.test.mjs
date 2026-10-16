import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEvidenceManifest} from '../studio/evidence-manifest.mjs';

const inspection=()=>({
 mode:'static-visual',scope:'explicit-https-allowlist',
 page:{
  interaction_inventory:{source:'passive-controls',controls:[
   {kind:'button',label:'Apply filters',rect:{x:220,y:40,width:160,height:40}},
   {kind:'input',type:'password',label:'NEVER_INCLUDE',rect:{x:240,y:60,width:200,height:38}},
   {kind:'link',label:'Offsite',navigation:'offsite',rect:{x:420,y:45,width:80,height:35}}
  ]},
  reconstruction_blueprint:{source:'p4-geometry',
   viewport:{width:1440,height:900},boxes:[{tag:'aside'}],titles:[{tag:'h1'}]}
 },
 exploration:{dependencies:{source:'read-only-network-evidence',dependencies:[
  {scope:'external',host:'practice.example.org',events:4,fetch_attempts:1,fetch_rejections:1},
  {scope:'same-origin',host:null,events:1,fetch_attempts:0}
 ]}}
});
test('F3 manifest separates structural affordances and network observations from unverified effects',()=>{
 const manifest=buildEvidenceManifest(inspection(),{
  reconstruction_available:true,screenshot_saved:true,visual_comparison_available:true,failures:[]});
 assert.equal(manifest.kind,'evidence-manifest');
 assert.equal(manifest.observation_not_equivalence,true);
 assert.equal(manifest.controls.total,3);
 assert.equal(manifest.controls.items[0].effect,'not-verified');
 assert.equal(manifest.controls.items[1].type,'password');
 assert.equal(manifest.controls.items[1].label,null);
 assert.equal(manifest.network.causal_links_verified,0);
 assert.equal(manifest.network.dependencies[0].host,'practice.example.org');
 assert.equal(manifest.visual.regions,1);
 assert.equal(manifest.generated_artifacts.standalone_html,true);
 assert.equal(manifest.analysis_mode,'static-visual');
 assert.equal(manifest.findings.find(s=>s.id==='script-execution').status,'disabled');
 assert.equal(manifest.findings.find(s=>s.id==='generated-ui').status,'generated');
 assert.doesNotMatch(JSON.stringify(manifest),/NEVER_INCLUDE|input value|password=|https?:\/\/|api_key/);
});
test('F3 handles static HTML only without claiming browser evidence or working buttons',()=>{
 const manifest=buildEvidenceManifest({mode:'static-html',
  scope:'explicit-https-allowlist',page:{controls:[{kind:'button',id:'go',type:'submit'}]}},
  {verdict:'PASS',reconstruction_available:false});
 assert.equal(manifest.controls.total,1);
 assert.equal(manifest.controls.items[0].label,null);
 assert.equal(manifest.visual,null);
 assert.equal(manifest.generated_artifacts.standalone_html,false);
 assert.equal(manifest.findings.find(s=>s.id==='script-execution').status,'not-run');
});
test('F3 controlled fixture summary remains explicitly scoped and strips query strings',()=>{
 const manifest=buildEvidenceManifest({
  scope:'controlled-fixture-only',
  exploration:{source:'controlled-fixture-scenario',actions_observed:7,successful_steps:6,
   observed_endpoint_paths:['/api/trends','/api/private?token=SECRET','https://evil.example/a'],
   state_transitions:{observed_state_changes:2,steps:[
    {step_id:'toggle-info',changed:[{field:'notes_expanded',from:false,to:true}]},
    {step_id:'help',changed:[{field:'panel',from:'dashboard',to:'help'}]},
    {step_id:'injection',changed:[{field:'panel',from:'<script>',to:'bad-secret'}]}
   ]}},
  page:{controls:[]}
 },{verdict:'PASS'});
 assert.equal(manifest.analysis_mode,'rea-browser');
 assert.equal(manifest.evidence_scope,'controlled-local-fixture');
 assert.equal(manifest.controlled_scenario.executed_steps,7);
 assert.equal(manifest.controlled_scenario.observed_state_changes,2);
 assert.deepEqual(manifest.controlled_scenario.state_transitions[0].changes[0],{
  field:'notes_expanded',from:false,to:true});
 assert.deepEqual(manifest.controlled_scenario.state_transitions[2].changes[0],{
  field:'panel',from:null,to:null});
 assert.deepEqual(manifest.controlled_scenario.endpoints,['/api/trends']);
 assert.doesNotMatch(JSON.stringify(manifest),/SECRET|evil.example/);
});
test('F3 refuses unrecognized evidence mode rather than inventing a source',()=>{
 assert.throws(()=>buildEvidenceManifest(null,{}),/F3_INSPECTION_REQUIRED/);
 assert.throws(()=>buildEvidenceManifest({mode:'unverified'},{}),/F3_UNSUPPORTED_EVIDENCE/);
});
