// Real Chrome evidence for bounded, non-destructive MODE1 panel-geometry repair.
// The synthetic reference moves one non-canvas panel +4px; the baseline is
// the unchanged independent builder output.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer as tcpServer} from 'node:net';
import {createServer} from 'node:http';
import {buildMvpArtifacts} from '../studio/mvp-builder.mjs';
import {compareChromeScreenshots} from '../studio/p5-visual-diff.mjs';
import {runDynamicAnalysis} from '../studio/dynamic-browser.mjs';
import {generateBoundedFaithfulCandidates,handleMvpRefinement} from '../studio/mvp-refinement.mjs';

const chrome=process.env.CHROME_BIN;
if(!chrome)throw Error('CHROME_BIN required for real Chrome refinement proof');
const SHA=b=>createHash('sha256').update(b).digest('hex');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const origin='https://mvp-faithful-offline.example.org/';
const geometry={source:'p4-geometry',viewport:{width:1440,height:900},
 document:{width:1440,height:900},background:'#f4f5f6',boxes:[
 {x:0,y:0,w:1440,h:900,depth:0,background:'#f4f5f6',border_color:'transparent',radius:'0px'},
 {x:115,y:90,w:1000,h:500,depth:1,background:'#526b88',border_color:'transparent',radius:'0px'}
 ],titles:[{x:190,y:142,w:650,h:55,text:'SYNTHETIC SAFE DASHBOARD',
  color:'#17283a',font_size:'32px',font_weight:'700'}]};
const html=buildMvpArtifacts(geometry,{theme:'paper'}).outputs.faithful.html;
const expected=generateBoundedFaithfulCandidates(html).find(p=>p.id==='region-down-4');
assert.ok(expected);
const root=await mkdtemp(join(tmpdir(),'rea-refinement-chrome-e2e-'));
let server,offlineCalls=0,refinementRenders=0;
async function capture(doc,folder){
 await mkdir(folder,{recursive:true});
 const evidence=await runDynamicAnalysis({target:origin,browserPath:chrome,dir:folder,
  scriptsDisabled:true,offlineViewport:{width:1440,height:900},relay:async url=>{
   assert.equal(url,origin);
   offlineCalls++;
   return {status:200,contentType:'text/html; charset=utf-8',body:Buffer.from(doc)};
  }});
 assert.equal(evidence.report.verdict,'PASS',JSON.stringify(evidence.report.failures));
 return readFile(join(folder,'screenshot.png'));
}
try{
 const source=await capture(expected.html,join(root,'source'));
 const baseline=await capture(html,join(root,'baseline'));
 const score=compareChromeScreenshots(source,baseline);
 assert.equal(score.dimensions_equal,true);
 assert.ok(score.rgb_mae>0,'Intentional panel shift must produce measurable baseline error');
 assert.ok(score.pixel_match_pct<100,'Shifted reference must be detectably different');
 const base=join(root,id,'mvp');await mkdir(base,{recursive:true});
 const h=Buffer.from(html);
 await writeFile(join(base,'faithful.html'),h);
 await writeFile(join(base,'manifest.json'),JSON.stringify({version:1,run_id:id,
  modes:{faithful:{sha256:SHA(h),bytes:h.length}}}));
 await writeFile(join(base,'faithful-comparison.png'),baseline);
 await writeFile(join(base,'faithful-comparison.json'),JSON.stringify({version:1,
  run_id:id,status:'MEASURED',html_sha256:SHA(h),
  original:{sha256:SHA(source)},generated:{sha256:SHA(baseline)},
  metrics:{pixel_match_pct:score.pixel_match_pct,rgb_mae:score.rgb_mae}}));
 const store={
  pathFor:()=>join(root,id),get:async()=>({mode:'static-visual',status:'completed'}),
  getInspection:async()=>({mode:'static-visual'}),
  getReport:async()=>({screenshot_saved:true,reconstruction_available:true,screenshot_sha256:SHA(source)}),
  getScreenshot:async()=>source
 };
 let port;const socket=tcpServer();
 await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));port=socket.address().port;
 await new Promise(resolve=>socket.close(resolve));
 function respond(res,status,data,type='application/json; charset=utf-8',headers={}){
  const b=Buffer.isBuffer(data)?data:Buffer.from(type.startsWith('application/json')?JSON.stringify(data):data);
  res.writeHead(status,{'Content-Type':type,'Content-Length':b.length,...headers});res.end(b);
 }
 server=createServer(async(req,res)=>{
  try{
   const ok=await handleMvpRefinement({req,res,path:new URL(req.url,'http://local').pathname,
    store,respond,studioPort:port,browserPath:chrome,
    replayExecutor:({relay,target,dir,scriptsDisabled,offlineViewport,browserPath})=>{
     assert.equal(target,origin);assert.equal(browserPath,chrome);assert.equal(scriptsDisabled,true);
     assert.deepEqual(offlineViewport,{width:1440,height:900});
     refinementRenders++;
     return runDynamicAnalysis({relay,target,dir,scriptsDisabled,offlineViewport,browserPath});
    }});
   if(!ok)respond(res,404,{error:'not_found'});
  }catch(e){respond(res,500,{error:'server_error'});}
 });
 await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+port+'/api/runs/'+id;
 assert.equal((await fetch(url+'/mvp-refinement')).status,404);
 const response=await fetch(url+'/mvp-refine',{method:'POST',headers:{Origin:new URL(url).origin}});
 assert.equal(response.status,201,'Offline refinement must complete');
 const receipt=await response.json();
 assert.equal(receipt.status,'IMPROVED',JSON.stringify(receipt));
 assert.equal(receipt.candidate_id,'region-down-4');
 assert.ok(receipt.after.pixel_match_pct>receipt.before.pixel_match_pct);
 assert.ok(receipt.after.rgb_mae<receipt.before.rgb_mae);
 assert.equal(receipt.after.pixel_match_pct,100);
 assert.equal(receipt.after.rgb_mae,0);
 assert.equal(receipt.candidate_count,8);
 assert.equal(receipt.source_site_refetched,false);
 assert.equal((await fetch(url+'/mvp-refinement')).status,200);
 assert.equal((await fetch(url+'/mvp-refined')).status,200);
 assert.equal((await fetch(url+'/mvp-refined-download')).status,200);
 assert.equal((await fetch(url+'/mvp-refined-screenshot')).status,200);
 assert.equal(await readFile(join(base,'faithful.html'),'utf8'),html,'original faithful cannot change');
 assert.equal((await fetch(url+'/mvp-refine',{method:'POST',headers:{Origin:new URL(url).origin}})).status,409);
 assert.equal(offlineCalls,2,'two synthetic source and baseline captures');
 assert.equal(refinementRenders,8,'all eight candidate independent Chrome renders');
 console.log(JSON.stringify({mvp_bounded_refinement_chrome:'PASS',
  candidates:8,source_site_contacts:0,original_html_unchanged:true,
  accepted:'region-down-4',
  pixel_match_before:receipt.before.pixel_match_pct,pixel_match_after:receipt.after.pixel_match_pct,
  rgb_mae_before:receipt.before.rgb_mae,rgb_mae_after:receipt.after.rgb_mae,
  reference:'controlled-synthetic-only',real_site_parity_verified:false}));
}finally{
 if(server?.listening)await new Promise(resolve=>server.close(resolve));
 await rm(root,{recursive:true,force:true,maxRetries:4,retryDelay:150});
}
