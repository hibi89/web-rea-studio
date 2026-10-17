// Windows runner smoke for the same local Studio entrypoint as "npm run studio".
// No external site fetches, no user files and no REA install/download.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {request} from 'node:http';

if(process.platform!=='win32')throw Error('WINDOWS_SMOKE_REQUIRES_WINDOWS');
async function port(){
 const s=createServer();
 await new Promise((ok,bad)=>s.once('error',bad).listen(0,'127.0.0.1',ok));
 const p=s.address().port;
 await new Promise(ok=>s.close(ok));
 return p;
}
const root=await mkdtemp(join(tmpdir(),'REA Windows offline smoke with spaces '));
let child=null,phase='prepare-isolated-temporary-directory';
const safeFailure=e=>{
 if(typeof e?.message==='string'&&e.message.startsWith('STUDIO_EXITED_EARLY'))
  return 'CHILD_EXITED_EARLY';
 if(typeof e?.message==='string'&&e.message.startsWith('Windows Studio startup timed out'))
  return 'STUDIO_NOT_READY';
 if(['EADDRINUSE','EACCES','EPERM','EBUSY','ENOENT'].includes(e?.code))return e.code;
 if(e?.code==='ERR_ASSERTION')return 'ASSERTION_FAILED';
 return 'UNKNOWN_LOCAL_FAILURE';
};
try{
 let studioPort=await port(),fixturePort=await port();
 while(fixturePort===studioPort)fixturePort=await port();
 const data=join(root,'Private local evidence with spaces','runs');
 const env={...process.env,WEB_REA_DATA_DIR:data,
  // Smoke starts a disposable Studio, never imports owner's old results.
  WEB_REA_ACCEPTANCE_SMOKE:'1',
  WEB_REA_ALLOWED_URLS:'',
  STUDIO_PORT:String(studioPort),P0_PORT:String(fixturePort)};
 phase='launch-private-studio';
 child=spawn(process.execPath,['studio/start.mjs'],{
  cwd:process.cwd(),env,stdio:['ignore','pipe','pipe'],windowsHide:true,shell:false
 });
 let output='';
 child.stdout.on('data',data=>{output+=data.toString();});
 child.stderr.on('data',data=>{output+=data.toString();});
 const base='http://127.0.0.1:'+studioPort;
 phase='wait-private-studio-ready';
 let ready=false;
 for(let i=0;i<80;i++){
  if(child.exitCode!==null)throw Error('STUDIO_EXITED_EARLY: '+output.slice(-1300));
  try{
   const r=await fetch(base+'/api/runs',{signal:AbortSignal.timeout(1000)});
   if(r.status===200){ready=true;break;}
  }catch{}
  await new Promise(ok=>setTimeout(ok,200));
 }
 assert.ok(ready,'Windows Studio startup timed out: '+output.slice(-1300));
 phase='verify-local-ui';
 const page=await fetch(base+'/');
 assert.equal(page.status,200);
 assert.match(await page.text(),/Web REA Studio/i);
 phase='verify-empty-history';
 const runs=await fetch(base+'/api/runs');
 assert.deepEqual((await runs.json()).runs,[]);
 phase='verify-target-scope';
 const controls=await fetch(base+'/api/targets');
 assert.equal(controls.status,200);
 const targets=await controls.json();
 assert.equal(targets.fixture,'http://127.0.0.1:'+fixturePort+'/');
 phase='verify-local-fixture';
 const fixture=await fetch('http://127.0.0.1:'+fixturePort+'/');
 assert.equal(fixture.status,200,'Controlled fixture must start on loopback');
 // Node fetch can normalize/replace Host, so send a genuine raw Host
 // header over the same loopback TCP socket to exercise server validation.
 phase='verify-host-rejection';
 const blocked=await new Promise((resolve,reject)=>{
  const req=request(base+'/api/runs',{headers:{Host:'unapproved.invalid'}},res=>{
   let raw='';
   res.on('data',chunk=>{raw+=chunk.toString('utf8')});
   res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(raw)}));
  });
  req.once('error',reject);req.end();
 });
 assert.equal(blocked.status,403);
 assert.equal(blocked.body.error,'host_not_allowed');
 phase='verify-query-rejection';
 const query=await fetch(base+'/api/runs?anything=1');
 assert.equal(query.status,400);
 assert.equal((await query.json()).error,'unexpected_query');
 phase='verify-isolated-run-storage';
 const folders=await readdir(data);
 assert.deepEqual(folders,[],'GET-only smoke must not create capture runs');
 assert.match(output,/Local run storage outside OneDrive/);
 assert.match(output,/Legacy history imported: 0; already present: 0/);
 console.log(JSON.stringify({windows_local_studio_startup:'PASS',
  loopback_http:true,fixture_http:true,host_rejection:true,
  query_rejection:true,stored_runs:folders.length,
  data_path_contains_spaces:data.includes(' '),
  external_requests:0,rea_capture_executed:false,product_ready:false}));
}catch(e){
 // The calling acceptance tool deliberately does NOT persist raw child
 // stderr or stdout. Report only fixed-phase/category strings for diagnosis.
 console.log(JSON.stringify({windows_studio_startup:'FAIL',
  phase,reason:safeFailure(e),external_requests:0,
  legacy_import_attempted:false,product_ready:false}));
 process.exitCode=1;
}finally{
 if(child){
  child.kill();
  if(child.exitCode===null&&child.signalCode===null){
   await Promise.race([
    new Promise(ok=>child.once('close',ok)),
    new Promise(ok=>setTimeout(ok,2500))
   ]);
  }
 }
 await rm(root,{recursive:true,force:true,maxRetries:3,retryDelay:150});
}
