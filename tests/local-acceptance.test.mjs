import test from 'node:test';
import assert from 'node:assert/strict';
import {NODE_REGRESSION_ARGS,STEPS,validateOwnerAcceptanceEnvironment,
 extractSafeAcceptanceProof,runOwnerOfflineAcceptance} from '../scripts/local-acceptance-core.mjs';

const nodeLog='# tests 205\n# pass 205\n# fail 0\n';
const launcher='{\n  "launcher": "node -> npx-cli.js",\n  "status": "PASS",\n  "network_used": false,\n  "rea_capture_tested": false\n}\n';
const smoke=JSON.stringify({windows_local_studio_startup:'PASS',
 host_rejection:true,query_rejection:true,loopback_http:true,fixture_http:true,
 data_path_contains_spaces:true,stored_runs:0,external_requests:0,
 rea_capture_executed:false});
const p4=JSON.stringify({chrome_e2e:'PASS',
 external_network_requests:0,reconstructed_html_chrome_render:'PASS',
 screenshot_px:[1440,900]});
const f5=JSON.stringify({p5_saved_geometry_chrome:'PASS',
 accepted:2,fields:['x','w'],source_site_refetched:false,
 real_external_requests:0,product_ready:false,
 mae_before:2.41,mae_after:1.61,independent_replays:5});
const outputs={
 'node-regressions':nodeLog,'local-npx-launcher':launcher,
 'windows-studio-loopback':smoke,'windows-chrome-p4':p4,
 'windows-chrome-saved-f5':f5
};
const opts={
 platform:'win32',nodeVersion:'v22.23.3',chromePath:'C:\\Chrome\\chrome.exe',
 chromeExists:true,npmExecPath:'C:\\node\\npm-cli.js',startedAt:'2026-10-17T00:00:00.000Z'
};

test('owner acceptance exact 5 offline checks, no unauthorised site or source file payload',async()=>{
 const calls=[];
 const result=await runOwnerOfflineAcceptance({...opts,executor:async step=>{
  calls.push(step.id);
  return {exitCode:0,stdout:outputs[step.id]+'\npassword=SECRET-PLEASE-DO-NOT-STORE'};
 }});
 assert.equal(result.status,'PASS');
 assert.equal(result.static_browser_verified,true);
 assert.deepEqual(calls,STEPS.map(s=>s.id));
 assert.equal(result.checks.length,5);
 assert.equal(result.checks.at(-1).proof.mae_after,1.61);
 assert.equal(result.original_site_contacted,false);
 assert.equal(result.original_site_api_verified,false);
 assert.equal(result.rea_provider_capture_tested,false);
 assert.equal(result.functional_product_ready,false);
 assert.doesNotMatch(JSON.stringify(result),/SECRET-PLEASE|C:\\Chrome|password=|https?:\/\//);
});
test('preflight stops before launching if unsupported node, OS, npm invocation or browser',async()=>{
 const cases=[
  [{...opts,platform:'linux'},'WINDOWS_REQUIRED'],
  [{...opts,nodeVersion:'v20.17.1'},'NODE_UNSUPPORTED'],
  [{...opts,nodeVersion:'v22.18.5'},'NODE_UNSUPPORTED'],
  [{...opts,nodeVersion:'v24.10.0'},'NODE_UNSUPPORTED'],
  [{...opts,npmExecPath:''},'NPM_RUN_REQUIRED'],
  [{...opts,chromeExists:false},'CHROME_NOT_FOUND']
 ];
 for(const [input,code] of cases){
  const result=await runOwnerOfflineAcceptance({...input,
   executor:async()=>{throw Error('Should never run');}});
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.checks[0].code,code);
  assert.equal(result.checks.length,1);
 }
 assert.equal(validateOwnerAcceptanceEnvironment({...opts,nodeVersion:'v24.11.0'}),null);
 assert.equal(validateOwnerAcceptanceEnvironment({...opts,nodeVersion:'v26.0.0'}),null);
});
test('node-regressions forces cross-platform TAP output and safely parses TAP or Node spec summaries',()=>{
 assert.deepEqual([...NODE_REGRESSION_ARGS],[
  '--test','--test-reporter=tap','scripts/*.test.mjs','tests/*.test.mjs']);
 assert.deepEqual(extractSafeAcceptanceProof('node-regressions',
  '# tests 209\n# pass 209\n# fail 0\n'),
  {tests:209,passed:209,failed:0});
 assert.deepEqual(extractSafeAcceptanceProof('node-regressions',
  'ℹ tests 209\nℹ pass 209\nℹ fail 0\n'),
  {tests:209,passed:209,failed:0});
 assert.deepEqual(extractSafeAcceptanceProof('node-regressions',
  'ℹ️ tests 209\r\nℹ️ pass 209\r\nℹ️ fail 0\r\n'),
  {tests:209,passed:209,failed:0});
 assert.deepEqual(extractSafeAcceptanceProof('node-regressions',
  '\x1b[36m# tests 209\x1b[0m\n# pass 209\n# fail 0\n'),
  {tests:209,passed:209,failed:0});
 for(const invalid of [
  '✔ all tests passed',
  '# tests 209\n# pass 208\n# fail 0',
  '# tests 209\n# pass 209',
  '# tests 209\n# pass 209\n# fail 1',
  '# tests 209\n# tests 210\n# pass 209\n# fail 0',
  'ℹ tests 209\nℹ pass 209\nℹ fail 0\n# tests 3\n# pass 3\n# fail 0'
 ]){
  assert.equal(extractSafeAcceptanceProof('node-regressions',invalid),null,
   'Missing, conflicting or unverified results must be rejected');
 }
});
test('malformed or weak fixture results cannot claim Windows or Chrome acceptance',()=>{
 assert.equal(extractSafeAcceptanceProof('node-regressions','# tests 205\n# pass 204\n# fail 1'),null);
 assert.equal(extractSafeAcceptanceProof('node-regressions','# tests 3\n# pass 3\n# fail 0'),null);
 assert.equal(extractSafeAcceptanceProof('windows-chrome-p4',
  JSON.stringify({chrome_e2e:'PASS',external_network_requests:1,
   reconstructed_html_chrome_render:'PASS',screenshot_px:[1440,900]})),null);
 assert.equal(extractSafeAcceptanceProof('windows-studio-loopback',
  JSON.stringify({...JSON.parse(smoke),host_rejection:false})),null);
 assert.equal(extractSafeAcceptanceProof('windows-chrome-saved-f5',
  JSON.stringify({...JSON.parse(f5),mae_after:2.5})),null);
 assert.equal(extractSafeAcceptanceProof('windows-chrome-saved-f5',
  JSON.stringify({...JSON.parse(f5),source_site_refetched:true})),null);
});
test('child crash, timeout and bad evidence halt at first failed check with generic error only',async()=>{
 let count=0;
 const result=await runOwnerOfflineAcceptance({...opts,executor:async step=>{
  count++;
  if(step.id==='windows-studio-loopback')return {
   exitCode:0,stdout:'UNTRUSTED access_token=ABC_SECRET'};
  return {exitCode:0,stdout:outputs[step.id]};
 }});
 assert.equal(result.status,'FAIL');
 assert.equal(result.checks.at(-1).code,'CHECK_PROOF_MISSING');
 assert.equal(result.checks.length,3);
 assert.equal(count,3);
 assert.doesNotMatch(JSON.stringify(result),/SECRET|access_token/);
 const timed=await runOwnerOfflineAcceptance({...opts,
  executor:async()=>({exitCode:1,stdout:'TOKEN=private',timedOut:true})});
 assert.equal(timed.checks[0].code,'CHECK_TIMEOUT');
 assert.doesNotMatch(JSON.stringify(timed),/private/);
 const crash=await runOwnerOfflineAcceptance({...opts,
  executor:async()=>{throw Error('secret=hidden')}});
 assert.equal(crash.checks[0].code,'CHECK_EXIT_NONZERO');
 assert.doesNotMatch(JSON.stringify(crash),/hidden/);
});
