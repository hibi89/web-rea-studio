// F1/F2 capability gate for three fixed, in-memory synthetic browser fixtures.
// No policy can grant action rights to user supplied URLs or other origins.
const ORIGIN='https://webrea-generic-fixture.example.org';
const MATRIX=Object.freeze({
 catalog:Object.freeze({'src-filter':'filter','src-layout':'layout','source-reset':'reset'}),
 analytics:Object.freeze({'src-range':'range','src-chart':'chart','source-reset':'reset'}),
 planner:Object.freeze({'src-day':'day','src-view':'view','source-reset':'reset'})
});
const deny=(id,reason)=>({id,decision:'denied',reason});
export function fixtureActionPolicy({appId,origin=ORIGIN}={}){
 if(!Object.hasOwn(MATRIX,appId)||origin!==ORIGIN)
  throw Error('F2_POLICY_SCOPE_DENIED');
 return Object.freeze({source:'fixed-fixture-capabilities',scope:'in-memory-synthetic-only',
  app_id:appId,origin:ORIGIN,
  allowed:Object.freeze({...MATRIX[appId]}),
  denied_types:['submit','file','password','checkbox','radio','reset'],
  external_navigation:false,form_submission:false,unknown_actions:false});
}
export function decideFixtureAction(candidate,policy){
 if(!policy||policy.source!=='fixed-fixture-capabilities'||
    policy.scope!=='in-memory-synthetic-only'||policy.origin!==ORIGIN||
    !Object.hasOwn(MATRIX,policy.app_id))throw Error('F2_POLICY_UNTRUSTED');
 const expected=MATRIX[policy.app_id], id=candidate?.id;
 if(typeof id!=='string'||!/^[a-z][a-z0-9-]{1,31}$/.test(id))
  return deny(null,'invalid-id');
 if(candidate.tag!=='button'||candidate.type!=='button')
  return deny(id,'not-an-explicit-button');
 if(candidate.visible!==true||candidate.disabled!==false)
  return deny(id,'hidden-or-disabled');
 if(!Object.hasOwn(expected,id)||policy.allowed?.[id]!==expected[id])
  return deny(id,'not-allowlisted');
 return {id,decision:'approved',action:expected[id]};
}
export function auditFixtureInventory(raw,policy){
 if(raw?.source!=='controlled-dom-inventory'||raw.origin!==ORIGIN||
    !Array.isArray(raw.items)||raw.items.length>40)throw Error('F2_POLICY_INVENTORY_INVALID');
 const actions=[],decisions=[],seen=new Set();
 for(const candidate of raw.items){
  const result=decideFixtureAction(candidate,policy);
  if(result.id&&seen.has(result.id)){
   decisions.push(deny(result.id,'duplicate-element'));continue;
  }
  if(result.id)seen.add(result.id);
  decisions.push(result);
  if(result.decision==='approved')actions.push(result);
 }
 if(actions.length!==3||actions.filter(a=>a.action==='reset').length!==1)
  throw Error('F2_POLICY_REQUIRED_ACTIONS_MISSING');
 return {source:'controlled-action-audit',scope:'in-memory-synthetic-only',
  app_id:policy.app_id,actions,decisions,
  authorized_controls:actions.length,
  denied_controls:decisions.filter(d=>d.decision==='denied').length,
  unauthorized_actions_executed:0,
  external_navigation_performed:false,
  form_submissions_performed:0};
}
export const SYNTHETIC_CONTROL_PROBE=String.raw`(()=>{
 const nodes=[...document.querySelectorAll('button,a[href],input,select,textarea,[role="button"]')].slice(0,40);
 return {source:'controlled-dom-inventory',origin:location.origin,
  items:nodes.map(node=>{
   const s=getComputedStyle(node),r=node.getBoundingClientRect();
   return {tag:node.tagName.toLowerCase(),id:node.id.slice(0,40),
    type:(node.getAttribute('type')||'button').slice(0,30),
    visible:s.display!=='none'&&s.visibility!=='hidden'&&r.width>1&&r.height>1,
    disabled:!!node.disabled};
  })
 };
})()`;
export function getFixtureActionSelector(action,audit){
 const found=audit?.actions?.find(a=>a.action===action);
 if(!found||typeof found.id!=='string'||!/^[a-z][a-z0-9-]{1,31}$/.test(found.id))
  throw Error('F2_ACTION_NOT_PERMITTED');
 return found.id;
}
