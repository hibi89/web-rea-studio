// Pure owner-PC offline acceptance policy. No URLs, secrets, filesystem
// paths or third-party evidence are admitted into the persisted receipt.
const VERSION=1;
// Pin the Node test runner's machine-readable reporter. Node 22/24 can
// otherwise emit different default output (TAP vs spec), depending on
// terminal/configuration, even when the tests exit successfully.
export const NODE_REGRESSION_ARGS=Object.freeze([
 '--test','--test-reporter=tap','scripts/*.test.mjs','tests/*.test.mjs'
]);
export const STEPS=Object.freeze([
 {id:'node-regressions',script:null,timeout_ms:120000},
 {id:'local-npx-launcher',script:'studio/check-launcher.mjs',timeout_ms:30000},
 {id:'windows-studio-loopback',script:'scripts/windows-studio-startup-smoke.mjs',timeout_ms:55000},
 {id:'windows-chrome-p4',script:'tests/p4-chrome-e2e.mjs',timeout_ms:150000},
 {id:'windows-chrome-saved-f5',script:'tests/p5-saved-geometry-chrome-e2e.mjs',timeout_ms:240000}
]);
const pass=(out,marker)=>{
 const lines=(out||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 for(const line of lines.reverse()){
  if(line.startsWith('{')&&line.endsWith('}')){
   try{const value=JSON.parse(line);if(value?.[marker]==='PASS')return value;}
   catch{/* multi-line logs are not evidence */ }
  }
 }
 return null;
};
const SMOKE_PHASES=new Set([
 'prepare-isolated-temporary-directory','launch-private-studio',
 'wait-private-studio-ready','verify-local-ui','verify-empty-history',
 'verify-target-scope','verify-local-fixture','verify-host-rejection',
 'verify-query-rejection','verify-isolated-run-storage'
]);
const SMOKE_REASONS=new Set([
 'CHILD_EXITED_EARLY','STUDIO_NOT_READY','EADDRINUSE','EACCES','EPERM',
 'EBUSY','ENOENT','ASSERTION_FAILED','UNKNOWN_LOCAL_FAILURE'
]);
export function extractSafeAcceptanceFailure(id,stdout=''){
 if(id!=='windows-studio-loopback')return null;
 const proof=pass(stdout,'windows_studio_startup');
 if(proof?.windows_studio_startup!=='FAIL'||!SMOKE_PHASES.has(proof.phase)||
    !SMOKE_REASONS.has(proof.reason))return null;
 return {phase:proof.phase,reason:proof.reason};
}
const nodeAllowed=(v)=>{
 const m=/^v?(22|24|[2-9][0-9])\.(\d+)\.\d+/.exec(v||'');
 if(!m)return false;
 const major=Number(m[1]),minor=Number(m[2]);
 return major===22?minor>=19:major===24?minor>=11:major>=26;
};
export function validateOwnerAcceptanceEnvironment({platform=process.platform,
 nodeVersion=process.version,chromePath='',chromeExists=false,npmExecPath=''}={}){
 if(platform!=='win32')return 'WINDOWS_REQUIRED';
 if(!nodeAllowed(nodeVersion))return 'NODE_UNSUPPORTED';
 if(!npmExecPath)return 'NPM_RUN_REQUIRED';
 if(!chromePath||!chromeExists)return 'CHROME_NOT_FOUND';
 return null;
}
export function extractSafeAcceptanceProof(id,stdout=''){
 if(id==='node-regressions'){
  // Also recognize Node's 'spec' footer from user machines that applied
  // a local reporter setting. This is a strict summary (not an exit-0
  // assumption); incomplete, conflicting or failed summaries are rejected.
  const plain=String(stdout).replace(/\x1b\[[0-9;]*m/g,'');
  const lines=plain.split(/\r?\n/).map(x=>x.trim());
  const counts={tests:[],pass:[],fail:[]};
  for(const line of lines){
   const m=/^(?:#|ℹ\uFE0F?)\s*(tests|pass|fail)\s+(\d+)\s*$/.exec(line);
   if(m)counts[m[1]].push(Number(m[2]));
  }
  if(Object.values(counts).some(a=>a.length!==1))return null;
  const [n,passed,failed]=[counts.tests[0],counts.pass[0],counts.fail[0]];
  if(!Number.isSafeInteger(n)||n<205||passed!==n||failed!==0)return null;
  return {tests:n,passed,failed:0};
 }
 if(id==='local-npx-launcher'){
  const p=stdout;
  if(!p.includes('"launcher": "node -> npx-cli.js"')||
   !p.includes('"status": "PASS"')||
   !p.includes('"network_used": false')||
   !p.includes('"rea_capture_tested": false'))return null;
  return {launch_method:'node-npx-cli',capture_executed:false};
 }
 if(id==='windows-studio-loopback'){
  const p=pass(stdout,'windows_local_studio_startup');
  if(p?.host_rejection!==true||p.query_rejection!==true||
   p.loopback_http!==true||p.fixture_http!==true||
   p.data_path_contains_spaces!==true||
   p.stored_runs!==0||p.external_requests!==0||
   p.rea_capture_executed!==false)return null;
  return {loopback:true,host_rejection:true,query_rejection:true,
   external_requests:0,capture_executed:false};
 }
 if(id==='windows-chrome-p4'){
  const p=pass(stdout,'chrome_e2e');
  if(!p||p.external_network_requests!==0||
   p.reconstructed_html_chrome_render!=='PASS'||
   !Array.isArray(p.screenshot_px)||p.screenshot_px.length!==2||
   !p.screenshot_px.every(n=>Number.isInteger(n)&&n>0))return null;
  return {real_chrome:true,scriptless_static:true,external_requests:0};
 }
 if(id==='windows-chrome-saved-f5'){
  const p=pass(stdout,'p5_saved_geometry_chrome');
  if(!p||p.accepted!==2||!Array.isArray(p.fields)||
   p.fields.join(',')!=='x,w'||p.source_site_refetched!==false||
   p.real_external_requests!==0||p.product_ready!==false||
   !Number.isFinite(p.mae_before)||!Number.isFinite(p.mae_after)||
   p.mae_after>=p.mae_before||p.independent_replays!==5)return null;
  return {accepted:2,fields:['x','w'],mae_before:p.mae_before,
   mae_after:p.mae_after,real_chrome:true,external_requests:0};
 }
 return null;
}
export async function runOwnerOfflineAcceptance({platform,nodeVersion,chromePath,
 chromeExists,npmExecPath,executor,startedAt=''}={}){
 if(typeof executor!=='function')throw Error('ACCEPTANCE_EXECUTOR_MISSING');
 const result={
  schema_version:VERSION,
  kind:'owner-pc-offline-acceptance',
  scope:'synthetic-offline-local-machine-only',
  status:'BLOCKED',platform:platform==='win32'?'windows':'other',
  started_at:startedAt,
  checks:[],original_site_contacted:false,
  original_site_api_verified:false,rea_provider_capture_tested:false,
  static_browser_verified:false,functional_product_ready:false,
  user_secrets_included:false
 };
 const invalid=validateOwnerAcceptanceEnvironment({platform,nodeVersion,
  chromePath,chromeExists,npmExecPath});
 if(invalid){
  result.checks.push({id:'preflight',status:'BLOCKED',code:invalid});
  return result;
 }
 for(const step of STEPS){
  let execution;
  try{execution=await executor({...step,chromePath});}
  catch{execution={exitCode:1,stdout:''};}
  const proof=execution.exitCode===0?
   extractSafeAcceptanceProof(step.id,execution.stdout):null;
  if(!proof){
   result.status='FAIL';
   const failure={
    id:step.id,status:'FAIL',
    code:execution.timedOut?'CHECK_TIMEOUT':
     execution.exitCode!==0?'CHECK_EXIT_NONZERO':'CHECK_PROOF_MISSING'
   };
   // A failing Windows fixture can expose only predefined, non-sensitive
   // diagnostic categories, never raw stderr, paths, URLs or console output.
   if(failure.code==='CHECK_EXIT_NONZERO'){
    const safe=extractSafeAcceptanceFailure(step.id,execution.stdout);
    if(safe)failure.diagnostic=safe;
   }
   result.checks.push(failure);
   return result;
  }
  result.checks.push({id:step.id,status:'PASS',proof});
 }
 result.status='PASS';
 result.static_browser_verified=true;
 return result;
}
