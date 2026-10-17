import {buildEvidenceManifest} from './evidence-manifest.mjs';
import {buildPassiveDependencyReview} from './passive-dependencies.mjs';

// Combines previously stored read-only evidence; never visits the target.
export function buildPassiveSiteBlueprint({mode,inspection,report}={}){
 if(mode!=='dynamic-passive'||inspection?.mode!=='dynamic-passive')
  throw Error('PASSIVE_BLUEPRINT_ONLY');
 const f1=buildEvidenceManifest(inspection,report);
 const f2=buildPassiveDependencyReview({mode,inspection,report});
 return {schema_version:1,kind:'read-only-f1-f2-blueprint',
  scope:'single-stored-passive-capture',network_requests_issued:0,actions_executed:0,
  controls:{verification:'presence-only',...f1.controls},
  network:{verification:'observed-only',causal_links_verified:0,
   control_to_api_links:[],dependencies:f2.dependencies,
   permission_review:f2.external_permission_review},
  evidence:{capture_verdict:report?.verdict==='PASS'?'capture-pass-not-parity':
   report?.verdict==='FAIL'?'capture-failed':'unknown',
   incomplete_network:f2.summary.missing_fetch_details,
   errors:f1.errors},
  limitations:['No page interaction or new requests','No verified control-to-API links',
   'No external host permissions or behavioral equivalence proven']};
}
