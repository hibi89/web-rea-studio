// One downloadable, content-addressed review receipt for already-saved
// verified outputs. This does NOT sign artifacts or certify the original site.
import {createHash} from 'node:crypto';

const names={
 'static-visual':'rea-reviewed-static-preview.html',
 'fixture-generic-catalog':'rea-reviewed-synthetic-catalog.html',
 'fixture-generic-analytics':'rea-reviewed-synthetic-analytics.html'
};
export function buildReviewedDelivery({meta,audit,html}={}){
 const mode=Object.hasOwn(names,meta?.mode||'')?meta.mode:null;
 const staticVisual=mode==='static-visual';
 const limited=typeof html==='string'&&
  Buffer.byteLength(html,'utf8')<=(staticVisual?250000:50000);
 const evidenceConsistent=staticVisual?
  audit?.status==='OFFLINE_ARTIFACTS_VERIFIED':
  audit?.status==='SYNTHETIC_SAVED_CHAIN_CONSISTENT';
 const qualityMet=staticVisual?
  audit?.stages?.static_visual_gate?.status==='THRESHOLD_MET':
  audit?.stages?.f5_replay_claim?.status==='CONSISTENT_SAVED_CLAIM';
 const eligible=mode!==null&&meta?.status==='completed'&&
  limited&&evidenceConsistent&&qualityMet;
 const reason=eligible?'REVIEWED_SAVED_EVIDENCE_ONLY':
  !mode?'UNSUPPORTED_MODE':
  meta?.status!=='completed'?'RUN_NOT_COMPLETE':
  !limited?'ARTIFACT_MISSING_OR_OVERSIZED':
  !evidenceConsistent?'EVIDENCE_NOT_VERIFIED':
  'VISUAL_OR_SAVED_REPLAY_GATE_NOT_MET';
 return {
  schema_version:1,kind:'rea-reviewed-offline-delivery-receipt',
  decision:eligible?'REVIEWED_EXPORT_AVAILABLE':'REVIEWED_EXPORT_BLOCKED',
  reason,analysis_scope:staticVisual?'saved-static-visual-only':
   mode?'controlled-synthetic-only':'unsupported',
  artifact:eligible?{
   filename:names[mode],bytes:Buffer.byteLength(html,'utf8'),
   sha256:createHash('sha256').update(html,'utf8').digest('hex'),
   content_type:'text/html; charset=utf-8'
  }:null,
  evidence:{
   status:typeof audit?.status==='string'&&
    ['OFFLINE_ARTIFACTS_VERIFIED','SYNTHETIC_SAVED_CHAIN_CONSISTENT',
     'EVIDENCE_CONFLICT','INCOMPLETE'].includes(audit.status)?audit.status:'INCOMPLETE',
   static_visual_gate:staticVisual?
    (audit?.stages?.static_visual_gate?.status==='THRESHOLD_MET'?'THRESHOLD_MET':'NOT_MET_OR_UNKNOWN'):
    'NOT_APPLICABLE',
   synthetic_replay:staticVisual?'NOT_APPLICABLE':
    audit?.stages?.f5_replay_claim?.status==='CONSISTENT_SAVED_CLAIM'?
     'SAVED_CLAIM_CONSISTENT_NO_FRESH_REPLAY':'NOT_VERIFIED'
  },
  export_eligible:eligible,
  artifact_sha256_signed:false,source_authenticity_verified:false,
  original_host_contacted:false,original_api_or_backend_parity:false,
  functional_equivalence_verified:false,product_ready:false,
  network_requests_issued:0,browser_actions_executed:0,
  existing_saved_files_mutated:false,
  privacy:{original_url_included:false,html_included:false,
   screenshot_bytes_included:false,source_text_included:false,
   credentials_included:false}
 };
}
