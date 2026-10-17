import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeStore, defaultRunStorageDir,validateTarget,createScenario,browserExecutable,runActualCapture,ID_PATTERN} from './core.mjs';
import {parseApprovedUrls,runStaticAnalysis} from './static-analysis.mjs';
import {runDynamicAnalysis} from './dynamic-browser.mjs';
import {diagnoseRuns} from './diagnose.mjs';
import {buildPassiveDependencyReview} from './passive-dependencies.mjs';
import {buildPassiveSiteBlueprint} from './passive-blueprint.mjs';
import {buildPassiveGapContract} from './passive-gap-contract.mjs';
import {assessF3Q1Readiness} from './f3-q1-readiness.mjs';
import {planF3Q1Work} from './f3-q1-work-plan.mjs';
import {buildPassiveWireframe,PASSIVE_WIREFRAME_CSP} from './f3-q1-wireframe.mjs';
import {buildAnonymousGeometryPreview,COARSE_GEOMETRY_CSP} from './f3-q1-geometry-preview.mjs';
import {buildPassiveSupportPacket} from './support-packet.mjs';
import {buildPassivePermissionPreflight} from './permission-preflight.mjs';
import {assessSavedQ1Failure} from './q1-failure-assessment.mjs';
import {generateP4Reconstruction,sanitizeP4Geometry} from './p4-reconstruction.mjs';
import {auditSavedStaticPipeline} from './static-pipeline-audit.mjs';
import {auditSavedControlledChain} from './controlled-chain-audit.mjs';
import {buildReviewedDelivery} from './reviewed-delivery.mjs';
import {buildObservedControlContract,generateObservedControlMapHtml} from './observed-controls.mjs';
import {compareChromeScreenshots,evaluateStaticVisualGate} from './p5-visual-diff.mjs';
import {compareP4Geometry} from './p5-geometry-diff.mjs';
import {buildEvidenceManifest} from './evidence-manifest.mjs';
import {verifyControlledF2Actions,verifyControlledF4Replay} from './controlled-f2-browser.mjs';
import {generateControlledInteractiveHtml} from './behavior-reconstruction.mjs';
import {observeGenericControlledApp,verifyGenericControlledReplay} from './generic-fixture-browser.mjs';
import {normalizeGenericBehaviorEvidence,generateGenericBehaviorHtml} from './generic-behavior.mjs';
import {buildObservedFeatureGraph,markObservedFeatureGraphVerified} from './behavior-exploration.mjs';
import {compileF3LinkedReconstructionContract,matchesStoredReconstructionContract} from './reconstruction-contract.mjs';
import {reviewSavedP5ColorRepair} from './p5-stored-review.mjs';
import {reviewSavedP5GeometryRepair} from './p5-saved-geometry-repair.mjs';
import {MAX_INDEPENDENT_DRAFT_BODY,saveIndependentDraftBundle,readIndependentDraftReceipt} from './independent-draft.mjs';

const PUBLIC=join(dirname(fileURLToPath(import.meta.url)),'public');
const CONTENT_TYPES={"/":"text/html; charset=utf-8","/app.js":"text/javascript; charset=utf-8","/style.css":"text/css; charset=utf-8"};
const jsonContent='application/json; charset=utf-8';
const MAX_BODY=4096;
const headers={
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY',
 'Content-Security-Policy':"default-src 'none'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
 'Referrer-Policy':'no-referrer',
};
const isActive=m=>['queued','running'].includes(m.status);
const safeDetail=x=>typeof x==='string'?x.slice(0,250):'Unknown error';
export function createStudioServer({fixturePort=4317,studioPort=4320,storageDir=defaultRunStorageDir(),executor=runActualCapture,staticExecutor=runStaticAnalysis,dynamicExecutor=runDynamicAnalysis,replayExecutor=runDynamicAnalysis,controlledExecutor=verifyControlledF2Actions,prototypeExecutor=verifyControlledF4Replay,genericObserver=observeGenericControlledApp,genericVerifier=verifyGenericControlledReplay,approvedUrls=parseApprovedUrls(process.env.WEB_REA_ALLOWED_URLS),browserPath=browserExecutable(),colorRepairExecutor=reviewSavedP5ColorRepair,geometryRepairExecutor=reviewSavedP5GeometryRepair}={}){
 const allowed=new Set(approvedUrls.map(url=>parseApprovedUrls(url)[0]));
 const fixtureUrl=`http://127.0.0.1:${fixturePort}/`;
 function classifyTarget(input){
  if(input===null||typeof input!=='object'||Array.isArray(input)||typeof input.target_url!=='string'||Object.keys(input).some(k=>!['target_url','analysis_mode'].includes(k)))throw Error('Only target_url and analysis_mode are accepted');
  if(input.target_url===fixtureUrl){
   const mode=input.analysis_mode??'rea-browser';
   if(!['rea-browser','fixture-causal','fixture-generic-catalog','fixture-generic-analytics','fixture-generic-planner'].includes(mode))throw Error('Fixture only supports controlled local test modes');
   validateTarget({target_url:input.target_url},fixturePort);
   return {mode,url:fixtureUrl};
  }
  if(allowed.has(input.target_url)){const requested=input.analysis_mode??'static-html';if(!['static-html','dynamic-passive','static-visual'].includes(requested))throw Error('Invalid analysis mode for approved HTTPS target');return {mode:requested,url:input.target_url};}
  throw Error('Target not approved. Configure the exact authorized HTTPS URL before starting Studio.');
 }
 const store=makeStore(storageDir);
 let active=null;
 const colorRepairActive=new Set(),colorRepairFailures=new Map();
 const geometryRepairActive=new Set(),geometryRepairFailures=new Map();
 async function begin(input){
  const {url,mode}=classifyTarget(input);
  if(active||colorRepairActive.size||geometryRepairActive.size) return {conflict:true};
  // Reservation happens before the first await; overlapping submissions cannot both start.
  active='reserved';
  try {
   const meta=await store.create({target_url:url,mode});
   active=meta.id;
   void (async()=>{
    try {
     await store.update(meta.id,{status:'running'});
     let execution,controlledEvidence=null,genericArtifacts=null;
     if(['fixture-generic-catalog','fixture-generic-analytics','fixture-generic-planner'].includes(mode)){
      const appId=mode.slice('fixture-generic-'.length);
      await store.saveInput(meta.id,{kind:mode,scope:'controlled-synthetic-only',
       app_id:appId,network:'in-memory-only',external_actions:false});
      const evidence=await genericObserver({browserPath,appId});
      if(evidence?.app_id!==appId)throw Error('F4G_PROFILE_MISMATCH');
      const permission=evidence.execution_policy;
      if(permission?.source!=='controlled-action-audit'||
         permission.scope!=='in-memory-synthetic-only'||
         permission.authorized_controls!==3||permission.denied_controls<4||
         permission.unauthorized_actions_executed!==0||
         permission.external_navigation_performed!==false||
         permission.form_submissions_performed!==0||
         !Array.isArray(permission.approved_action_ids)||
         permission.approved_action_ids.length!==3||
         !['reset',...(appId==='catalog'?['filter','layout']:appId==='analytics'?['range','chart']:['day','view'])]
           .every(action=>permission.approved_action_ids.includes(action)))
        throw Error('F2_PERMISSION_PROOF_MISSING');
      // Reject all unverified shape/transition evidence before creating code.
      const graph=normalizeGenericBehaviorEvidence(evidence);
      const planned=buildObservedFeatureGraph(evidence);
      const document=generateGenericBehaviorHtml(evidence);
      const replay=await genericVerifier({browserPath,evidence,html:document});
      const plannedCalls=planned.coverage_routes.reduce((total,route)=>
       total+route.path_edge_ids.reduce((calls,edgeId)=>
        calls+planned.edges.find(edge=>edge.id===edgeId).observed_api_requests,0),0);
      if(replay?.source!=='controlled-generic-replay'||replay.scope!=='synthetic-only'||
       replay.verified_steps!==planned.metrics.planned_clicks||replay.actual_api_calls!==0||
       replay.simulated_api_calls!==plannedCalls||replay.branching!==true)
       throw Error('F4G_REPLAY_NOT_VERIFIED');
      const verifiedGraph=markObservedFeatureGraphVerified(planned,replay);
      genericArtifacts={evidence,verifiedGraph,replay,html:document};
      await writeFile(join(store.pathFor(meta.id),'generic-prototype.html'),
       document,{flag:'wx',mode:0o600});
      await writeFile(join(store.pathFor(meta.id),'function-graph.json'),
       JSON.stringify(verifiedGraph),{flag:'wx',mode:0o600});
      const transitions=graph.edges.map(e=>({
       step_id:e.id,action:'click',status:'completed',
       network_requests:e.simulated_api_delta,
       changed:e.changed_fields.map(field=>({field,from:e.before[field],to:e.after[field]}))
      }));
      const paths=[...new Set(evidence.steps.flatMap(step=>step.endpoint_paths))].slice(0,10);
      execution={
       report:{verdict:'PASS',analysis_mode:mode,screenshot_saved:false,failures:[],
        step_count:graph.edges.length,completed_steps:replay.verified_steps,
        synthetic_fixture_only:true,generic_prototype_available:true,
        generic_replay_verified_steps:replay.verified_steps,generic_replay_real_api_calls:0,
        generic_branch_paths:2,generic_reachable_states:graph.reachable_state_count,
        generic_schema_version:graph.schema_version,
        feature_graph_available:true,
        feature_graph_source:'observed-controlled-synthetic-only',
        feature_graph_verified_edges:verifiedGraph.verification.observed_edges_verified,
        feature_graph_routes:verifiedGraph.verification.routes_verified,
        feature_graph_states:verifiedGraph.metrics.unique_states,
        feature_graph_planned_clicks:verifiedGraph.metrics.planned_clicks,
        action_policy_checked:true,approved_dom_controls:permission.authorized_controls,
        denied_dom_controls:permission.denied_controls,unauthorized_actions_executed:0},
       inspection:{schema_version:5,mode,scope:'controlled-fixture-only',
        completeness:'generated-branching-behavior-verified',
        page:{title:graph.title},
        exploration:{source:'controlled-fixture-scenario',execution:'controlled-only',
         actions_observed:graph.edges.length,successful_steps:replay.verified_steps,
         verified_action_api_links:graph.observed_action_api_links,
         feature_graph_summary:{source:'observed-function-graph',scope:'controlled-synthetic-only',
          state_count:verifiedGraph.metrics.unique_states,
          edge_count:verifiedGraph.metrics.observed_transitions,
          coverage_routes:verifiedGraph.metrics.route_count,
          verified_replay_steps:replay.verified_steps,
          relationships:verifiedGraph.relationships},
         permission_policy:{source:'controlled-action-audit',scope:'in-memory-synthetic-only',
          authorized_controls:permission.authorized_controls,
          denied_controls:permission.denied_controls,
          unauthorized_actions_executed:0,external_navigation_performed:false},
         observed_endpoint_paths:paths,
         steps:graph.edges.map(e=>({step_id:e.id,action:'click',status:'completed'})),
         state_transitions:{source:'controlled-fixture-state-diff',verification:'real-isolated-Chrome',
          steps:transitions,changed_steps:transitions.filter(t=>t.changed.length).length,
          observed_state_changes:transitions.reduce((sum,t)=>sum+t.changed.length,0)}},
        steps:graph.edges.map(e=>({step_id:e.id,action:'click',status:'completed',
         network_requests:e.simulated_api_delta,changed_fields:e.changed_fields})),
        network:evidence.steps.flatMap(step=>step.endpoint_paths.map(path=>({
         kind:'controlled-api',path,status:200,step_id:step.id}))),
        limitations:['Three in-memory synthetic fixtures only','No interactions on external sites',
         'Standalone generated app simulates, but does not reproduce, real backend requests']}
      };
     }else if(mode==='fixture-causal'){
      await store.saveInput(meta.id,{kind:mode,scope:'controlled-synthetic-only',actions:'four-fixed-synthetic-controls',network:'in-memory-only'});
      const evidence=await controlledExecutor({browserPath});
      controlledEvidence=evidence;
      if(evidence?.source!=='controlled-f2-chrome'||evidence.scope!=='in-memory-synthetic-only'||
       evidence.verified_actions!==4||evidence.verified_action_api_links!==2)
        throw Error('F2_CONTROLLED_EVIDENCE_INVALID');
      const changes=evidence.steps.map(step=>({
       step_id:step.step_id,action:step.action,status:step.status,
       network_requests:step.network_requests,
       changed:step.changed_fields.map(field=>({field,from:step.state_before[field],to:step.state_after[field]}))
      }));
      const stateTransitions={source:'controlled-fixture-state-diff',verification:'real-isolated-Chrome',
       steps:changes,changed_steps:changes.filter(step=>step.changed.length).length,
       observed_state_changes:changes.reduce((sum,step)=>sum+step.changed.length,0)};
      const endpointPaths=[...new Set(evidence.steps.flatMap(step=>step.endpoint_paths))].slice(0,6);
      execution={
       report:{verdict:'PASS',analysis_mode:mode,failures:[],step_count:4,completed_steps:4,
        screenshot_saved:false,controlled_fixture_only:true,verified_action_api_links:evidence.verified_action_api_links,
        blocked_unexpected_requests:evidence.denied_unknown_requests},
       inspection:{schema_version:4,mode,scope:'controlled-fixture-only',
        completeness:'controlled-four-action-observation',page:{title:'F2 synthetic action fixture'},
        exploration:{source:'controlled-fixture-scenario',execution:'controlled-only',
         actions_observed:4,successful_steps:4,verified_action_api_links:evidence.verified_action_api_links,
         observed_endpoint_paths:endpointPaths,steps:evidence.steps.map(step=>({
          step_id:step.step_id,action:step.action,status:step.status
         })),state_transitions:stateTransitions},
        steps:evidence.steps.map(step=>({step_id:step.step_id,action:step.action,status:step.status,
         network_requests:step.network_requests,network_paths:step.endpoint_paths,changed_fields:step.changed_fields})),
        network:evidence.steps.flatMap(step=>step.endpoint_paths.map(path=>({
         kind:'controlled-api',path,status:200,step_id:step.step_id
        }))),
        limitations:evidence.limitations}
      };
     }else if(mode==='rea-browser'){
      const scenario=createScenario(browserPath,url);
      await store.saveInput(meta.id,scenario);
      execution=await executor({scenario,dir:store.pathFor(meta.id)});
     }else if(mode==='static-html'){
      await store.saveInput(meta.id,{kind:'static-html',target_url:url,method:'GET',resources:false});
      execution=await staticExecutor({target:url,dir:store.pathFor(meta.id)});
     }else if(mode==='dynamic-passive'||mode==='static-visual'){
      const scriptsDisabled=mode==='static-visual';
      await store.saveInput(meta.id,{kind:mode,target_url:url,method:'GET',same_origin_only:true,actions:false,scripts_disabled:scriptsDisabled});
      execution=await dynamicExecutor({target:url,browserPath,dir:store.pathFor(meta.id),scriptsDisabled});
     }else throw Error('Unrecognized analysis mode');
     // Both the actual REA executor and its deterministic test double use this result contract.
     const report=execution.report;
     if(!report||!['PASS','FAIL'].includes(report.verdict))throw Error('Invalid analyzer report');
     if(mode==='fixture-causal'){
      report.behavior_reconstruction_available=false;
      report.behavior_reconstruction_status='unavailable';
      try{
       const prototypeHtml=generateControlledInteractiveHtml(controlledEvidence);
       if(Buffer.byteLength(prototypeHtml)>80000)throw Error('F4_PROTOTYPE_TOO_LARGE');
       const replay=await prototypeExecutor({browserPath,prototypeHtml});
       if(replay?.source!=='controlled-f4-replay'||
          replay.scope!=='generated-synthetic-only'||replay.passed_steps!==4||
          replay.executed_actions!==4||replay.real_api_requests!==0||
          replay.simulated_api_calls!==2||
          !Array.isArray(replay.steps)||replay.steps.length!==4)
         throw Error('F4_REPLAY_EVIDENCE_INVALID');
       for(let i=0;i<4;i++){
        if(replay.steps[i].state_after?.period!==controlledEvidence.steps[i].state_after.period||
           replay.steps[i].state_after?.rows!==controlledEvidence.steps[i].state_after.rows||
           replay.steps[i].state_after?.order!==controlledEvidence.steps[i].state_after.order||
           replay.steps[i].state_after?.view!==controlledEvidence.steps[i].state_after.view||
           replay.steps[i].state_after?.ready!==controlledEvidence.steps[i].state_after.ready)
          throw Error('F4_REPLAY_STATE_MISMATCH');
       }
       await writeFile(join(store.pathFor(meta.id),'behavior-prototype.html'),
        prototypeHtml,{flag:'wx',mode:0o600});
       report.behavior_reconstruction_available=true;
       report.behavior_reconstruction_status='verified-synthetic-only';
       report.behavior_replay_actions=4;
       report.behavior_replay_simulated_api_calls=2;
       report.behavior_replay_real_api_requests=0;
      }catch{
       report.behavior_reconstruction_status='unavailable';
      }
     }
     if(execution.inspection)await store.saveInspection(meta.id,execution.inspection);
     if(mode==='static-visual'){
      // Independent HTML reconstruction contains sanitized geometry only, not
      // the source page, remote scripts, original data or backend connections.
      const blueprint=execution.inspection?.page?.reconstruction_blueprint;
      report.reconstruction_available=false;
      report.control_map_available=false;
      report.control_map_count=0;
      report.visual_comparison_available=false;
      report.visual_comparison_status='unavailable';
      report.visual_comparison_quality_gate='VISUAL_GATE_BLOCKED';
      report.visual_comparison_product_ready=false;
      if(blueprint?.source==='p4-geometry'&&blueprint.boxes?.length){
       try{
        const document=generateP4Reconstruction(blueprint);
        if(Buffer.byteLength(document)>250000)throw Error('P4 preview too large');
        await writeFile(join(store.pathFor(meta.id),'reconstruction.html'),document,{flag:'wx',mode:0o600});
        report.reconstruction_available=true;
        // Build a separate read-only control map; keep the original geometry
        // preview unchanged so existing P5 visual measurements remain comparable.
        try{
         const contract=buildObservedControlContract(blueprint,execution.inspection?.page?.interaction_inventory);
         if(contract?.total){
          const mapped=generateObservedControlMapHtml(blueprint,contract);
          if(Buffer.byteLength(mapped)>250000)throw Error('CONTROL_MAP_TOO_LARGE');
          await writeFile(join(store.pathFor(meta.id),'control-map.html'),mapped,{flag:'wx',mode:0o600});
          await writeFile(join(store.pathFor(meta.id),'control-contract.json'),
           JSON.stringify(contract),{flag:'wx',mode:0o600});
          report.control_map_available=true;
          report.control_map_count=contract.total;
         }
        }catch{
         report.control_map_available=false;
         report.control_map_count=0;
        }
        // Optional P5 second isolated Chrome pass: load ONLY our own generated
        // HTML, from memory. All unrelated resource requests are rejected.
        if(report.screenshot_saved===true){
         const replayDir=join(store.pathFor(meta.id),'p5-replay');
         try{
          await mkdir(replayDir,{mode:0o700});
          const replay=await replayExecutor({
           target:url,browserPath,dir:replayDir,scriptsDisabled:true,
           relay:async requested=>{
            if(requested!==url)throw Error('P5_OFF_SCOPE');
            return {status:200,contentType:'text/html; charset=utf-8',body:Buffer.from(document,'utf8')};
           }
          });
          if(replay.report?.verdict!=='PASS'||replay.report?.screenshot_saved!==true)
           throw Error('P5_REPLAY_NOT_CAPTURED');
          const original=await store.getScreenshot(meta.id);
          const replica=await readFile(join(replayDir,'screenshot.png'));
          if(!original)throw Error('P5_REFERENCE_MISSING');
          const comparison=compareChromeScreenshots(original,replica);
          comparison.geometry=compareP4Geometry(blueprint,replay.inspection?.page?.reconstruction_blueprint);
          comparison.quality_gate=evaluateStaticVisualGate(comparison);
          // Only write and claim availability after both artifacts exist.
          await writeFile(join(store.pathFor(meta.id),'reconstruction.png'),replica,{flag:'wx',mode:0o600});
          await store.saveComparison(meta.id,comparison);
          report.visual_comparison_available=true;
          report.visual_comparison_status='measured';
          report.visual_comparison_rgb_mae=comparison.rgb_mae;
          report.visual_comparison_match_pct=comparison.pixel_match_pct;
          report.visual_comparison_coverage_pct=comparison.coverage_pct;
          report.visual_comparison_quality_gate=comparison.quality_gate.status;
          report.visual_comparison_product_ready=false;
         }catch{
          report.visual_comparison_available=false;
          report.visual_comparison_status='unavailable';
         }finally{await rm(replayDir,{recursive:true,force:true}).catch(()=>{});}
        }
       }catch{
        report.reconstruction_available=false;
       }
      }
     }
     report.evidence_manifest_available=false;
     if(execution.inspection){
      try{
       const manifest=buildEvidenceManifest(execution.inspection,report);
       if(genericArtifacts){
        const contract=compileF3LinkedReconstructionContract({...genericArtifacts,manifest});
        await writeFile(join(store.pathFor(meta.id),'reconstruction-contract.json'),
         JSON.stringify(contract),{flag:'wx',mode:0o600});
        report.reconstruction_contract_available=true;
       }
       await store.saveManifest(meta.id,manifest);
       report.evidence_manifest_available=true;
      }catch{
       if(genericArtifacts)throw Error('F4_CONTRACT_GENERATION_FAILED');
      }
     }
     await store.saveReport(meta.id,report);
     await store.update(meta.id,{status:report.verdict==='PASS'?'completed':'failed',verdict:report.verdict,error:report.failures?.join(', ')||null});
    }catch(e){await store.update(meta.id,{status:'failed',error:safeDetail(e?.message),error_code:typeof e?.code==='string'&&/^[A-Z_]{3,40}$/.test(e.code)?e.code:'ANALYSIS_FAILED',diagnostic_path:mode==='rea-browser'?`runs/${meta.id}/rea-stderr.log`:null}).catch(()=>{});}
    finally{active=null;}
   })();
   return {meta};
  }catch(e){active=null;throw e;}
 }
 const respond=(res,code,data,type=jsonContent,additionalHeaders={})=>{
  const body=Buffer.isBuffer(data)?data:type===jsonContent?JSON.stringify(data):data;
  res.writeHead(code,{...headers,...additionalHeaders,'Content-Type':type,'Content-Length':Buffer.byteLength(body)});res.end(body);
 };
 const server=createServer(async(req,res)=>{
  try {
   const allowedHost=`127.0.0.1:${studioPort}`;
   if(req.headers.host!==allowedHost)return respond(res,403,{error:'host_not_allowed'});
   if(!['GET','POST'].includes(req.method))return respond(res,405,{error:'method_not_allowed'});
   const u=new URL(req.url,`http://${allowedHost}`);
   if(u.search||u.hash){
    // Chat links may append utm_* tracking fields to a localhost URL.
    // Remove only well-known tracking fields on the UI landing page; keep API and
    // all other routes strict. Redirect to a fixed path to avoid reflecting input.
    const tracking=[...u.searchParams];
    const allowedLandingTracking=req.method==='GET'&&u.pathname==='/'&&!u.hash&&
      tracking.length>0&&tracking.length<=5&&
      tracking.every(([name,value])=>/^utm_(?:source|medium|campaign|term|content)$/.test(name)&&value.length<=128);
    if(allowedLandingTracking){
     res.writeHead(302,{...headers,Location:'/','Content-Length':'0'});
     return res.end();
    }
    return respond(res,400,{error:'unexpected_query'});
   }
   const path=u.pathname;
   if(req.method==='GET' && Object.hasOwn(CONTENT_TYPES,path)){
    const name=path==='/'?'index.html':path.slice(1);
    return respond(res,200,await readFile(join(PUBLIC,name)),CONTENT_TYPES[path]);
   }
   if(req.method==='GET'&&path==='/api/targets')return respond(res,200,{fixture:fixtureUrl,approved_urls:[...allowed],external_modes:['static-html','dynamic-passive','static-visual']});
   if(req.method==='GET'&&path==='/api/runs')return respond(res,200,{runs:await store.list()});
   const match=/^\/api\/runs\/([a-f0-9-]+)(?:\/(report|inspection|screenshot|diagnosis|dependencies|passive-blueprint|passive-gap-contract|f3-q1-readiness|f3-q1-work-plan|f3-q1-wireframe|f3-q1-wireframe-download|f3-q1-wireframe-receipt|f3-q1-geometry-preview|f3-q1-geometry-preview-download|f3-q1-geometry-preview-receipt|support-packet|permission-preflight|q1-assessment|reconstruction|reconstruction-download|control-map|control-map-download|control-contract|behavior-prototype|behavior-prototype-download|generic-prototype|generic-prototype-download|feature-graph|comparison|reconstruction-screenshot|static-pipeline-audit|controlled-chain-audit|delivery-receipt|reviewed-export|reconstruction-contract|manifest|color-repair|color-repair-download|independent-draft|independent-draft-download|independent-draft-starter|geometry-repair|geometry-repair-download))?$/.exec(path);
   if(req.method==='GET'&&match){
    const [,id,what]=match;
    if(!ID_PATTERN.test(id))return respond(res,400,{error:'invalid_id'});
    const meta=await store.get(id);
    if(!meta)return respond(res,404,{error:'not_found'});
    if(what==='geometry-repair'||what==='geometry-repair-download'){
     if(meta.mode!=='static-visual')return respond(res,404,{error:'geometry_repair_unavailable'});
     let result;
     try{result=JSON.parse(await readFile(join(store.pathFor(id),'geometry-repair.json'),'utf8'));}
     catch(e){if(e.code!=='ENOENT')throw e;}
     if(what==='geometry-repair-download'){
      if(result?.downloadable_improved_html!==true||
         result?.kind!=='saved-independent-p4-geometry-review'||result.accepted<1)
       return respond(res,404,{error:'verified_geometry_html_unavailable'});
      let content;
      try{content=await readFile(join(store.pathFor(id),'geometry-repair.html'),'utf8');}
      catch(e){if(e.code==='ENOENT')return respond(res,404,{error:'verified_geometry_html_unavailable'});throw e;}
      return respond(res,200,content,'text/html; charset=utf-8',{
       'Content-Disposition':'attachment; filename="rea-verified-static-geometry-correction.html"',
       'Content-Security-Policy':"default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; font-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'; sandbox"
      });
     }
     if(result)return respond(res,200,result);
     if(geometryRepairActive.has(id))
      return respond(res,202,{status:'running',kind:'offline-saved-geometry-review'});
     if(geometryRepairFailures.has(id))return respond(res,200,{
      status:'STOPPED_REPLAY_ERROR',kind:'offline-saved-geometry-review',
      product_ready:false});
     return respond(res,404,{error:'geometry_repair_not_started'});
    }
    if(what==='delivery-receipt'||what==='reviewed-export'){
      // Both outputs come from one local snapshot: no browser or original URL.
      if(!['static-visual','fixture-generic-catalog','fixture-generic-analytics','fixture-generic-planner'].includes(meta.mode))
       return respond(res,404,{error:'reviewed_delivery_not_supported'});
      if(meta.status!=='completed')
       return respond(res,409,{error:'reviewed_delivery_requires_completed_run'});
      const optional=async(name,encoding)=>{
       try{return await readFile(join(store.pathFor(id),name),encoding);}
       catch(e){if(e.code==='ENOENT')return null;throw e;}
      };
      let html=null,audit=null;
      if(meta.mode==='static-visual'){
       const [report,inspection,comparison,htmlBytes,sourcePng,replayPng]=await Promise.all([
        store.getReport(id),store.getInspection(id),store.getComparison(id),
        optional('reconstruction.html'),store.getScreenshot(id),
        store.getReconstructionScreenshot(id)
       ]);
       html=htmlBytes&&htmlBytes.length<=250000?htmlBytes.toString('utf8'):null;
       audit=auditSavedStaticPipeline({meta,report,inspection,comparison,html,
        sourcePng,replayPng});
      }else{
       const [report,inspection,manifest,graphText,artifact]=await Promise.all([
        store.getReport(id),store.getInspection(id),store.getManifest(id),
        optional('function-graph.json','utf8'),optional('generic-prototype.html','utf8')
       ]);
       let graph=null;
       if(graphText!==null){
        try{graph=JSON.parse(graphText);}catch{graph={corrupt:true};}
       }
       html=artifact;
       audit=auditSavedControlledChain({meta,report,inspection,manifest,graph,html});
      }
      const receipt=buildReviewedDelivery({meta,audit,html});
      if(what==='delivery-receipt')
       return respond(res,200,receipt,jsonContent,{
        'Content-Disposition':'attachment; filename="rea-reviewed-delivery-receipt.json"'
       });
      if(!receipt.export_eligible)return respond(res,409,{
       error:'reviewed_export_blocked',reason:receipt.reason,
       product_ready:false,source_site_verified:false});
      const contentPolicy=meta.mode==='static-visual'?
       "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; font-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'; sandbox":
       "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; font-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'";
      return respond(res,200,html,'text/html; charset=utf-8',{
       'Content-Disposition':'attachment; filename="'+receipt.artifact.filename+'"',
       'Content-Security-Policy':contentPolicy
      });
    }
    if(what==='controlled-chain-audit'){
      if(!['fixture-generic-catalog','fixture-generic-analytics','fixture-generic-planner'].includes(meta.mode))
       return respond(res,404,{error:'controlled_chain_audit_not_available'});
      if(meta.status!=='completed')
       return respond(res,409,{error:'controlled_chain_audit_requires_completed_run'});
      const readOptional=async(filename)=>{
       try{return await readFile(join(store.pathFor(id),filename),'utf8');}
       catch(e){if(e.code==='ENOENT')return null;throw e;}
      };
      const [report,inspection,manifest,graphText,html]=await Promise.all([
       store.getReport(id),store.getInspection(id),store.getManifest(id),
       readOptional('function-graph.json'),readOptional('generic-prototype.html')
      ]);
      let graph=null;
      if(graphText!==null){
       try{graph=JSON.parse(graphText);}catch{graph={corrupt:true};}
      }
      const audit=auditSavedControlledChain({meta,report,inspection,manifest,graph,html});
      return respond(res,200,audit,jsonContent,{
       'Content-Disposition':'attachment; filename="rea-controlled-synthetic-chain-audit.json"'
      });
    }
    if(what==='static-pipeline-audit'){
      if(meta.mode!=='static-visual')return respond(res,404,{error:'static_pipeline_audit_not_available'});
      if(meta.status!=='completed')return respond(res,409,{error:'static_pipeline_audit_requires_completed_run'});
      // Read persisted evidence only. No source network call, Chrome launch,
      // replay, capture mutation or permission update on this GET endpoint.
      const optional=async(filename)=>{
       try{return await readFile(join(store.pathFor(id),filename));}
       catch(e){if(e.code==='ENOENT')return null;throw e;}
      };
      const [report,inspection,comparison,htmlBytes,sourcePng,replayPng]=await Promise.all([
       store.getReport(id),store.getInspection(id),store.getComparison(id),
       optional('reconstruction.html'),store.getScreenshot(id),
       store.getReconstructionScreenshot(id)
      ]);
      const audit=auditSavedStaticPipeline({meta,report,inspection,comparison,
       html:htmlBytes&&htmlBytes.length<=250000?htmlBytes.toString('utf8'):null,
       sourcePng,replayPng});
      return respond(res,200,audit,jsonContent,{
       'Content-Disposition':'attachment; filename="rea-offline-static-pipeline-audit.json"'
      });
    }
    if(what==='independent-draft-starter'){
     if(meta.mode!=='static-visual'||meta.status!=='completed')
      return respond(res,404,{error:'draft_starter_unavailable'});
     const inspection=await store.getInspection(id);
     const geometry=sanitizeP4Geometry(inspection?.page?.reconstruction_blueprint);
     if(inspection?.mode!=='static-visual'||!geometry?.boxes?.length)
      return respond(res,404,{error:'draft_starter_unavailable'});
     return respond(res,200,{geometry},jsonContent,{
      'Content-Disposition':'attachment; filename="rea-editable-p4-geometry.json"'
     });
    }
    if(what==='independent-draft'||what==='independent-draft-download'){
     if(meta.mode!=='static-visual')return respond(res,404,{error:'independent_draft_unavailable'});
     const receipt=await readIndependentDraftReceipt(store,id);
     if(!receipt)return respond(res,404,{error:'independent_draft_not_stored'});
     if(what==='independent-draft')return respond(res,200,receipt);
     const document=await readFile(join(store.pathFor(id),'independent-draft.html'),'utf8');
     return respond(res,200,document,'text/html; charset=utf-8',{
      'Content-Disposition':'attachment; filename="rea-unverified-independent-static-draft.html"',
      'Content-Security-Policy':"default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; font-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'; sandbox"
     });
    }
    if(what==='color-repair'||what==='color-repair-download'){
     if(meta.mode!=='static-visual')return respond(res,404,{error:'color_repair_unavailable'});
     let receipt;
     try{receipt=JSON.parse(await readFile(join(store.pathFor(id),'color-repair.json'),'utf8'));}
     catch(e){if(e.code!=='ENOENT')throw e;}
     if(what==='color-repair-download'){
      if(receipt?.downloadable_improved_html!==true)return respond(res,404,{error:'improved_html_unavailable'});
      let document;
      try{document=await readFile(join(store.pathFor(id),'color-repair.html'),'utf8');}
      catch(e){if(e.code==='ENOENT')return respond(res,404,{error:'improved_html_unavailable'});throw e;}
      return respond(res,200,document,'text/html; charset=utf-8',{
       'Content-Disposition':'attachment; filename="rea-p5-bounded-color-repair.html"',
       'Content-Security-Policy':"default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; font-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'"
      });
     }
     if(receipt)return respond(res,200,receipt);
     if(colorRepairActive.has(id))return respond(res,202,{status:'running',kind:'offline-static-color-review'});
     if(colorRepairFailures.has(id))return respond(res,200,{status:'STOPPED_REPLAY_ERROR',
      kind:'offline-static-color-review',product_ready:false});
     return respond(res,404,{error:'color_repair_not_started'});
    }
    if(what==='report'){
      const report=await store.getReport(id);
      return report?respond(res,200,report):respond(res,404,{error:'report_not_ready'});
    }
    if(what==='inspection'){
      const inspection=await store.getInspection(id);
      return inspection?respond(res,200,inspection):respond(res,404,{error:'inspection_not_ready'});
    }
    if(what==='diagnosis'){
      // Redacted disk-only failure detail; no browser or external request.
      if(!['failed','interrupted'].includes(meta.status))return respond(res,409,{error:'diagnosis_only_for_failed_run'});
      const result=await diagnoseRuns(storageDir,id);
      return result.found?respond(res,200,result):respond(res,404,{error:'diagnosis_not_found'});
    }
    if(what==='dependencies'){
      if(meta.mode!=='dynamic-passive')return respond(res,404,{error:'passive_dependencies_not_available'});
      const inspection=await store.getInspection(id);
      if(!inspection)return respond(res,404,{error:'passive_inspection_not_ready'});
      const body=buildPassiveDependencyReview({mode:meta.mode,inspection,report:await store.getReport(id)});
      return respond(res,200,body,jsonContent,{'Content-Disposition':`attachment; filename="passive-dependencies-${id}.json"`});
    }
    if(what==='passive-blueprint'){
      if(meta.mode!=='dynamic-passive')return respond(res,404,{error:'passive_blueprint_not_available'});
      const inspection=await store.getInspection(id);
      if(!inspection)return respond(res,404,{error:'passive_inspection_not_ready'});
      if(inspection.mode!=='dynamic-passive')return respond(res,409,{error:'passive_evidence_mode_mismatch'});
      const blueprint=buildPassiveSiteBlueprint({mode:meta.mode,inspection,report:await store.getReport(id)});
      return respond(res,200,blueprint,jsonContent,
       {'Content-Disposition':`attachment; filename="rea-f1-f2-${id}.json"`});
    }
    if(what==='passive-gap-contract'){
      if(meta.mode!=='dynamic-passive')
       return respond(res,404,{error:'passive_gap_contract_not_available'});
      const inspection=await store.getInspection(id);
      if(!inspection)return respond(res,404,{error:'passive_inspection_not_ready'});
      if(inspection.mode!=='dynamic-passive')
       return respond(res,409,{error:'passive_evidence_mode_mismatch'});
      const contract=buildPassiveGapContract({
       mode:meta.mode,inspection,report:await store.getReport(id)});
      return respond(res,200,contract,jsonContent,{
       'Content-Disposition':`attachment; filename="rea-f3-passive-gap-${id}.json"`
      });
    }
    if(what==='support-packet'){
      if(meta.mode!=='dynamic-passive')return respond(res,404,{error:'passive_support_not_available'});
      if(!['failed','interrupted'].includes(meta.status))return respond(res,409,{error:'support_packet_only_for_failed_run'});
      const inspection=await store.getInspection(id);
      if(!inspection)return respond(res,404,{error:'passive_inspection_not_ready'});
      if(inspection.mode!=='dynamic-passive')return respond(res,409,{error:'passive_evidence_mode_mismatch'});
      const diagnosis=await diagnoseRuns(storageDir,id);
      const packet=buildPassiveSupportPacket({mode:meta.mode,inspection,report:await store.getReport(id),diagnosis});
      return respond(res,200,packet,jsonContent,{
       'Content-Disposition':`attachment; filename="rea-support-packet-${id}.json"`
      });
    }
    if(what==='permission-preflight'){
      if(meta.mode!=='dynamic-passive')return respond(res,404,{error:'passive_permission_preflight_not_available'});
      if(!['failed','interrupted'].includes(meta.status))return respond(res,409,{error:'preflight_only_for_failed_run'});
      const inspection=await store.getInspection(id);
      if(!inspection)return respond(res,404,{error:'passive_inspection_not_ready'});
      if(inspection.mode!=='dynamic-passive')return respond(res,409,{error:'passive_evidence_mode_mismatch'});
      const diagnosis=await diagnoseRuns(storageDir,id);
      const review=buildPassivePermissionPreflight({mode:meta.mode,report:await store.getReport(id),inspection,diagnosis});
      return respond(res,200,review,jsonContent,{
       'Content-Disposition':`attachment; filename="rea-q1-permission-preflight-${id}.json"`
      });
    }
    if(what==='f3-q1-readiness'){
      if(meta.mode!=='dynamic-passive')
       return respond(res,404,{error:'f3_q1_readiness_not_available'});
      if(!['failed','interrupted'].includes(meta.status))
       return respond(res,409,{error:'f3_q1_readiness_requires_failed_run'});
      const inspection=await store.getInspection(id);
      if(!inspection)return respond(res,404,{error:'passive_inspection_not_ready'});
      if(inspection.mode!=='dynamic-passive')
       return respond(res,409,{error:'passive_evidence_mode_mismatch'});
      const report=await store.getReport(id),diagnosis=await diagnoseRuns(storageDir,id);
      const review=assessF3Q1Readiness({mode:meta.mode,inspection,report,diagnosis});
      return respond(res,200,review,jsonContent,{
       'Content-Disposition':`attachment; filename="rea-f3-q1-readiness-${id}.json"`
      });
    }
    if(what==='f3-q1-work-plan'){
      if(meta.mode!=='dynamic-passive')
       return respond(res,404,{error:'f3_q1_work_plan_not_available'});
      if(!['failed','interrupted'].includes(meta.status))
       return respond(res,409,{error:'f3_q1_work_plan_requires_failed_run'});
      const inspection=await store.getInspection(id);
      if(!inspection)return respond(res,404,{error:'passive_inspection_not_ready'});
      if(inspection.mode!=='dynamic-passive')
       return respond(res,409,{error:'passive_evidence_mode_mismatch'});
      const report=await store.getReport(id),diagnosis=await diagnoseRuns(storageDir,id);
      const plan=planF3Q1Work({mode:meta.mode,inspection,report,diagnosis});
      return respond(res,200,plan,jsonContent,{
       'Content-Disposition':`attachment; filename="rea-f3-q1-work-plan-${id}.json"`
      });
    }
    if(['f3-q1-wireframe','f3-q1-wireframe-download','f3-q1-wireframe-receipt'].includes(what)){
      if(meta.mode!=='dynamic-passive')
       return respond(res,404,{error:'f3_q1_wireframe_not_available'});
      if(!['failed','interrupted'].includes(meta.status))
       return respond(res,409,{error:'f3_q1_wireframe_requires_failed_run'});
      const inspection=await store.getInspection(id);
      if(!inspection)return respond(res,404,{error:'passive_inspection_not_ready'});
      if(inspection.mode!=='dynamic-passive')
       return respond(res,409,{error:'passive_evidence_mode_mismatch'});
      const report=await store.getReport(id),diagnosis=await diagnoseRuns(storageDir,id);
      const generated=buildPassiveWireframe({mode:meta.mode,inspection,report,diagnosis});
      if(generated.status!=='OFFLINE_NONINTERACTIVE_PREVIEW')
       return respond(res,409,{error:'f3_q1_wireframe_blocked',
        reason:generated.receipt.reason,receipt:generated.receipt});
      if(what==='f3-q1-wireframe-receipt')
       return respond(res,200,generated.receipt,jsonContent,{
        'Content-Disposition':`attachment; filename="rea-f3-q1-wireframe-receipt-${id}.json"`
       });
      const download=what==='f3-q1-wireframe-download';
      return respond(res,200,generated.html,'text/html; charset=utf-8',{
       'Content-Disposition':(download?'attachment':'inline')+
        '; filename="rea-anonymous-offline-wireframe.html"',
       'Content-Security-Policy':PASSIVE_WIREFRAME_CSP,
       'X-Content-Type-Options':'nosniff'
      });
    }
    if(['f3-q1-geometry-preview','f3-q1-geometry-preview-download',
      'f3-q1-geometry-preview-receipt'].includes(what)){
      if(meta.mode!=='dynamic-passive')
       return respond(res,404,{error:'coarse_geometry_preview_not_available'});
      if(!['failed','interrupted'].includes(meta.status))
       return respond(res,409,{error:'coarse_geometry_requires_failed_run'});
      const inspection=await store.getInspection(id);
      if(!inspection)return respond(res,404,{error:'passive_inspection_not_ready'});
      if(inspection.mode!=='dynamic-passive')
       return respond(res,409,{error:'passive_evidence_mode_mismatch'});
      const report=await store.getReport(id),diagnosis=await diagnoseRuns(storageDir,id);
      const generated=buildAnonymousGeometryPreview({
       mode:meta.mode,inspection,report,diagnosis
      });
      if(generated.status!=='OFFLINE_COARSE_GEOMETRY_PREVIEW')
       return respond(res,409,{error:'coarse_geometry_preview_blocked',
        reason:generated.receipt.reason,receipt:generated.receipt});
      if(what==='f3-q1-geometry-preview-receipt')
       return respond(res,200,generated.receipt,jsonContent,{
        'Content-Disposition':`attachment; filename="rea-f3-q1-coarse-geometry-${id}.json"`
       });
      const attachment=what==='f3-q1-geometry-preview-download';
      return respond(res,200,generated.html,'text/html; charset=utf-8',{
       'Content-Disposition':(attachment?'attachment':'inline')+
        '; filename="rea-f3-q1-anonymous-zones.html"',
       'Content-Security-Policy':COARSE_GEOMETRY_CSP,
       'X-Content-Type-Options':'nosniff'
      });
    }
    if(what==='q1-assessment'){
      if(meta.mode!=='dynamic-passive')return respond(res,404,{error:'q1_assessment_not_available'});
      if(!['failed','interrupted'].includes(meta.status))return respond(res,409,{error:'q1_assessment_only_for_failed_run'});
      const inspection=await store.getInspection(id);
      if(!inspection)return respond(res,404,{error:'passive_inspection_not_ready'});
      if(inspection.mode!=='dynamic-passive')return respond(res,409,{error:'passive_evidence_mode_mismatch'});
      const report=await store.getReport(id),diagnosis=await diagnoseRuns(storageDir,id);
      const options={mode:meta.mode,report,inspection,diagnosis};
      const assessment=assessSavedQ1Failure({
       packet:buildPassiveSupportPacket(options),preflight:buildPassivePermissionPreflight(options)
      });
      return respond(res,200,assessment,jsonContent,{
       'Content-Disposition':`attachment; filename="rea-q1-assessment-${id}.json"`
      });
    }
    if(what==='screenshot'){
      const png=await store.getScreenshot(id);
      return png?respond(res,200,png,'image/png'):respond(res,404,{error:'screenshot_not_ready'});
    }
    if(what==='reconstruction-contract'){
      if(!['fixture-generic-catalog','fixture-generic-analytics','fixture-generic-planner'].includes(meta.mode)||
         meta.status!=='completed')return respond(res,404,{error:'reconstruction_contract_not_available'});
      const report=await store.getReport(id);
      if(report?.reconstruction_contract_available!==true)
       return respond(res,404,{error:'reconstruction_contract_not_available'});
      let contract,graph,manifest,html;
      try{
       const base=store.pathFor(id);
       [contract,graph,manifest,html]=await Promise.all([
        readFile(join(base,'reconstruction-contract.json'),'utf8').then(JSON.parse),
        readFile(join(base,'function-graph.json'),'utf8').then(JSON.parse),
        store.getManifest(id),readFile(join(base,'generic-prototype.html'),'utf8')
       ]);
      }catch(e){if(e.code==='ENOENT')return respond(res,404,{error:'reconstruction_contract_not_available'});throw e;}
      if(!matchesStoredReconstructionContract(contract,{verifiedGraph:graph,manifest,html}))
       return respond(res,409,{error:'reconstruction_contract_evidence_conflict'});
      return respond(res,200,contract,jsonContent,{
       'Content-Disposition':'attachment; filename="rea-synthetic-reconstruction-contract.json"'});
    }
    if(what==='feature-graph'){
      if(!['fixture-generic-catalog','fixture-generic-analytics','fixture-generic-planner'].includes(meta.mode))
       return respond(res,404,{error:'feature_graph_not_available'});
      const report=await store.getReport(id);
      if(report?.feature_graph_available!==true||
         report.feature_graph_source!=='observed-controlled-synthetic-only')
       return respond(res,404,{error:'feature_graph_not_available'});
      let graph;
      try{graph=JSON.parse(await readFile(join(store.pathFor(id),'function-graph.json'),'utf8'));}
      catch(e){if(e.code==='ENOENT')return respond(res,404,{error:'feature_graph_not_available'});throw e;}
      if(graph?.verification?.status!=='verified-replayed-synthetic-only')
       return respond(res,404,{error:'feature_graph_not_available'});
      return respond(res,200,graph,jsonContent,
       {'Content-Disposition':'attachment; filename="rea-observed-function-graph.json"'});
    }
    if(what==='generic-prototype'||what==='generic-prototype-download'){
      if(!['fixture-generic-catalog','fixture-generic-analytics','fixture-generic-planner'].includes(meta.mode))
       return respond(res,404,{error:'generic_prototype_not_available'});
      const report=await store.getReport(id);
      if(report?.generic_prototype_available!==true||
         report.generic_replay_verified_steps!==3||report.generic_replay_real_api_calls!==0)
       return respond(res,404,{error:'generic_prototype_not_available'});
      let html;
      try{html=await readFile(join(store.pathFor(id),'generic-prototype.html'),'utf8');}
      catch(e){if(e.code==='ENOENT')return respond(res,404,{error:'generic_prototype_not_available'});throw e;}
      return respond(res,200,html,'text/html; charset=utf-8',{
       'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; font-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'",
       ...(what==='generic-prototype-download'?
        {'Content-Disposition':'attachment; filename="rea-generic-verified-synthetic.html"'}:{})
      });
    }
    if(what==='behavior-prototype'||what==='behavior-prototype-download'){
      if(meta.mode!=='fixture-causal')return respond(res,404,{error:'behavior_prototype_not_available'});
      const report=await store.getReport(id);
      if(report?.behavior_reconstruction_available!==true)
       return respond(res,404,{error:'behavior_prototype_not_available'});
      let document;
      try{document=await readFile(join(store.pathFor(id),'behavior-prototype.html'),'utf8');}
      catch(e){if(e.code==='ENOENT')return respond(res,404,{error:'behavior_prototype_not_available'});throw e;}
      return respond(res,200,document,'text/html; charset=utf-8',{
       'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; font-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'",
       ...(what==='behavior-prototype-download'?
        {'Content-Disposition':'attachment; filename="rea-controlled-interactive-prototype.html"'}:{})
      });
    }
    if(what==='control-map'||what==='control-map-download'||what==='control-contract'){
      if(meta.mode!=='static-visual')return respond(res,404,{error:'control_map_unavailable'});
      const report=await store.getReport(id);
      if(report?.control_map_available!==true)return respond(res,404,{error:'control_map_unavailable'});
      let body;
      try{body=await readFile(join(store.pathFor(id),
       what==='control-contract'?'control-contract.json':'control-map.html'),'utf8');}
      catch(e){if(e.code==='ENOENT')return respond(res,404,{error:'control_map_unavailable'});throw e;}
      if(what==='control-contract')return respond(res,200,JSON.parse(body),jsonContent,
       {'Content-Disposition':'attachment; filename="rea-observed-controls.json"'});
      return respond(res,200,body,'text/html; charset=utf-8',{
       'Content-Security-Policy':"default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; font-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'",
       ...(what==='control-map-download'?{'Content-Disposition':'attachment; filename="rea-control-map.html"'}:{})
      });
    }
    if(what==='manifest'){
      const manifest=await store.getManifest(id);
      return manifest?respond(res,200,manifest,jsonContent,{
       'Content-Disposition':'attachment; filename="rea-evidence-manifest.json"'
      }):respond(res,404,{error:'manifest_not_available'});
    }
    if(what==='reconstruction-download'){
      if(meta.mode!=='static-visual')return respond(res,404,{error:'reconstruction_not_available'});
      let doc;
      try{doc=await readFile(join(store.pathFor(id),'reconstruction.html'),'utf8');}
      catch(e){if(e.code==='ENOENT')return respond(res,404,{error:'reconstruction_not_available'});throw e;}
      return respond(res,200,doc,'text/html; charset=utf-8',{
       'Content-Disposition':'attachment; filename="rea-independent-ui.html"',
       'Content-Security-Policy':"default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; form-action 'none'; base-uri 'none'"
      });
    }
    if(what==='comparison'){
      if(meta.mode!=='static-visual')return respond(res,404,{error:'comparison_not_available'});
      const data=await store.getComparison(id);
      return data?respond(res,200,data):respond(res,404,{error:'comparison_not_available'});
    }
    if(what==='reconstruction-screenshot'){
      if(meta.mode!=='static-visual')return respond(res,404,{error:'comparison_not_available'});
      const png=await store.getReconstructionScreenshot(id);
      return png?respond(res,200,png,'image/png'):respond(res,404,{error:'comparison_not_available'});
    }
    if(what==='reconstruction'){
      if(meta.mode!=='static-visual')return respond(res,404,{error:'reconstruction_not_available'});
      let document;
      try{document=await readFile(join(store.pathFor(id),'reconstruction.html'),'utf8');}
      catch(e){if(e.code==='ENOENT')return respond(res,404,{error:'reconstruction_not_available'});throw e;}
      return respond(res,200,document,'text/html; charset=utf-8',{
       'Content-Security-Policy':"default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'none'; connect-src 'none'; font-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'"
      });
    }
    return respond(res,200,meta);
   }
   const draftPost=/^\/api\/runs\/([a-f0-9-]+)\/independent-draft$/.exec(path);
   if(req.method==='POST'&&draftPost){
    if(req.headers.origin!==`http://${allowedHost}`)return respond(res,403,{error:'origin_not_allowed'});
    if(req.headers['content-type']!=='application/json')return respond(res,415,{error:'json_required'});
    if(Number(req.headers['content-length']||0)>MAX_INDEPENDENT_DRAFT_BODY)
     return respond(res,413,{error:'draft_too_large'});
    const id=draftPost[1];
    if(!ID_PATTERN.test(id))return respond(res,400,{error:'invalid_id'});
    const meta=await store.get(id);
    if(!meta)return respond(res,404,{error:'not_found'});
    if(meta.mode!=='static-visual'||meta.status!=='completed')
     return respond(res,409,{error:'completed_static_visual_required'});
    const report=await store.getReport(id),inspection=await store.getInspection(id);
    if(report?.reconstruction_available!==true||
       inspection?.mode!=='static-visual'||
       inspection?.page?.reconstruction_blueprint?.source!=='p4-geometry')
     return respond(res,409,{error:'static_geometry_evidence_missing'});
    if(active||colorRepairActive.size||geometryRepairActive.size)return respond(res,409,{error:'local_analysis_busy'});
    if(await readIndependentDraftReceipt(store,id))
     return respond(res,409,{error:'draft_already_stored'});
    const incoming=[];let size=0,tooLarge=false;
    for await(const chunk of req){
     size+=chunk.length;
     if(size>MAX_INDEPENDENT_DRAFT_BODY){tooLarge=true;break;}
     incoming.push(chunk);
    }
    if(tooLarge)return respond(res,413,{error:'draft_too_large'});
    let bundle;
    try{bundle=JSON.parse(Buffer.concat(incoming,size).toString('utf8'));}
    catch{return respond(res,400,{error:'invalid_json'});}
    try{
     const saved=await saveIndependentDraftBundle({
      store,id,bundle,originalGeometry:inspection.page.reconstruction_blueprint
     });
     return respond(res,201,saved);
    }catch(e){
     if(e.code==='EEXIST')return respond(res,409,{error:'draft_files_already_present'});
     if(typeof e.code==='string'&&e.code.startsWith('DRAFT_'))
      return respond(res,400,{error:e.code});
     throw e;
    }
   }
   const geometryPost=/^\/api\/runs\/([a-f0-9-]+)\/geometry-repair$/.exec(path);
   if(req.method==='POST'&&geometryPost){
    if(req.headers.origin!==`http://${allowedHost}`)return respond(res,403,{error:'origin_not_allowed'});
    if(req.headers['content-type']!=='application/json')return respond(res,415,{error:'json_required'});
    const chunks=[];let size=0;
    for await(const chunk of req){
     size+=chunk.length;
     if(size>256)return respond(res,413,{error:'request_too_large'});
     chunks.push(chunk);
    }
    let input;
    try{input=JSON.parse(Buffer.concat(chunks,size).toString('utf8'));}
    catch{return respond(res,400,{error:'invalid_json'});}
    if(!input||Array.isArray(input)||typeof input!=='object'||
       Object.keys(input).length!==1||input.confirm!=='offline-geometry-review')
     return respond(res,400,{error:'explicit_geometry_review_confirmation_required'});
    const id=geometryPost[1];
    if(!ID_PATTERN.test(id))return respond(res,400,{error:'invalid_id'});
    const meta=await store.get(id);
    if(!meta)return respond(res,404,{error:'not_found'});
    if(meta.mode!=='static-visual'||meta.status!=='completed')
     return respond(res,409,{error:'completed_static_visual_required'});
    const [receipt,report,inspection,comparison,png]=await Promise.all([
     readIndependentDraftReceipt(store,id),store.getReport(id),store.getInspection(id),
     store.getComparison(id),store.getScreenshot(id)
    ]);
    if(receipt?.status!=='STORED_UNVERIFIED'||report?.reconstruction_available!==true||
       report?.screenshot_saved!==true||inspection?.mode!=='static-visual'||
       inspection?.page?.reconstruction_blueprint?.source!=='p4-geometry'||
       comparison?.schema_version!==2||comparison?.ignored_notice_area!==false||
       !Buffer.isBuffer(png))
     return respond(res,409,{error:'saved_independent_geometry_evidence_missing'});
    try{await readFile(join(store.pathFor(id),'geometry-repair.json'),'utf8');
     return respond(res,409,{error:'geometry_review_already_finished'});
    }catch(e){if(e.code!=='ENOENT')throw e;}
    if(active||colorRepairActive.size||geometryRepairActive.size)
     return respond(res,409,{error:'local_chrome_already_busy'});
    geometryRepairActive.add(id);geometryRepairFailures.delete(id);
    void(async()=>{
     try{await geometryRepairExecutor({store,id,browserPath,replayExecutor});}
     catch{geometryRepairFailures.set(id,true);}
     finally{geometryRepairActive.delete(id);}
    })();
    return respond(res,202,{status:'running',kind:'offline-saved-geometry-review',
     original_site_refetched:false,additional_origins_approved:0});
   }
   const colorPost=/^\/api\/runs\/([a-f0-9-]+)\/color-repair$/.exec(path);
   if(req.method==='POST'&&colorPost){
    if(req.headers.origin!==`http://${allowedHost}`)return respond(res,403,{error:'origin_not_allowed'});
    if(!String(req.headers['content-type']||'').startsWith('application/json'))
     return respond(res,415,{error:'json_required'});
    let raw='';
    for await(const part of req){
     raw+=part.toString('utf8');
     if(Buffer.byteLength(raw)>256)return respond(res,413,{error:'request_too_large'});
    }
    let input;
    try{input=JSON.parse(raw);}catch{return respond(res,400,{error:'invalid_json'});}
    if(!input||Array.isArray(input)||typeof input!=='object'||
       Object.keys(input).length!==1||input.confirm!=='offline-color-review')
     return respond(res,400,{error:'explicit_offline_confirmation_required'});
    const id=colorPost[1];
    if(!ID_PATTERN.test(id))return respond(res,400,{error:'invalid_id'});
    const meta=await store.get(id);
    if(!meta)return respond(res,404,{error:'not_found'});
    if(meta.mode!=='static-visual'||meta.status!=='completed')
     return respond(res,409,{error:'static_visual_completed_only'});
    const [report,inspection,comparison,png]=await Promise.all([
     store.getReport(id),store.getInspection(id),store.getComparison(id),store.getScreenshot(id)]);
    if(report?.reconstruction_available!==true||report?.screenshot_saved!==true||
       inspection?.mode!=='static-visual'||inspection?.page?.reconstruction_blueprint?.source!=='p4-geometry'||
       comparison?.schema_version!==2||!Buffer.isBuffer(png))
     return respond(res,409,{error:'static_visual_evidence_missing'});
    try{await readFile(join(store.pathFor(id),'color-repair.json'),'utf8');
     return respond(res,409,{error:'color_review_already_finished'});
    }catch(e){if(e.code!=='ENOENT')throw e;}
    if(active||colorRepairActive.size||geometryRepairActive.size)return respond(res,409,{error:'local_chrome_already_busy'});
    colorRepairActive.add(id);
    colorRepairFailures.delete(id);
    void (async()=>{
     try{await colorRepairExecutor({store,id,browserPath,replayExecutor});}
     catch{colorRepairFailures.set(id,true);}
     finally{colorRepairActive.delete(id);}
    })();
    return respond(res,202,{status:'running',kind:'offline-static-color-review',
     original_site_refetched:false,additional_origins_approved:0});
   }
   if(req.method==='POST'&&path==='/api/runs'){
    if(req.headers.origin!==`http://${allowedHost}`)return respond(res,403,{error:'origin_not_allowed'});
    if(!String(req.headers['content-type']||'').startsWith('application/json'))return respond(res,415,{error:'json_required'});
    let raw='';
    for await (const part of req){raw+=part.toString('utf8');if(Buffer.byteLength(raw)>MAX_BODY)return respond(res,413,{error:'request_too_large'});}
    let input;try{input=JSON.parse(raw);}catch{return respond(res,400,{error:'invalid_json'});}
    try{classifyTarget(input);}catch(e){return respond(res,400,{error:safeDetail(e.message)});}
    const result=await begin(input);
    return result.conflict?respond(res,409,{error:'analysis_already_running'}):respond(res,202,result.meta);
   }
   return respond(res,404,{error:'not_found'});
  }catch(e){return respond(res,500,{error:'internal_error'});}
 });
 return {server,store,init:()=>store.init(),get active(){return active;}};
}
