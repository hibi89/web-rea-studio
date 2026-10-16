import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateCapture} from './check-capture.mjs';
const origin='http://127.0.0.1:4317';
const actions=[['initial-ready','wait_for'],['sort','click'],['toggle-info','click'],['help','click'],['back','click'],['final-ready','wait_for']];
const ids=[['scenario_start','goto_start'],...actions];
const baseHtml=(detail='')=>`<section id="help" hidden></section><div id="results" data-state="ready"><table><td>Amber Jelly</td><td>Rose Chrome</td></table></div><h1>Trend Lab</h1>${detail}`;
const states=[baseHtml(),baseHtml(),'<section id="help" hidden></section><div id="results" data-state="ready"><table><td>Rose Chrome</td><td>Amber Jelly</td></table></div><h1>Trend Lab</h1>',baseHtml('<button id="toggle-notes" aria-expanded="true"></button>'),'<section id="help"></section>',baseHtml(),baseHtml()];
const artifact=(text)=>({state:'captured',value:{text,sha256:createHash('sha256').update(text).digest('hex'),bytes:Buffer.byteLength(text)}});
const url=(fragment='')=>({url:origin+(fragment.startsWith('/')?fragment:'/'+fragment),origin,query_parameter_names:[],redacted:false});
const complete={status:'complete',equality_eligible:true,missing_sections:[],truncated_sections:[]};
const scenario={start_url:{url:origin+'/'},actions:actions.map(([step_id,action])=>({step_id,action})),capture:{after_each_step:['dom','accessibility','url']}};
function valid(){
  const steps=ids.map(([step_id,action],step_index)=>({step_id,action,step_index,status:'completed',error:null,after_url:url(step_index===4?'#help':step_index>=5?'#table':''),completeness:complete,artifacts:{dom:artifact(states[step_index]),accessibility:artifact('accessible')}}));
  return {evidence_id:'ev_'+'a'.repeat(64),operation:'capture_browser_scenario',confidence:'observed',provider:{id:'playwright-browser-scenario'},normalized_result:{browser:{mode:'launch',process_ownership:'provider-owned',cleanup:'terminated-owned-process'},scenario:{start_origin:origin,action_count:6},completeness:complete,steps,events:{retained:2,dropped:0,items:[{kind:'request',url:url('/api/trends')},{kind:'response',url:url('/api/trends'),status:200}]}}};
}
test('complete controlled fixture is accepted',()=>{const actual=validateCapture(valid(),scenario);assert.equal(actual.verdict,'PASS');});
test('failed click cannot pass',()=>{const x=valid();x.normalized_result.steps[2].status='failed';assert.ok(validateCapture(x,scenario).failures.includes('step_2_not_completed'));});
test('no evidence cannot pass',()=>assert.equal(validateCapture({normalized_result:{}},scenario).verdict,'FAIL'));
test('missing DOM and malformed digest cannot pass',()=>{const x=valid();x.normalized_result.steps[6].artifacts.dom.value.sha256='b'.repeat(64);assert.ok(validateCapture(x,scenario).failures.includes('step_6_dom_not_verified'));});
test('wrong origin cannot pass',()=>{const x=valid();x.normalized_result.scenario.start_origin='https://evil.example';assert.ok(validateCapture(x,scenario).failures.includes('unexpected_target_origin'));});
test('missing API response cannot pass',()=>{const x=valid();x.normalized_result.events.items=x.normalized_result.events.items.slice(0,1);x.normalized_result.events.retained=1;assert.ok(validateCapture(x,scenario).failures.includes('api_response_not_observed'));});
test('unconfirmed browser cleanup cannot pass',()=>{const x=valid();x.normalized_result.browser.cleanup='incomplete';assert.ok(validateCapture(x,scenario).failures.includes('browser_cleanup_unconfirmed'));});
test('unexpected input scenario cannot pass',()=>{const x=structuredClone(scenario);x.actions[1].action='hover';assert.ok(validateCapture(valid(),x).failures.includes('unexpected_input_scenario'));});

test('unchanged order after click cannot pass',()=>{const x=valid();x.normalized_result.steps[2].artifacts.dom=artifact(states[1]);assert.ok(validateCapture(x,scenario).failures.includes('sort_not_observed'));});
test('wrong initial sort cannot pass',()=>{const x=valid();x.normalized_result.steps[1].artifacts.dom=artifact(states[2]);assert.ok(validateCapture(x,scenario).failures.includes('initial_sort_not_observed'));});
