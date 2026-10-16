import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {CONTROL_PROBE,sanitizeControlInventory,summarizePassiveDependencies,summarizeFixtureExploration} from '../studio/interaction-blueprint.mjs';

function control({tag='BUTTON',role='',type='',text='Run report',href='',x=14,y=22,w=130,h=32,expanded=null}={}){
 return {tagName:tag,type,textContent:text,disabled:false,
  getAttribute:key=>key==='role'?role:key==='href'?href:key==='aria-expanded'?expanded:null,
  getBoundingClientRect:()=>({left:x,top:y,width:w,height:h})};
}
test('F1 real DOM probe discovers controls without executing actions or reading field values',()=>{
 const password=control({tag:'INPUT',type:'password'});
 Object.defineProperty(password,'value',{get(){throw Error('F1 must never read password values')}});
 const button=control(),offsite=control({tag:'A',href:'https://elsewhere.example/?token=LEAK',text:'External site'});
 const same=control({tag:'A',href:'/reports?page=3',text:'Reports'});
 const select=control({tag:'SELECT'});
 Object.defineProperty(select,'value',{get(){throw Error('F1 must never read select value')}});
 const nodes=[button,password,offsite,same,select];
 const context={document:{querySelectorAll:()=>nodes},getComputedStyle:()=>({display:'block',visibility:'visible'}),
  location:{href:'https://approved.example/',origin:'https://approved.example',pathname:'/',search:'',hash:''},
  URL,scrollX:0,scrollY:0};
 const raw=runInNewContext(CONTROL_PROBE,context,{timeout:1000});
 const out=sanitizeControlInventory(raw);
 assert.equal(out.counts.total,5);
 assert.equal(out.counts.buttons,1);
 assert.equal(out.counts.links,2);
 assert.equal(out.counts.offsite_links,1);
 assert.equal(out.counts.inputs,1);
 assert.equal(out.counts.selects,1);
 assert.equal(out.controls[1].type,'password');
 assert.equal(out.controls[1].label,'');
 assert.equal(out.controls[2].navigation,'offsite');
 assert.equal(out.controls[3].navigation,'same-origin');
 assert.equal(out.actions_executed,0);
 assert.doesNotMatch(JSON.stringify(out),/elsewhere|token=LEAK|reports\?page=3/);
 assert.doesNotMatch(CONTROL_PROBE,/\b(?:fetch|XMLHttpRequest|click|submit|dispatchEvent|localStorage|sessionStorage)\s*\(/);
 assert.doesNotMatch(CONTROL_PROBE,/\.(?:value|innerHTML|outerHTML)\b/);
});
test('F1 sanitizes unsafe text, roles, counts and negative geometry',()=>{
 const results=sanitizeControlInventory({source:'passive-controls',candidates:900,hidden:12,
  controls:[
   {tag:'button',role:'',text:'Visit https://api.example/?token=ABC',rect:{x:3,y:4,w:120,h:35}},
   {tag:'button',role:'',text:'Contact test@example.org',rect:{x:0,y:0,w:120,h:35}},
   {tag:'a',role:'',text:'765432109876543210',nav:'offsite',rect:{x:-99999,y:0,w:180,h:40}},
   {tag:'iframe',role:'',text:'BAD',rect:{w:300,h:300}},
   {tag:'div',role:'tab',text:'Trends',expanded:'true',rect:{x:45,y:66,w:99,h:29}},
  ]});
 assert.equal(results.candidates,500);
 assert.equal(results.controls.length,4);
 assert.match(results.controls[0].label,/\[URL\]/);
 assert.match(results.controls[1].label,/\[EMAIL\]/);
 assert.equal(results.controls[2].rect.x,-10000);
 assert.equal(results.controls[3].kind,'tab');
 assert.equal(results.controls[3].expanded,'true');
 assert.equal(results.controls[3].label,'Trends');
 assert.equal(results.controls[0].id,'control-001');
 assert.equal(sanitizeControlInventory({source:'incorrect'}),null);
});
test('F2 reports network observations without claiming causality or requesting a URL',()=>{
 const evidence=summarizePassiveDependencies([
  {kind:'requested',path:'/'},{kind:'fulfilled',path:'/'},
  {kind:'fetch-attempt',host:'practice02.example.org'},
  {kind:'fetch-rejected',host:'practice02.example.org'},
  {kind:'blocked',host:'practice02.example.org'},
  {kind:'unexpected',host:'evil.example'},
 ],{counts:{total:8}},{mode:'dynamic-passive'});
 assert.equal(evidence.control_count,8);
 assert.equal(evidence.causal_links_verified,0);
 assert.equal(evidence.attribution,'none');
 assert.equal(evidence.dependencies.length,2);
 const external=evidence.dependencies.find(x=>x.host==='practice02.example.org');
 assert.equal(external.fetch_attempts,1);
 assert.equal(external.fetch_rejections,1);
 assert.equal(external.blocked,1);
 const blocked=summarizePassiveDependencies([],{counts:{total:1}},{mode:'static-visual'});
 assert.match(blocked.conclusion,/Scripts disabled/);
 assert.equal(blocked.dependencies.length,0);
});
test('F2 controlled fixture evidence has observed steps but does not invent a per-button API cause',()=>{
 const result=summarizeFixtureExploration({steps:[
  {step_id:'period-toggle',action:'click',status:'completed'},
  {step_id:'sort',action:'click',status:'completed'},
 ],network:[
  {path:'http://127.0.0.1:4317/api/trends?secret=DONT_COPY',kind:'response'},
  {path:'http://127.0.0.1:4317/api/trends?days=30',kind:'request'},
  {path:'https://external.example/secret',kind:'request'}
 ]});
 assert.equal(result.source,'controlled-fixture-scenario');
 assert.equal(result.actions_observed,2);
 assert.deepEqual(result.observed_endpoint_paths,['/api/trends']);
 assert.equal(result.execution,'controlled-only');
 assert.match(result.causality,/not linked/);
 assert.doesNotMatch(JSON.stringify(result),/secret=|days=30|external\.example/);
});
