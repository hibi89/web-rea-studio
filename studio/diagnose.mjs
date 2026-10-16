import {readdir, readFile, stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {ID_PATTERN} from './core.mjs';

const metrics=async path=>{try{return (await stat(path)).size}catch(e){if(e?.code==='ENOENT')return null;throw e;}};
function infer(message){
 const s=message.toLowerCase();
 if(/enoent|not recognized as an internal|command not found|cannot find module/.test(s))return 'EXECUTABLE_OR_MODULE_MISSING';
 if(/launch.*fail|failed to launch|executable doesn't exist|browser.*not found/.test(s))return 'BROWSER_LAUNCH_FAILED';
 if(/econnreset|etimedout|eai_again|npm err|npm error|fetch failed/.test(s))return 'NPM_OR_NETWORK_ERROR';
 if(/timeout|timed out/.test(s))return 'REA_TIMEOUT';
 if(/permission denied|eacces|eperm/.test(s))return 'FILE_ACCESS_DENIED';
 if(/invalid json|unexpected token|syntaxerror/.test(s))return 'INVALID_OUTPUT';
 return null;
}
export async function diagnoseRuns(root=join(process.cwd(),'results','studio','runs'),requestedId){
 const dir=resolve(root);
 if(requestedId!==undefined && !ID_PATTERN.test(requestedId))throw Error('Invalid run ID');
 const candidates=[];
 for(const id of await readdir(dir)){
  if(!ID_PATTERN.test(id)||(requestedId && requestedId!==id))continue;
  try{const meta=JSON.parse(await readFile(join(dir,id,'metadata.json'),'utf8'));if(meta.id===id)candidates.push(meta);}catch{}
 }
 const meta=candidates.filter(x=>requestedId||x.status==='failed').sort((a,b)=>b.created_at.localeCompare(a.created_at))[0];
 if(!meta)return {found:false,message:'No matching saved failed analysis'};
 const runDir=join(dir,meta.id);
 const errPath=join(runDir,'rea-stderr.log');
 // Never print raw stderr, API payloads, or token-bearing URLs.
 let stderr='';try{stderr=(await readFile(errPath,'utf8')).slice(-60000);}catch(e){if(e.code!=='ENOENT')throw e;}
 const diagnosis=infer(stderr)||infer(String(meta.error||''))||meta.error_code||'UNKNOWN';
 return {found:true,id:meta.id,status:meta.status,diagnosis,
  files:{scenario_bytes:await metrics(join(runDir,'scenario.json')),evidence_bytes:await metrics(join(runDir,'rea-capture.json')),stderr_bytes:await metrics(errPath),report_bytes:await metrics(join(runDir,'report.json')),inspection_bytes:await metrics(join(runDir,'inspection.json'))},
  stderr_path:`results/studio/runs/${meta.id}/rea-stderr.log`,
  next_action:diagnosis==='UNKNOWN'?'Inspect the local stderr log; do not publish raw logs.':'Use this diagnosis together with the run status to identify the failing stage.',
  privacy:'No raw stderr, browser data, credentials, or URL query values are printed.'};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
 try{console.log(JSON.stringify(await diagnoseRuns(undefined,process.argv[2]),null,2));}
 catch(e){console.error(e.message);process.exitCode=1;}
}
