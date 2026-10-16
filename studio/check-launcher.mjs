import {spawnSync} from 'node:child_process';
import {resolveNpxInvocation} from './core.mjs';

try {
 const {command,args}=resolveNpxInvocation();
 // --version is local-only: no network fetch, no REA download or browser actions.
 const result=spawnSync(command,[args[0],'--version'],{encoding:'utf8',timeout:15000,windowsHide:true,shell:false});
 if(result.error||result.status!==0)throw Error('npx-cli.js preflight failed: '+(result.error?.code||'exit '+result.status));
 const version=result.stdout.trim();
 if(!/^\d+\.\d+\.\d+/.test(version))throw Error('Unexpected npx version output');
 console.log(JSON.stringify({launcher:'node -> npx-cli.js',status:'PASS',npx_version:version,network_used:false,rea_capture_tested:false},null,2));
}catch(error){console.error(JSON.stringify({launcher:'node -> npx-cli.js',status:'FAIL',error_code:error.code||'NPX_PREFLIGHT_FAILED',message:error.message},null,2));process.exitCode=1;}
