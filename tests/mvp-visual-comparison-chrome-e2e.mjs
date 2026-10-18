// Mandatory real Chrome proof: saved synthetic source PNG vs separately rendered
// MVP faithful HTML. All documents are fulfilled in-memory, never over the wire.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {createServer as tcpServer} from 'node:net';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runDynamicAnalysis} from '../studio/dynamic-browser.mjs';
import {buildMvpArtifacts} from '../studio/mvp-builder.mjs';
import {handleMvpVisualComparison} from '../studio/mvp-visual-comparison.mjs';

const browserPath=process.env.CHROME_BIN;
if(!browserPath)throw Error('MVP_COMPARISON_REAL_CHROME_REQUIRED');
const sourceUrl='https://mvp-owned-synthetic-reference.example.org/';
const htmlSource='<!doctype html><html><head><meta charset="utf-8"><style>'+
 'html,body{margin:0;height:900px;background:rgb(244,245,246)}'+
 'main{position:absolute;left:100px;top:60px;width:1150px;height:670px;background:white;border-radius:12px}'+
 'h1{margin:30px;font:700 32px Arial;color:rgb(20,30,40)}</style></head><body>'+
 '<main><h1>Saved reference fixture</h1></main></body></html>';
const hash=s=>createHash('sha256').update(s).digest('hex');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
async function freePort(){
 const s=tcpServer();await new Promise(ok=>s.listen(0,'127.0.0.1',ok));
 const p=s.address().port;await new Promise(ok=>s.close(ok));return p;
}
const root=await mkdtemp(join(tmpdir(),'rea-mvp-offline-pixel-chrome-'));
let http=null,replays=0,syntheticSourceReads=0;
try{
 const sourceDir=join(root,'source');await mkdir(sourceDir);
 const source=await runDynamicAnalysis({target:sourceUrl,browserPath,dir:sourceDir,
  scriptsDisabled:true,offlineViewport:{width:1440,height:900},relay:async url=>{
   assert.equal(url,sourceUrl);
   syntheticSourceReads++;
   return {status:200,contentType:'text/html; charset=utf-8',body:Buffer.from(htmlSource)};
  }});
 assert.equal(source.report.verdict,'PASS',JSON.stringify(source.report.failures));
 assert.equal(source.report.screenshot_saved,true);
 assert.equal(source.report.screenshot_width,1440);
 assert.equal(source.report.screenshot_height,900);
 const geometry=source.inspection.page.reconstruction_blueprint;
 assert.equal(geometry.source,'p4-geometry');
 const build=buildMvpArtifacts(geometry,{theme:'paper'});
 const body=Buffer.from(build.outputs.faithful.html,'utf8');
 const png=await readFile(join(sourceDir,'screenshot.png'));
 const mvp=join(root,id,'mvp');await mkdir(mvp,{recursive:true});
 await writeFile(join(mvp,'faithful.html'),body);
 await writeFile(join(mvp,'manifest.json'),JSON.stringify({
  version:1,run_id:id,scope:'saved-static-visual-offline-only',
  modes:{faithful:{sha256:hash(body),bytes:body.byteLength}}
 }));
 const store={get:async()=>({mode:'static-visual',status:'completed'}),
  pathFor:()=>join(root,id),
  getReport:async()=>({...source.report,reconstruction_available:true}),
  getScreenshot:async()=>png};
 const port=await freePort();
 const respond=(res,code,data,type='application/json; charset=utf-8')=>{
  const bytes=Buffer.isBuffer(data)?data:Buffer.from(type.startsWith('application/json')?JSON.stringify(data):data);
  res.writeHead(code,{'Content-Type':type,'Content-Length':bytes.byteLength});res.end(bytes);
 };
 http=createServer(async(req,res)=>{
  try{
   const handled=await handleMvpVisualComparison({
    req,res,path:new URL(req.url,'http://local').pathname,store,respond,studioPort:port,
    browserPath,replayExecutor:async args=>{
     replays++;
     assert.equal(args.target,'https://mvp-faithful-offline.example.org/');
     assert.equal(args.scriptsDisabled,true);
     await assert.rejects(()=>args.relay(sourceUrl),/MVP_OFFLINE_ONLY/);
     return runDynamicAnalysis(args);
    }});
   if(!handled)respond(res,404,{error:'not_found'});
  }catch(e){respond(res,500,{error:'server_error'});}
 });
 await new Promise(ok=>http.listen(port,'127.0.0.1',ok));
 const url='http://127.0.0.1:'+port+'/api/runs/'+id;
 assert.equal((await fetch(url+'/mvp-comparison')).status,404);
 const created=await fetch(url+'/mvp-compare',{method:'POST',headers:{Origin:new URL(url).origin}});
 assert.equal(created.status,201,'Comparison must complete using real isolated Chrome');
 const receipt=await created.json();
 assert.equal(receipt.status,'MEASURED',JSON.stringify(receipt));
 assert.deepEqual([receipt.original.width,receipt.original.height],[1440,900]);
 assert.deepEqual([receipt.generated.width,receipt.generated.height],[1440,900]);
 assert.ok(Number.isFinite(receipt.metrics.pixel_match_pct));
 assert.ok(receipt.metrics.pixel_match_pct>=0&&receipt.metrics.pixel_match_pct<=100);
 assert.ok(Number.isFinite(receipt.metrics.rgb_mae));
 assert.equal(receipt.source_site_refetched,false);
 const screenshot=await fetch(url+'/mvp-replica-screenshot');
 assert.equal(screenshot.status,200);
 assert.equal(hash(Buffer.from(await screenshot.arrayBuffer())),receipt.generated.sha256);
 assert.equal((await fetch(url+'/mvp-comparison')).status,200);
 assert.equal(replays,1);
 assert.equal(syntheticSourceReads,1);
 console.log(JSON.stringify({mvp_reference_faithful_chrome:'PASS',
  original:[receipt.original.width,receipt.original.height],
  generated:[receipt.generated.width,receipt.generated.height],
  pixel_match_pct:receipt.metrics.pixel_match_pct,rgb_mae:receipt.metrics.rgb_mae,
  source_requests_external:0,render_requests_external:0,
  source_fixture_memory_responses:syntheticSourceReads,independent_chrome_renders:1,
  GET_chrome_reexecutions:0,real_site_parity_verified:false}));
}finally{
 if(http?.listening)await new Promise(ok=>http.close(ok));
 await rm(root,{recursive:true,force:true,maxRetries:4,retryDelay:150});
}
