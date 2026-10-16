import test from 'node:test';
import assert from 'node:assert/strict';
import {buildInspection} from '../studio/inspection.mjs';
const origin='http://127.0.0.1:4317';
const text='<!doctype html><html><head><title>Trend Lab</title></head><body><button id="sort">점수 높은 순</button><input id="search" value="private-content"><div id="results">Visible</div></body></html>';
const ev={evidence_id:'ev_'+ 'a'.repeat(64),normalized_result:{browser:{product:'Chrome',version:'123',cleanup:'terminated-owned-process'},scenario:{start_origin:origin},completeness:{status:'complete'},duration_ms:40,steps:[{step_id:'initial-ready',action:'wait_for',status:'completed',elapsed_ms:20,after_url:{url:origin+'/?token=SECRET'},artifacts:{dom:{state:'captured',value:{text}},accessibility:{state:'captured'},screenshot:{state:'not_requested'}}}],events:{dropped:0,items:[{kind:'request',method:'GET',url:{url:origin+'/api/trends?token=SECRET'},headers:{'Authorization':'SECRET'}},{kind:'response',method:'GET',status:200,url:{url:origin+'/api/trends?secret=SECRET'},body:'SECRET'}]}}};
test('inspection projects only controlled fixture evidence without input values or network secrets',()=>{
 const result=buildInspection(ev,{verdict:'PASS'});
 assert.equal(result.verdict,'PASS');assert.equal(result.page.title,'Trend Lab');
 assert.equal(result.page.controls.find(x=>x.id==='sort').label,'점수 높은 순');
 assert.equal(result.page.controls.find(x=>x.id==='search').kind,'input');
 assert.equal(result.steps[0].path,origin+'/');
 assert.equal(result.network[0].path,origin+'/api/trends');
 assert.equal(result.exploration.state_transitions.source,'controlled-fixture-state-diff');
 assert.equal(result.exploration.state_transitions.steps.length,1);
 assert.equal(result.exploration.state_transitions.observed_state_changes,0);
 const json=JSON.stringify(result);for(const item of ['SECRET','private-content','Authorization']) assert.ok(!json.includes(item));
});
test('inspection rejects non-local evidence and strips external URLs',()=>{
 const a=structuredClone(ev);a.normalized_result.scenario.start_origin='https://example.com';assert.throws(()=>buildInspection(a,{verdict:'PASS'}));
 const b=structuredClone(ev);b.normalized_result.events.items.push({kind:'request',method:'GET',url:{url:'https://other.test/api'}});
 assert.equal(buildInspection(b,{verdict:'FAIL'}).network.length,2);
 assert.equal(buildInspection(b,{verdict:'FAIL'}).verdict,'FAIL');
});
