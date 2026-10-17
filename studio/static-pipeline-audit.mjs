// Read-only, bounded offline audit of one already-saved static visual run.
// Never replays Chrome, requests original hosts, or trusts a saved gate alone.
import {createHash} from 'node:crypto';
import {generateP4Reconstruction,sanitizeP4Geometry} from './p4-reconstruction.mjs';
import {compareChromeScreenshots,evaluateStaticVisualGate} from './p5-visual-diff.mjs';

const digest=s=>createHash('sha256').update(s).digest('hex');
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const sameNumber=(a,b)=>finite(a)&&finite(b)&&a===b;
const png=bytes=>Buffer.isBuffer(bytes)&&bytes.length<=6*1024*1024;
const status=(ok,reason)=>({status:ok?'VERIFIED':'MISSING',reason:ok?'saved-evidence-present':reason});
export function auditSavedStaticPipeline({meta,report,inspection,comparison,html,sourcePng,replayPng}={}){
 const stages={
  source_capture:status(report?.screenshot_saved===true&&png(sourcePng),
   'original_capture_not_saved'),
  layout_evidence:status(false,'usable_static_geometry_missing'),
  independent_html:status(false,'independent_html_not_verified'),
  screenshot_comparison:status(false,'saved_comparison_not_verified'),
  static_visual_gate:{status:'UNKNOWN',reason:'comparison_not_verified'},
  functional_parity:{status:'NOT_VERIFIED',reason:'original_actions_data_and_backend_not_proven'}
 };
 const result={
  schema_version:1,kind:'rea-static-pipeline-offline-audit',
  source:'already-saved-local-static-visual-evidence',
  decision:'DO_NOT_CERTIFY_PRODUCT',
  status:'INCOMPLETE',stages,
  observed:{box_count:0,title_count:0,primitive_count:0},
  metrics:null,
  network_requests_issued:0,browser_actions_executed:0,
  original_site_refetched:false,permissions_expanded:false,
  functional_equivalence_verified:false,backend_equivalence_verified:false,
  product_ready:false,
  privacy:{url_included:false,host_included:false,html_included:false,
   page_text_included:false,screenshot_bytes_included:false,credential_included:false}
 };
 if(meta?.mode!=='static-visual'||meta.status!=='completed')return result;
 const geometry=sanitizeP4Geometry(inspection?.page?.reconstruction_blueprint);
 if(inspection?.mode==='static-visual'&&geometry?.boxes?.length){
  stages.layout_evidence.status='VERIFIED';
  stages.layout_evidence.reason='sanitized_geometry_rebuilt';
  result.observed={box_count:geometry.boxes.length,
   title_count:geometry.titles.length,primitive_count:geometry.primitives?.length||0};
 }
 const canCheck=stages.layout_evidence.status==='VERIFIED'&&
  report?.reconstruction_available===true&&typeof html==='string'&&
  Buffer.byteLength(html)<=250000;
 if(canCheck){
  let canonical=null;
  try{canonical=generateP4Reconstruction(geometry);}catch{}
  if(canonical!==null&&canonical===html){
   stages.independent_html.status='VERIFIED';
   stages.independent_html.reason='regenerated_canonical_html_byte_equal';
  }else{
   stages.independent_html.status='CONFLICT';
   stages.independent_html.reason='stored_html_differs_from_evidence';
  }
 }else if(typeof html==='string'&&report?.reconstruction_available!==true){
  stages.independent_html.status='CONFLICT';
  stages.independent_html.reason='file_present_without_report_claim';
 }
 if(report?.visual_comparison_available===true&&
    png(sourcePng)&&png(replayPng)&&comparison?.schema_version===2&&
    stages.independent_html.status==='VERIFIED'){
  try{
   const computed=compareChromeScreenshots(sourcePng,replayPng,{
    stride:comparison.downsample_stride
   });
   const keys=['rgb_mae','pixel_match_pct','coverage_pct','sample_count',
    'missing_sample_count','overlap_sample_count'];
   const metricsMatch=keys.every(k=>sameNumber(computed[k],comparison[k]))&&
    computed.dimensions_equal===comparison.dimensions_equal&&
    comparison.ignored_notice_area===false&&
    comparison.source===computed.source&&
    comparison.method===computed.method;
   if(!metricsMatch)throw Error('METRICS_MISMATCH');
   const gate=evaluateStaticVisualGate({...computed,geometry:comparison.geometry});
   if(gate.status!==comparison.quality_gate?.status||
      JSON.stringify(gate.reasons)!==JSON.stringify(comparison.quality_gate?.reasons))
    throw Error('GATE_MISMATCH');
   stages.screenshot_comparison.status='VERIFIED';
   stages.screenshot_comparison.reason='pixel_metrics_recomputed_from_saved_pngs';
   stages.static_visual_gate={
    status:gate.status==='VISUAL_THRESHOLD_MET_STATIC_ONLY'?'THRESHOLD_MET':'BLOCKED',
    reason:'static_visual_only_no_behavioral_proof'
   };
   result.metrics={rgb_mae:computed.rgb_mae,pixel_match_pct:computed.pixel_match_pct,
    coverage_pct:computed.coverage_pct,dimensions_equal:computed.dimensions_equal,
    region_match_pct:finite(comparison.geometry?.region_match_pct)?
     comparison.geometry.region_match_pct:null};
  }catch{
   stages.screenshot_comparison.status='CONFLICT';
   stages.screenshot_comparison.reason='saved_png_metrics_or_gate_inconsistent';
  }
 }else if(comparison!==null&&comparison!==undefined&&
    report?.visual_comparison_available!==true){
  stages.screenshot_comparison.status='CONFLICT';
  stages.screenshot_comparison.reason='comparison_file_without_report_claim';
 }
 // A successful audit only establishes coherent stored offline static artifacts,
 // including when the *separate* screenshot quality gate is blocked.
 if(Object.values(stages).some(x=>x.status==='CONFLICT')){
  result.status='EVIDENCE_CONFLICT';
 }else if(stages.source_capture.status==='VERIFIED'&&
  stages.layout_evidence.status==='VERIFIED'&&
  stages.independent_html.status==='VERIFIED'&&
  stages.screenshot_comparison.status==='VERIFIED'){
  result.status='OFFLINE_ARTIFACTS_VERIFIED';
 }
 // Metric values only; never raw page strings, private URL, HTML or PNG bytes.
 return result;
}
