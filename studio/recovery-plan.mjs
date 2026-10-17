// Read-only, fail-closed guidance for an interrupted/failed Studio run.
// This is NOT a checkpoint, permission grant, or restart executor.
const modes=new Set(['rea-browser','static-html','dynamic-passive','static-visual',
 'fixture-causal','fixture-generic-catalog','fixture-generic-analytics','fixture-generic-planner']);
const statusSet=new Set(['failed','interrupted']);

export function buildRecoveryPlan({meta,report,inspection,manifest}={}){
 if(!meta||!statusSet.has(meta.status))throw Error('RECOVERY_REQUIRES_FAILED_OR_INTERRUPTED');
 const artifacts={
  report:report!==null&&report!==undefined,
  inspection:inspection!==null&&inspection!==undefined,
  manifest:manifest!==null&&manifest!==undefined
 };
 const conflict=!modes.has(meta.mode)||
  (artifacts.report&&(typeof report!=='object'||Array.isArray(report)||
   !['PASS','FAIL'].includes(report?.verdict)||
   (meta.status==='failed'&&report.verdict==='PASS')))||
  (artifacts.inspection&&(typeof inspection!=='object'||Array.isArray(inspection)||
   (typeof inspection.mode==='string'&&inspection.mode!==meta.mode)))||
  (artifacts.manifest&&(typeof manifest!=='object'||Array.isArray(manifest)));
 const evidence_status=conflict?'EVIDENCE_CONFLICT':
  Object.values(artifacts).every(Boolean)?'SAVED_ARTIFACTS_PRESENT':
  Object.values(artifacts).some(Boolean)?'PARTIAL_SAVED_EVIDENCE':'NO_SAVED_EVIDENCE';
 return {
  schema_version:1,kind:'rea-run-recovery-plan',status:'MANUAL_REVIEW_ONLY',
  run_status:meta.status,mode:modes.has(meta.mode)?meta.mode:'unknown',
  evidence_status,saved_artifacts:artifacts,
  auto_resume_allowed:false,automatic_actions_performed:0,
  source_site_refetched:false,permissions_expanded:false,
  prior_evidence_reusable_for_automatic_execution:false,
  new_run_requires_explicit_post:true,
  checkpoint_verified:false,
  next_action:conflict?'REVIEW_SAVED_EVIDENCE_CONFLICT':
   evidence_status==='NO_SAVED_EVIDENCE'?'REVIEW_FAILURE_BEFORE_NEW_RUN':
   'REVIEW_SAVED_EVIDENCE_BEFORE_NEW_RUN',
  original_site_parity_verified:false,
  limitations:['No durable action-level checkpoint proved',
   'A new capture must pass fresh target approval and explicit submission',
   'Saved report or inspection presence does not certify correctness']
 };
}
