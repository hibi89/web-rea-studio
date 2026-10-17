import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {deflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {createServer as netServer} from 'node:net';
import {createStudioServer} from '../studio/server.mjs';
import {generateP4Reconstruction} from '../studio/p4-reconstruction.mjs';
import {compareChromeScreenshots,evaluateStaticVisualGate} from '../studio/p5-visual-diff.mjs';

async function freePort(){
 const srv=netServer();
 await new Promise((ok,bad)=>srv.once('error',bad).listen(0,'127.0.0.1',ok));
 const port=srv.address().port;
 await new Promise(ok=>srv.close(ok));
 return port;
}
const geometry={source:'p4-geometry',viewport:{width:320,height:240},
 document:{width:320,height:240},body_color:'rgb(200, 201, 202)',
 boxes:[{tag:'main',depth:1,x:0,y:0,w:320,h:240,
  background:'rgb(200, 201, 202)',border_width:'0px',
  border_color:'transparent',radius:'0px'}],titles:[]};
function png(){
 const w=32,h=24,rows=[];
 for(let y=0;y<h;y++){
  const row=Buffer.alloc(1+w*3);for(let x=0;x<w;x++){
   row[1+x*3]=200;row[1+x*3+1]=201;row[1+x*3+2]=202;
  }rows.push(row);
 }
 const chunk=(name,bytes)=>{
  const head=Buffer.alloc(8);head.writeUInt32BE(bytes.length,0);head.write(name,4,'ascii');
  return Buffer.concat([head,bytes,Buffer.alloc(4)]);
 };
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),
  chunk('IHDR',ihdr),chunk('IDAT',deflateSync(Buffer.concat(rows))),
  chunk('IEND',Buffer.alloc(0))]);
}
test('Studio GET audits old static data coherently and never launches Chrome, overwrites or contacts source',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'rea-p5-static-audit-route-'));
 const port=await freePort(),base='http://127.0.0.1:'+port;
 let executorCalls=0;
 const app=createStudioServer({studioPort:port,storageDir:directory,
  dynamicExecutor:async()=>{executorCalls++;throw Error('MUST_NOT_EXECUTE');}});
 try{
  await app.init();
  await new Promise((ok,bad)=>app.server.once('error',bad).listen(port,'127.0.0.1',ok));
  const meta=await app.store.create({mode:'static-visual',target_url:'https://SENSITIVE.example.org/private'});
  await app.store.update(meta.id,{status:'completed'});
  const report={verdict:'PASS',screenshot_saved:true,
   reconstruction_available:true,visual_comparison_available:true};
  await app.store.saveReport(meta.id,report);
  await app.store.saveInspection(meta.id,{mode:'static-visual',
   page:{reconstruction_blueprint:geometry,confidential_text:'SENSITIVE_PAGE_DATA'}});
  const bytes=png();
  await writeFile(join(app.store.pathFor(meta.id),'screenshot.png'),bytes);
  await writeFile(join(app.store.pathFor(meta.id),'reconstruction.png'),bytes);
  const document=generateP4Reconstruction(geometry);
  await writeFile(join(app.store.pathFor(meta.id),'reconstruction.html'),document);
  const comparison=compareChromeScreenshots(bytes,bytes);
  comparison.geometry={status:'measured-not-certified',region_match_pct:100};
  comparison.quality_gate=evaluateStaticVisualGate(comparison);
  await app.store.saveComparison(meta.id,comparison);
  const url=base+'/api/runs/'+meta.id+'/static-pipeline-audit';
  for(let attempt=0;attempt<3;attempt++){
   const response=await fetch(url);
   assert.equal(response.status,200);
   assert.match(response.headers.get('content-disposition'),/attachment/);
   assert.equal(response.headers.get('cache-control'),'no-store');
   const obj=await response.json();
   assert.equal(obj.kind,'rea-static-pipeline-offline-audit');
   assert.equal(obj.status,'OFFLINE_ARTIFACTS_VERIFIED');
   assert.equal(obj.stages.static_visual_gate.status,'THRESHOLD_MET');
   assert.equal(obj.product_ready,false);
   assert.equal(obj.browser_actions_executed,0);
   assert.equal(obj.network_requests_issued,0);
   assert.doesNotMatch(JSON.stringify(obj),/SENSITIVE|example\.org|confidential_text|private/);
  }
  const deliveryBase=base+'/api/runs/'+meta.id;
  const receiptResponse=await fetch(deliveryBase+'/delivery-receipt');
  assert.equal(receiptResponse.status,200);
  assert.match(receiptResponse.headers.get('content-disposition'),/attachment/);
  const receipt=await receiptResponse.json();
  assert.equal(receipt.export_eligible,true,JSON.stringify(receipt));
  assert.equal(receipt.product_ready,false);
  assert.equal(receipt.evidence.static_visual_gate,'THRESHOLD_MET');
  assert.equal(receipt.artifact.sha256,createHash('sha256').update(document).digest('hex'));
  assert.doesNotMatch(JSON.stringify(receipt),/SENSITIVE|example.org|reconstruction.html/i);
  const reviewed=await fetch(deliveryBase+'/reviewed-export');
  assert.equal(reviewed.status,200);
  assert.match(reviewed.headers.get('content-disposition'),/attachment/);
  assert.match(reviewed.headers.get('content-security-policy'),/script-src 'none'/);
  const reviewedHtml=await reviewed.text();
  assert.equal(reviewedHtml,document);
  assert.equal(createHash('sha256').update(reviewedHtml).digest('hex'),receipt.artifact.sha256);
  await writeFile(join(app.store.pathFor(meta.id),'reconstruction.html'),document+'<!-- tampered -->');
  const denied=await fetch(deliveryBase+'/reviewed-export');
  assert.equal(denied.status,409);
  assert.equal((await denied.json()).error,'reviewed_export_blocked');
  assert.equal((await(await fetch(deliveryBase+'/delivery-receipt')).json()).export_eligible,false);
  await writeFile(join(app.store.pathFor(meta.id),'reconstruction.html'),document);
  assert.equal(executorCalls,0);
  const current=await app.store.get(meta.id);
  assert.equal(current.status,'completed');
  const missing=await app.store.create({mode:'static-visual',target_url:'https://owner.example.org/'});
  await app.store.update(missing.id,{status:'completed'});
  const missingReport=await fetch(base+'/api/runs/'+missing.id+'/static-pipeline-audit');
  assert.equal(missingReport.status,200);
  assert.equal((await missingReport.json()).status,'INCOMPLETE');
  const mode=await app.store.create({mode:'dynamic-passive',target_url:'https://owner.example.org/'});
  await app.store.update(mode.id,{status:'completed'});
  assert.equal((await fetch(base+'/api/runs/'+mode.id+'/static-pipeline-audit')).status,404);
  assert.equal((await fetch(base+'/api/runs/'+mode.id+'/delivery-receipt')).status,404);
  const pending=await app.store.create({mode:'static-visual',target_url:'https://owner.example.org/'});
  assert.equal((await fetch(base+'/api/runs/'+pending.id+'/static-pipeline-audit')).status,409);
  assert.equal((await fetch(base+'/api/runs/'+pending.id+'/reviewed-export')).status,409);
  assert.equal((await fetch(base+'/api/runs/00000000-0000-4000-8000-000000000000/static-pipeline-audit')).status,404);
  const html=await(await fetch(base+'/')).text(),js=await(await fetch(base+'/app.js')).text();
  assert.match(html,/id="download-static-pipeline-audit"/);
  assert.match(html,/id="p4-audit-status"/);
  assert.match(js,/static-pipeline-audit/);
  assert.equal(executorCalls,0);
 }finally{
  await new Promise(ok=>app.server.close(ok));
  await rm(directory,{recursive:true,force:true});
 }
});
