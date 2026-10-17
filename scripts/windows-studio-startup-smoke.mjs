// Windows runner smoke for the same local Studio entrypoint as "npm run studio".
// No external site fetches, no user files and no REA install/download.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';

if(process.platform!=='win32')throw Error('WINDOWS_SMOKE_REQUIRES_WINDOWS');
async function port(){
 const s=createServer();
 await new Promise((ok,bad)=>s.once('error',bad).listen(0,'127.0.0.1',ok));
 const p=s.address().port;
 await new Promise(ok=>s.close(ok));
 return p;
}
const root=await mkdtemp(join(tmpdir(),'REA Windows offline smoke with spaces '));
let child=null;
try{
 let studioPort=await port(),fixturePort=await port();
 while(fixturePort===studioPort)fixturePort=await port();
 const data=join(root,'Private local evidence with spaces','runs');
 const env={...process.env,WEB_REA_DATA_DIR:data,
  STUDIO_PORT:String(studioPort),P0_PORT:String(fixturePort)};
 child=spawn(process.execPath,['studio/start.mjs'],{
  cwd:process.cwd(),env,stdio:['ignore','pipe','pipe'],windowsHide:true,shell:false
 });
 let output='';
 child.stdout.on('data',data=>{output+=data.toString();});
 child.stderr.on('data',data=>{output+=data.toString();});
 const base='http://127.0.0.1:'+studioPort;
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
 const page=await fetch(base+'/');
 assert.equal(page.status,200);
 assert.match(await page.text(),/Web REA Studio/i);
 const runs=await fetch(base+'/api/runs');
 assert.deepEqual((await runs.json()).runs,[]);
 const controls=await fetch(base+'/api/targets');
 assert.equal(controls.status,200);
 const targets=await controls.json();
 assert.equal(targets.fixture,'http://127.0.0.1:'+fixturePort+'/');
 const fixture=await fetch('http://127.0.0.1:'+fixturePort+'/');
 assert.equal(fixture.status,200,'Controlled fixture must start on loopback');
 const blocked=await fetch(base+'/api/runs',{headers:{Host:'unapproved.invalid'}});
 assert.equal(blocked.status,403);
 assert.equal((await blocked.json()).error,'host_not_allowed');
 const query=await fetch(base+'/api/runs?anything=1');
 assert.equal(query.status,400);
 assert.equal((await query.json()).error,'unexpected_query');
 const folders=await readdir(data);
 assert.deepEqual(folders,[],'GET-only smoke must not create capture runs');
 assert.match(output,/Local run storage outside OneDrive/);
 console.log(JSON.stringify({windows_local_studio_startup:'PASS',
  loopback_http:true,fixture_http:true,host_rejection:true,
  query_rejection:true,stored_runs:folders.length,
  data_path_contains_spaces:data.includes(' '),
  external_requests:0,rea_capture_executed:false,product_ready:false}));
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
