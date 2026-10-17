// Mandatory real Chrome acceptance for strict local P4 draft import.
// Only our generated static P4 HTML is replayed from an in-memory synthetic
// HTTPS document. The user's approved source site is not revisited.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {makeStore} from '../studio/core.mjs';
import {runDynamicAnalysis} from '../studio/dynamic-browser.mjs';
import {saveIndependentDraftBundle,readIndependentDraftReceipt} from '../studio/independent-draft.mjs';

const browserPath=process.env.CHROME_BIN;
if(!browserPath)throw Error('CHROME_BIN required for independent draft acceptance');
const root=await mkdtemp(join(tmpdir(),'rea-independent-draft-chrome-'));
const geometry={
 source:'p4-geometry',viewport:{width:1440,height:900},
 document:{width:1440,height:900},body_color:'rgb(231, 235, 241)',
 boxes:[
  {tag:'body',depth:1,x:0,y:0,w:1440,h:900,
   background:'rgb(231, 235, 241)',border_color:'rgb(0, 0, 0)',
   border_width:'0px',radius:'0px'},
  {tag:'aside',depth:2,x:68,y:50,w:314,h:480,
   background:'rgb(255, 255, 255)',border_color:'rgb(0, 0, 0)',
   border_width:'0px',radius:'0px'},
  {tag:'main',depth:2,x:420,y:50,w:370,h:480,
   background:'rgb(186, 218, 239)',border_color:'rgb(0, 0, 0)',
   border_width:'0px',radius:'0px'}
 ],titles:[]
};
try{
 const store=makeStore(join(root,'runs'));
 await store.init();
 const meta=await store.create({target_url:'https://approved-but-unvisited.example.org/',
  mode:'static-visual'});
 await store.update(meta.id,{status:'completed'});
 await store.saveInspection(meta.id,{mode:'static-visual',page:{reconstruction_blueprint:geometry}});
 const stored=await saveIndependentDraftBundle({store,id:meta.id,bundle:{
  confirm:'store-scriptless-p4-draft',geometry
 },originalGeometry:geometry});
 assert.equal(stored.status,'STORED_UNVERIFIED');
 assert.equal(stored.source_draft_alignment_verified,false);
 const html=await readFile(join(store.pathFor(meta.id),'independent-draft.html'),'utf8');
 assert.match(html,/script-src &#39;none&#39;/);
 assert.doesNotMatch(html,/<script\b|<iframe\b|https?:\/\//i);
 const dir=join(root,'chrome-proof');await mkdir(dir,{recursive:true});
 const target='https://rea-draft-only.example.org/';
 let responses=0;
 const cap=await runDynamicAnalysis({target,browserPath,dir,scriptsDisabled:true,
  relay:async requested=>{
   assert.equal(requested,target,'Reject all external or unexpected document requests');
   responses++;
   return {status:200,contentType:'text/html; charset=utf-8',
    body:Buffer.from(html,'utf8')};
  }});
 assert.equal(cap.report.verdict,'PASS',JSON.stringify(cap.report.failures));
 assert.equal(responses,1,'Standalone HTML must need exactly one in-memory document response');
 assert.equal(cap.inspection?.page?.reconstruction_blueprint?.viewport?.width,1440);
 const observed=cap.inspection?.page?.reconstruction_blueprint?.boxes||[];
 assert.ok(observed.some(x=>x.tag==='div'&&x.x===68&&x.w===314),
  'Canonical HTML was independently drawn in Chrome at user supplied coordinates');
 assert.ok(!observed.some(x=>x.tag==='aside'),
  'Generated layout is not original DOM, only observed standalone painted divs');
 assert.equal((await readIndependentDraftReceipt(store,meta.id)).browser_replay_executed,false,
  'Storage receipt must not retroactively claim a browser verification');
 assert.equal((await store.get(meta.id)).status,'completed');
 console.log(JSON.stringify({p5_independent_draft_chrome:'PASS',
  saved_status:stored.status,rendered_region:'div',
  captured_x:68,captured_width:314,
  synthetic_html_responses:responses,external_network_requests:0,
  original_site_refetched:false,product_ready:false}));
}finally{await rm(root,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
