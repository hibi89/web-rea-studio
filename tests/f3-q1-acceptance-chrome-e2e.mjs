// A real Chrome pair explicitly reviewed against one saved anonymous HTML SHA.
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {makeStore} from '../studio/core.mjs';
import {reviewAnonymousLayout,readAcceptanceReceipt} from '../studio/f3-q1-acceptance.mjs';
const browserPath=process.env.CHROME_BIN;
if(!browserPath)throw Error('REAL_CHROME_REQUIRED');
const root=await mkdtemp(join(tmpdir(),'rea-anonymous-accepted-'));
const store=makeStore(root);
const mode='dynamic-passive';
const inspection={mode,screen_capture:{width:1440,height:900},
 page:{frontend_blueprint:{source:'computed-dom',viewport:{w:1440,h:900}},
  interaction_inventory:{source:'passive-controls',verification:'presence-only',
   actions_executed:0,counts:{total:3},controls:[
    {kind:'button',rect:{x:50,y:70,width:180,height:34}},
    {kind:'link',rect:{x:1030,y:180,width:210,height:34}},
    {kind:'input',rect:{x:420,y:610,width:220,height:34}}
   ]}},
 network:[{kind:'fetch-attempt',scope:'other-origin',host:'uncontacted.example.org'},
  {kind:'fetch-rejected',scope:'other-origin',host:'uncontacted.example.org'}]};
const report={analysis_mode:mode,verdict:'FAIL',
 fetch_attempts:1,fetch_rejections:1,screenshot_width:1440,screenshot_height:900};
const diagnosis={diagnosis:'PASSIVE_EXTERNAL_FETCH_REJECTED'};
try{
 await store.init();
 const meta=await store.create({target_url:'https://saved-owner.example.org/',mode});
 await store.saveInspection(meta.id,inspection);await store.saveReport(meta.id,report);
 await store.update(meta.id,{status:'failed'});
 const params={store,id:meta.id,browserPath,mode,inspection,report,diagnosis};
 const r=await reviewAnonymousLayout(params);
 assert.equal(r.status,'VERIFIED_SYNTHETIC_LAYOUT_ONLY');
 assert.deepEqual(r.views.map(x=>x.columns),[3,1]);
 assert.equal(r.external_requests,0);
 assert.equal((await readAcceptanceReceipt(params)).status,r.status);
 const changed={...params,inspection:{...inspection,screen_capture:{width:1024,height:900}}};
 const rejected=await readAcceptanceReceipt(changed);
 assert.equal(rejected.status,'EVIDENCE_CONFLICT');
 console.log(JSON.stringify({f3_q1_explicit_stored_two_view_receipt:'PASS',
  views:r.views.map(x=>({width:x.width,height:x.height,computed_columns:x.columns,
   horizontal_overflow:x.horizontal_overflow})),
  html_sha256:r.html_sha256,evidence_sha256:r.evidence_sha256,
  storage_read_only_get:true,tampered_evidence_rejected:true,
  original_site_requests:0,original_site_parity:false}));
}finally{await rm(root,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
