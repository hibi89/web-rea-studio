// Explicit offline-only anonymous acceptance. No source visit and no GET-side browser.
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildAnonymousGeometryPreview} from './f3-q1-geometry-preview.mjs';
import {assessAnonymousLayout} from './f3-q1-layout-proof.mjs';
import {runDynamicAnalysis} from './dynamic-browser.mjs';

export const ACCEPTANCE_FILENAME='f3-q1-layout-acceptance.json';
export const ACCEPTANCE_VIEWS=Object.freeze([
 Object.freeze({width:1440,height:900}),Object.freeze({width:390,height:844})
]);
const TARGET='https://rea-anonymous-offline-fixture.example.org/';
const sha=s=>createHash('sha256').update(s).digest('hex');
const invalid=code=>Object.assign(Error(code),{code});
export function acceptanceInputs({mode,inspection,report,diagnosis}={}){
 const preview=buildAnonymousGeometryPreview({mode,inspection,report,diagnosis});
 if(preview.status!=='OFFLINE_COARSE_GEOMETRY_PREVIEW')
  throw invalid('ANONYMOUS_SOURCE_EVIDENCE_BLOCKED');
 return {preview,evidence_sha256:sha(JSON.stringify({mode,inspection,report,diagnosis}))};
}
export function validAcceptanceReceipt(r,{preview,evidence_sha256}={}){
 if(r?.schema_version!==1||r.kind!=='rea-anonymous-two-viewport-acceptance'||
  r.status!=='VERIFIED_SYNTHETIC_LAYOUT_ONLY'||
  r.html_sha256!==preview?.receipt?.sha256||
  r.evidence_sha256!==evidence_sha256||
  r.permission_status!=='NOT_APPROVED'||r.external_requests!==0||
  r.original_site_parity_verified!==false||
  r.original_mobile_layout_verified!==false||r.product_ready!==false||
  r.original_site_refetched!==false||r.actions_executed!==0||
  !Array.isArray(r.views)||r.views.length!==2)return false;
 return ACCEPTANCE_VIEWS.every((vp,i)=>{
  const v=r.views[i];
  return v?.width===vp.width&&v.height===vp.height&&
   v.status==='PASS_GENERATED_OFFLINE_LAYOUT'&&
   v.columns===(vp.width===390?1:3)&&v.zones===9&&
   v.horizontal_overflow===false&&v.native_controls===0&&
   v.external_requests===0&&v.scripts_executed===false&&
   v.screenshot_width===vp.width&&
   Number.isSafeInteger(v.screenshot_height)&&
   v.screenshot_height>=vp.height&&v.screenshot_height<=5000;
 });
}
export async function readAcceptanceReceipt({store,id,mode,inspection,report,diagnosis}={}){
 let contents;
 try{contents=await readFile(join(store.pathFor(id),ACCEPTANCE_FILENAME),'utf8');}
 catch(e){if(e.code==='ENOENT')return null;throw e;}
 let r;
 try{r=JSON.parse(contents);}catch{return {status:'EVIDENCE_CONFLICT',reason:'INVALID_STORED_RECEIPT'};}
 let inputs;
 try{inputs=acceptanceInputs({mode,inspection,report,diagnosis});}
 catch{return {status:'EVIDENCE_CONFLICT',reason:'SOURCE_EVIDENCE_NO_LONGER_ELIGIBLE'};}
 return validAcceptanceReceipt(r,inputs)?r:
  {status:'EVIDENCE_CONFLICT',reason:'HTML_OR_EVIDENCE_HASH_MISMATCH'};
}
export async function reviewAnonymousLayout({
 store,id,browserPath,replayExecutor=runDynamicAnalysis,mode,inspection,report,diagnosis
}={}){
 const inputs=acceptanceInputs({mode,inspection,report,diagnosis});
 const {preview,evidence_sha256}=inputs;
 if(sha(preview.html)!==preview.receipt.sha256)
  throw invalid('ANONYMOUS_HTML_HASH_MISMATCH');
 const temp=await mkdtemp(join(tmpdir(),'rea-anonymous-two-view-'));
 const views=[];
 try{
  for(const vp of ACCEPTANCE_VIEWS){
   const dir=join(temp,String(vp.width));await mkdir(dir,{mode:0o700});
   let requests=0;
   const relay=async url=>{
    if(url!==TARGET||++requests!==1)throw invalid('ANONYMOUS_UNEXPECTED_RESOURCE');
    return {status:200,contentType:'text/html; charset=utf-8',
     body:Buffer.from(preview.html,'utf8')};
   };
   const output=await replayExecutor({target:TARGET,browserPath,dir,
    scriptsDisabled:true,offlineViewport:vp,observeAnonymousLayout:true,relay});
   const reportChrome=output?.report,page=output?.inspection?.page;
   const gate=assessAnonymousLayout({measurement:page?.offline_anonymous_layout,viewport:vp});
   if(requests!==1||reportChrome?.verdict!=='PASS'||
    reportChrome?.scripts_executed!==false||reportChrome?.fetch_attempts!==0||
    reportChrome?.fetch_rejections!==0||reportChrome?.resource_blocked!==0||
    reportChrome?.screenshot_width!==vp.width||
    !Number.isSafeInteger(reportChrome?.screenshot_height)||
    reportChrome.screenshot_height<vp.height||reportChrome.screenshot_height>5000||
    page?.interaction_inventory?.controls?.length!==0||
    gate.status!=='PASS_GENERATED_OFFLINE_LAYOUT')
    throw invalid('ANONYMOUS_CHROME_PROOF_FAILED');
   views.push({width:vp.width,height:vp.height,
    screenshot_width:reportChrome.screenshot_width,
    screenshot_height:reportChrome.screenshot_height,
    status:gate.status,columns:gate.computed_columns,zones:9,
    horizontal_overflow:false,native_controls:0,external_requests:0,
    scripts_executed:false});
  }
  const receipt={schema_version:1,kind:'rea-anonymous-two-viewport-acceptance',
   status:'VERIFIED_SYNTHETIC_LAYOUT_ONLY',scope:'saved-anonymous-html-only',
   html_sha256:preview.receipt.sha256,evidence_sha256,views,
   permission_status:'NOT_APPROVED',external_requests:0,actions_executed:0,
   original_site_refetched:false,original_site_parity_verified:false,
   original_mobile_layout_verified:false,product_ready:false,
   digitally_signed:false};
  if(!validAcceptanceReceipt(receipt,inputs))
   throw invalid('ANONYMOUS_RECEIPT_INTERNAL_CONFLICT');
  // Successful two-viewport results only. No partial or failure receipt.
  await writeFile(join(store.pathFor(id),ACCEPTANCE_FILENAME),
   JSON.stringify(receipt,null,2),{flag:'wx',mode:0o600});
  return receipt;
 }finally{await rm(temp,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
}
