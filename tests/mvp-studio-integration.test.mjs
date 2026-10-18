import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer as netServer} from 'node:net';
import {createStudioServer} from '../studio/server.mjs';

const target='https://owned-mvp-demo.example.org/';
const geometry={
 source:'p4-geometry',viewport:{width:1440,height:900},document:{width:1440,height:900},
 body_color:'#f4f5f6',boxes:[
  {tag:'body',depth:0,x:0,y:0,w:1440,h:900,background:'#f4f5f6',border_color:'transparent',border_width:'0px',radius:'0px'},
  {tag:'main',depth:1,x:120,y:100,w:1150,h:600,background:'#ffffff',border_color:'#dedede',border_width:'1px',radius:'12px'}
 ],titles:[{tag:'h1',x:170,y:140,w:700,h:60,text:'Authorized demo dashboard',color:'#1a2434',font_size:'32px',font_weight:'700'}]
};
const data={theme:'copper',user_schema:{columns:[{name:'City',type:'text'},{name:'Count',type:'number'}]},sample_rows:[{City:'Busan',Count:20},{City:'Seoul',Count:8}]};
async function freePort(){const s=netServer();await new Promise((ok,bad)=>s.once('error',bad).listen(0,'127.0.0.1',ok));const port=s.address().port;await new Promise(ok=>s.close(ok));return port;}
async function untilDone(base,id){
 for(let i=0;i<160;i++){
  const response=await fetch(`${base}/api/runs/${id}`);assert.equal(response.status,200);
  const meta=await response.json();
  if(meta.status==='completed')return meta;
  if(['failed','interrupted'].includes(meta.status))throw Error('Source run failed: '+JSON.stringify(meta));
  await new Promise(r=>setTimeout(r,20));
 }
 throw Error('Timed out awaiting saved synthetic static-visual run');
}

test('real Studio localhost routes: approved saved visual run -> three HTML previews and downloads; GET does not recapture',async()=>{
 const port=await freePort(),fixturePort=await freePort();
 const home=await mkdtemp(join(tmpdir(),'rea-mvp-studio-e2e-'));
 let captures=0,otherBrowsers=0;
 const studio=createStudioServer({studioPort:port,fixturePort,storageDir:join(home,'runs'),browserPath:'/unused/chrome',approvedUrls:[target],
  executor:async()=>{otherBrowsers++;throw Error('REA executor must not run');},
  replayExecutor:async()=>{otherBrowsers++;throw Error('P5 Chrome must not run without screenshot');},
  dynamicExecutor:async({target:requested,scriptsDisabled})=>{
   captures++;assert.equal(requested,target);assert.equal(scriptsDisabled,true);
   return {report:{verdict:'PASS',failures:[],analysis_mode:'static-visual',screenshot_saved:false},
    inspection:{schema_version:2,scope:'explicit-https-allowlist',mode:'static-visual',page:{reconstruction_blueprint:geometry},steps:[],network:[]}};
  }
 });
 let listening=false;
 try{
  await studio.init();await new Promise((ok,bad)=>studio.server.once('error',bad).listen(port,'127.0.0.1',ok));listening=true;
  const base=`http://127.0.0.1:${port}`;
  for(const path of ['/mvp','/mvp.js','/mvp.css']){
   const res=await fetch(base+path);assert.equal(res.status,200,path);
   assert.match(res.headers.get('content-security-policy'),/default-src 'none'/);
  }
  let res=await fetch(base+'/api/runs',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({target_url:target,analysis_mode:'static-visual'})});
  assert.equal(res.status,202);const {id}=await res.json();
  assert.equal((await untilDone(base,id)).mode,'static-visual');
  assert.equal(captures,1);
  const report=await (await fetch(`${base}/api/runs/${id}/report`)).json();assert.equal(report.reconstruction_available,true);
  const endpoint=`${base}/api/runs/${id}`;
  const body=JSON.stringify(data),headers={Origin:base,'Content-Type':'application/json'};
  const forbidden=await fetch(endpoint+'/mvp-build',{method:'POST',headers:{...headers,Origin:'http://evil.example'},body});assert.equal(forbidden.status,403);
  res=await fetch(endpoint+'/mvp-build',{method:'POST',headers,body});
  assert.equal(res.status,201);const manifest=await res.json();
  assert.equal(manifest.source_site_refetched,false);
  assert.deepEqual(Object.keys(manifest.modes).sort(),['faithful','remix','schema']);
  assert.equal(manifest.row_count,2);
  for(const mode of ['faithful','remix','schema']){
   const preview=await fetch(endpoint+'/mvp/'+mode);assert.equal(preview.status,200,mode);
   assert.equal(preview.headers.get('x-frame-options'),'SAMEORIGIN');
   assert.match(preview.headers.get('content-security-policy'),/connect-src 'none'/);
   const html=await preview.text();assert.match(html,/<!doctype html>/i);
   const download=await fetch(endpoint+'/mvp/'+mode+'-download');assert.equal(download.status,200,mode);
   assert.match(download.headers.get('content-disposition'),/attachment/);
   assert.equal(await download.text(),html);
  }
  assert.match(await (await fetch(endpoint+'/mvp/schema')).text(),/Busan/);
  res=await fetch(endpoint+'/mvp-build',{method:'POST',headers,body});assert.equal(res.status,409);
  for(const path of ['/mvp','/api/runs',`/api/runs/${id}/mvp`,endpoint.replace(base,'')+'/mvp/schema']){
   const read=await fetch(base+path);assert.equal(read.status,200,path);
  }
  assert.equal(captures,1,'GET/preview must not recontact the source site');assert.equal(otherBrowsers,0);
  const artifact=join(studio.store.pathFor(id),'mvp','schema.html');
  await writeFile(artifact,'changed');
  assert.equal((await fetch(endpoint+'/mvp/schema')).status,409,'tampered generated HTML must be rejected');
  assert.equal((await readFile(join(studio.store.pathFor(id),'mvp','manifest.json'),'utf8')).includes('faithful'),true);
 }finally{
  if(listening)await new Promise(ok=>studio.server.close(ok));
  await rm(home,{recursive:true,force:true});
 }
});
