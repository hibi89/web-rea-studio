// F3 evidence-to-spec: deterministic, bounded, offline; no model assertions.
const safeLabel=s=>typeof s==='string'?s.replace(/[\x00-\x1f\x7f<>]/g,' ')
 .replace(/https?:\/\/\S+/gi,'[URL]')
 .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[EMAIL]')
 .replace(/\b[A-Za-z0-9_-]{19,}\b/g,'[REDACTED]')
 .replace(/\b\d{9,}\b/g,'[NUMBER]')
 .replace(/\s+/g,' ').trim().slice(0,64):'';
const n=(x,max)=>Number.isSafeInteger(x)&&x>=0?Math.min(x,max):0;
const trustedMode=new Set(['static-html','static-visual','dynamic-passive','rea-browser','fixture-causal']);
const safeHost=s=>typeof s==='string'&&s.length<254&&/^[a-z0-9.-]+$/.test(s)?s:null;
const safeStateValue=v=>typeof v==='boolean'?v:
 Number.isSafeInteger(v)&&v>=0&&v<=1000?v:
 ['dashboard','help','loading','ready','error','previous','changed','asc','desc','table'].includes(v)?v:null;
export function buildEvidenceManifest(inspection,report){
 if(!inspection||typeof inspection!=='object')throw Error('F3_INSPECTION_REQUIRED');
 const mode=trustedMode.has(inspection.mode)?inspection.mode:
  inspection.scope==='controlled-fixture-only'?'rea-browser':'unknown';
 if(mode==='unknown')throw Error('F3_UNSUPPORTED_EVIDENCE');
 const discovery=inspection.page?.interaction_inventory||
   inspection.exploration?.inventory;
 const controls=discovery?.source==='passive-controls'
  ?(Array.isArray(discovery.controls)?discovery.controls:[]).slice(0,100).map(c=>({
    category:['button','link','tab','select','textarea','input'].includes(c.kind)?c.kind:'interactive',
    type:c.kind==='input'&&typeof c.type==='string'&&/^[a-z-]{1,20}$/.test(c.type)?c.type:null,
    label:c.kind==='button'||c.kind==='tab'||c.kind==='link'?safeLabel(c.label):null,
    geometry:typeof c.rect?.x==='number'?{
      x:n(Math.max(0,c.rect.x),10000),y:n(Math.max(0,c.rect.y),10000),
      width:n(c.rect.width,10000),height:n(c.rect.height,10000)}:null,
    navigation:['same-origin','same-page','offsite','non-http','invalid'].includes(c.navigation)?c.navigation:null,
    effect:'not-verified'
   }))
  :mode==='static-html'?(Array.isArray(inspection.page?.controls)?inspection.page.controls:[])
   .slice(0,45).map(c=>({category:['button','input','select','textarea'].includes(c.kind)?c.kind:'unknown',
     type:typeof c.type==='string'&&/^[a-z-]{1,20}$/.test(c.type)?c.type:null,
     label:null,geometry:null,navigation:null,effect:'not-verified'})):[];

 const blueprint=inspection.page?.reconstruction_blueprint;
 const geometry=blueprint?.source==='p4-geometry'?
  {viewport:{width:n(blueprint.viewport?.width,4000),height:n(blueprint.viewport?.height,4000)},
   regions:n(blueprint.boxes?.length,180),titles:n(blueprint.titles?.length,32),
   source:'measured-static-dom',functional_parity:'not-tested'}:null;
 const dependencyMap=inspection.exploration?.dependencies;
 const dependencies=dependencyMap?.source==='read-only-network-evidence'?
  (Array.isArray(dependencyMap.dependencies)?dependencyMap.dependencies:[])
   .slice(0,12).map(d=>({
    scope:d.scope==='external'?'external':'same-origin',
    host:d.scope==='external'?safeHost(d.host):null,
    observed_events:n(d.events,120),fetch_attempts:n(d.fetch_attempts,120),
    fetch_rejections:n(d.fetch_rejections,120),
    attribution:'unknown'})):[];
 const fixture=inspection.exploration?.source==='controlled-fixture-scenario'?
  {executed_steps:n(inspection.exploration.actions_observed,40),
   successful_steps:n(inspection.exploration.successful_steps,40),
   verified_action_api_links:mode==='fixture-causal'?
    n(inspection.exploration.verified_action_api_links,10):0,
   observed_state_changes:n(inspection.exploration.state_transitions?.observed_state_changes,100),
   state_transitions:(Array.isArray(inspection.exploration.state_transitions?.steps)?
    inspection.exploration.state_transitions.steps:[]).slice(0,40).map(t=>({
    step_id:typeof t.step_id==='string'?t.step_id.slice(0,64):'',
    changes:(Array.isArray(t.changed)?t.changed:[]).slice(0,5)
     .filter(c=>['panel','notes_expanded','result_state','table_rows','table_row_order','period','order','view','rows'].includes(c.field))
     .map(c=>({field:c.field,from:safeStateValue(c.from),to:safeStateValue(c.to)}))
   })),
   endpoints:(Array.isArray(inspection.exploration.observed_endpoint_paths)?
    inspection.exploration.observed_endpoint_paths:[]).slice(0,20)
     .filter(s=>typeof s==='string'&&/^\/[a-z0-9/_-]{0,119}$/i.test(s))}:null;
 const errors=Array.isArray(report?.failures)?report.failures
  .filter(s=>typeof s==='string'&&/^[a-z0-9_-]{1,80}$/i.test(s)).slice(0,10):[];
 const findings=[
  {id:'html-structure',status:'observed',description:'Page or fixture structural evidence recorded'},
  {id:'visible-controls',status:controls.length?'observed':'unknown',
    description:controls.length?'Control affordances discovered; effects unverified':'No supported control evidence'},
  {id:'network-requests',status:dependencies.length?'observed':'unknown',
    description:dependencies.length?'Passive request events grouped; attribution unknown':'No external/passive request relation confirmed'},
  {id:'script-execution',status:mode==='static-visual'?'disabled':mode==='static-html'?'not-run':'observed',
    description:'Mode-specific script execution; does not imply tested interaction'},
  {id:'generated-ui',status:report?.reconstruction_available===true?'generated':'not-generated',
    description:'Static geometry reconstruction only; not working original application'}
 ];
 return {schema_version:1,product:'web-rea-studio',kind:'evidence-manifest',
  analysis_mode:mode,evidence_scope:inspection.scope==='controlled-fixture-only'?'controlled-local-fixture':'approved-read-only',
  observation_not_equivalence:true,
  controls:{total:controls.length,items:controls},
  visual:geometry,
  network:{dependencies,causal_links_verified:mode==='fixture-causal'?
   n(inspection.exploration?.verified_action_api_links,10):0,
   attribution_scope:mode==='fixture-causal'?'controlled-synthetic-only':'unverified'},
  controlled_scenario:fixture,
  generated_artifacts:{standalone_html:report?.reconstruction_available===true,
   screenshot:report?.screenshot_saved===true,
   pixel_comparison:report?.visual_comparison_available===true},
  findings,errors,
  limitations:['No recovered private source, credentials or server logic',
    'Button/API causality is verified only for fixed synthetic fixture, never external sites',
    'Only measured static geometry can be regenerated',
    'No live data or interaction correctness implied']};
}
