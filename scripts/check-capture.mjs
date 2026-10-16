import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const EXPECTED_STEPS = [
  ['scenario_start','goto_start'],
  ['initial-ready','wait_for'],
  ['sort','click'],
  ['toggle-info','click'],
  ['help','click'],
  ['back','click'],
  ['final-ready','wait_for'],
];

const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const sha256 = x => createHash('sha256').update(x,'utf8').digest('hex');

export function validateCapture(document, scenario) {
  const failures=[];
  const requireCheck=(condition,code)=>{if(!condition)failures.push(code);return !!condition;};
  if(!requireCheck(isObject(document),'invalid_envelope')) return {verdict:'FAIL',failures};
  requireCheck(/^ev_[a-f0-9]{64}$/.test(document.evidence_id??''),'missing_evidence_id');
  requireCheck(document.operation==='capture_browser_scenario','wrong_operation');
  requireCheck(document.confidence==='observed','not_observed_evidence');
  requireCheck(typeof document.provider?.id==='string','missing_provider');
  const result=document.normalized_result;
  if(!requireCheck(isObject(result),'no_normalized_capture')) return {verdict:'FAIL',failures};
  requireCheck(result.browser?.mode==='launch','not_owned_browser');
  requireCheck(result.browser?.process_ownership==='provider-owned','ownership_not_confirmed');
  requireCheck(result.browser?.cleanup==='terminated-owned-process','browser_cleanup_unconfirmed');
  const complete=result.completeness;
  requireCheck(complete?.status==='complete'&&complete.equality_eligible===true,'incomplete_capture');
  const origin=result.scenario?.start_origin;
  const allowedOrigin=typeof origin==='string'&&/^http:\/\/127\.0\.0\.1:[0-9]+$/.test(origin);
  requireCheck(allowedOrigin,'unexpected_target_origin');
  if(isObject(scenario)) {
    requireCheck(scenario.start_url?.url===origin+'/','scenario_origin_mismatch');
    requireCheck(JSON.stringify((scenario.actions??[]).map(a=>[a.step_id,a.action]))===JSON.stringify(EXPECTED_STEPS.slice(1)),'unexpected_input_scenario');
    requireCheck((scenario.capture?.after_each_step??[]).includes('dom')&&(scenario.capture?.after_each_step??[]).includes('accessibility'),'missing_intermediate_capture_request');
  }
  const steps=result.steps;
  if(!requireCheck(Array.isArray(steps)&&steps.length===EXPECTED_STEPS.length,'wrong_step_count'))return {verdict:'FAIL',failures};
  requireCheck(result.scenario?.action_count===6,'wrong_action_count');
  for(let i=0;i<steps.length;i++){
    const step=steps[i], [id,action]=EXPECTED_STEPS[i];
    requireCheck(step.step_index===i && step.step_id===id&&step.action===action,`step_${i}_identity`);
    requireCheck(step.status==='completed'&&step.error===null,`step_${i}_not_completed`);
    requireCheck(step.completeness?.status==='complete',`step_${i}_incomplete`);
    requireCheck(typeof step.after_url?.url==='string'&&step.after_url.url.startsWith(origin+'/'),`step_${i}_wrong_origin`);
    for(const kind of ['dom','accessibility']){
      const artifact=step.artifacts?.[kind];
      const valid=artifact?.state==='captured'&&typeof artifact.value?.text==='string'&&artifact.value?.bytes===Buffer.byteLength(artifact.value.text,'utf8')&&artifact.value.sha256===sha256(artifact.value.text);
      requireCheck(valid,`step_${i}_${kind}_not_verified`);
    }
  }
  function domAt(i){return steps[i]?.artifacts?.dom?.value?.text??'';}
  requireCheck(steps[4]?.after_url?.url?.endsWith('#help'),'help_navigation_missing');
  requireCheck(steps[5]?.after_url?.url?.endsWith('#table'),'return_navigation_missing');
  requireCheck(/<div id="results"[^>]*data-state="ready"/.test(domAt(1)),'initial_table_not_ready');
  // Initial alphabetical sort must show Amber before Rose, then score sort Rose before Amber.
  const initialDom=domAt(1);
  requireCheck(initialDom.indexOf('<td>Amber Jelly</td>')>=0 && initialDom.indexOf('<td>Amber Jelly</td>')<initialDom.indexOf('<td>Rose Chrome</td>'),'initial_sort_not_observed');
  const sortDom=domAt(2);
  requireCheck(sortDom.includes('Rose Chrome')&&sortDom.includes('Amber Jelly')&&sortDom.indexOf('<td>Rose Chrome</td>')<sortDom.indexOf('<td>Amber Jelly</td>'),'sort_not_observed');
  requireCheck(/id="toggle-notes"[^>]*aria-expanded="true"/.test(domAt(3)),'notes_toggle_not_observed');
  requireCheck(/<section id="help"(?![^>]*\shidden(?:\s|>))/.test(domAt(4)),'help_display_not_observed');
  requireCheck(/<section id="help"\s+hidden/.test(domAt(5)),'return_display_not_observed');
  const last=domAt(6);
  requireCheck(last.includes('Trend Lab')&&last.includes('Rose Chrome')&&last.includes('Amber Jelly')&&/data-state="ready"/.test(last),'final_dom_not_observed');
  const events=result.events;
  requireCheck(Array.isArray(events?.items),'no_event_records');
  requireCheck(events?.dropped===0,'dropped_events');
  const items=Array.isArray(events?.items)?events.items:[];
  requireCheck(events?.retained===items.length,'event_count_mismatch');
  const apiRequests=items.filter(e=>e.kind==='request'&&typeof e.url?.url==='string'&&e.url.url.startsWith(origin+'/api/trends'));
  const apiResponses=items.filter(e=>e.kind==='response'&&typeof e.url?.url==='string'&&e.url.url.startsWith(origin+'/api/trends')&&e.status===200);
  requireCheck(apiRequests.length>0,'api_request_not_observed');
  requireCheck(apiResponses.length>0,'api_response_not_observed');
  requireCheck(!items.some(e=>e.kind==='page-error'||e.kind==='request-failed'),'browser_errors_detected');
  return {
    verdict:failures.length?'FAIL':'PASS',
    failures,
    evidence_id:typeof document.evidence_id==='string'?document.evidence_id:null,
    step_count:steps.length,
    completed_steps:steps.filter(x=>x.status==='completed').length,
    api_requests:apiRequests.length,
    api_responses_200:apiResponses.length,
    dropped_events:events?.dropped??null,
    completeness:complete?.status??null,
    note:'Controlled fixture only. This does not validate arbitrary sites or internal source reconstruction.',
  };
}

const isDirect=process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href;
if(isDirect){
  const outputFile=process.argv[2]??'results/rea-capture.json';
  const scenarioFile=process.argv[3]??'results/browser-scenario.json';
  try{
    const [raw,scenarioRaw]=await Promise.all([readFile(outputFile,'utf8'),readFile(scenarioFile,'utf8')]);
    const report=validateCapture(JSON.parse(raw),JSON.parse(scenarioRaw));
    console.log(JSON.stringify(report,null,2));
    if(report.verdict!=='PASS')process.exitCode=1;
  }catch(e){console.error(`Evidence verification failed: ${e.message}`);process.exitCode=1;}
}
