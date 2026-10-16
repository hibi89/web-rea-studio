// F2 controlled-fixture state transitions: only bounded structural signals.
// Never persist raw DOM, input values, selected options, query strings, or
// hashed user text. All output is a whitelist of semantic state changes.
import {createHash} from 'node:crypto';
const limitedHtml=raw=>typeof raw==='string'?raw.slice(0,250000):'';
const tag=(html,name,id)=>{
 const pattern=new RegExp('<'+name+'\\b([^>]{0,800})>','gi');
 for(const m of html.matchAll(pattern)){
  if(new RegExp('(?:^|\\s)id\\s*=\\s*["\\x27]'+id+'["\\x27](?:\\s|$)','i').test(m[1]))return m[1];
 }
 return null;
};
const hidden=attrs=>typeof attrs==='string'?/(?:^|\s)hidden(?:\s|=|$)/i.test(attrs):null;
export function fingerprintFixtureDom(raw){
 const html=limitedHtml(raw);
 if(!html)return null;
 const dashboard=hidden(tag(html,'section','dashboard')),help=hidden(tag(html,'section','help'));
 const panel=dashboard===false&&help===true?'dashboard':
  dashboard===true&&help===false?'help':null;
 const notesAttrs=tag(html,'button','toggle-notes');
 const expanded=typeof notesAttrs==='string'?
  /aria-expanded\s*=\s*["']true["']/i.test(notesAttrs)?true:
  /aria-expanded\s*=\s*["']false["']/i.test(notesAttrs)?false:null:null;
 const results=tag(html,'div','results');
 const state=/data-state\s*=\s*["'](loading|ready|error)["']/i.exec(results||'')?.[1]||null;
 const tbody=/<tbody\b[^>]*>([\s\S]{0,100000}?)<\/tbody\s*>/i.exec(html)?.[1];
 const count=typeof tbody==='string'?Math.min(1000,(tbody.match(/<tr(?:\s|>)/gi)||[]).length):null;
 const ordering=typeof tbody==='string'?
  createHash('sha256').update(tbody.slice(0,80000)).digest('hex'):null;
 return {panel,notes_expanded:expanded,result_state:state,table_rows:count,_row_order:ordering};
}
export function summarizeFixtureTransitions(steps){
 const limited=Array.isArray(steps)?steps.slice(0,40):[];
 let previous=null;
 const transitions=[];
 const fields=['panel','notes_expanded','result_state','table_rows'];
 for(const step of limited){
  const data=step?.artifacts?.dom;
  const state=data?.state==='captured'?fingerprintFixtureDom(data.value?.text):null;
  const changed=[];
  if(previous&&state){
   for(const field of fields){
    if(previous[field]!==null&&state[field]!==null&&previous[field]!==state[field]){
     changed.push({field,from:previous[field],to:state[field]});
    }
   }
   if(previous._row_order&&state._row_order&&previous.table_rows===state.table_rows&&
      previous.table_rows>1&&previous._row_order!==state._row_order)
    changed.push({field:'table_row_order',from:'previous',to:'changed'});
  }
  transitions.push({
   step_id:typeof step?.step_id==='string'?step.step_id.slice(0,64):'',
   action:['click','wait_for','goto_start','type','select'].includes(step?.action)?step.action:'other',
   status:['completed','failed','cancelled'].includes(step?.status)?step.status:'unknown',
   dom_observed:state!==null,changed
  });
  if(state)previous=state;
 }
 return {source:'controlled-fixture-state-diff',verification:'after-action-DOM-observation',
  steps:transitions,changed_steps:transitions.filter(x=>x.changed.length).length,
  observed_state_changes:transitions.reduce((v,x)=>v+x.changed.length,0),
  cautions:['Only synthetic controlled local fixture',
   'Temporal DOM changes after an action do not prove exclusive API causality',
   'Raw page text, input values and DOM hashes are not persisted']};
}
