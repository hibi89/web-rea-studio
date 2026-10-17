// F1/F2 observed state graph and deterministic route planning.
// Never infers transitions: accepts only normalized controlled Chrome evidence.
import {normalizeGenericBehaviorEvidence} from './generic-behavior.mjs';

const key=state=>JSON.stringify(state);
function shortestPath(initial,target,edges) {
 const start=key(initial),goal=key(target);
 if(start===goal)return [];
 const queue=[{state:start,path:[]}],seen=new Set([start]);
 for(let i=0;i<queue.length;i++){
  const q=queue[i];
  for(let j=0;j<edges.length;j++){
   const edge=edges[j];
   if(key(edge.before)!==q.state)continue;
   const state=key(edge.after);
   if(seen.has(state))continue;
   const path=[...q.path,j];
   if(state===goal)return path;
   seen.add(state);queue.push({state,path});
  }
 }
 throw Error('F2_GRAPH_UNREACHABLE');
}
const invalid=()=>{throw Error('F2_UNVERIFIED_GRAPH');};
export function buildObservedFeatureGraph(evidence){
 const graph=normalizeGenericBehaviorEvidence(evidence);
 if(graph.scope!=='verified-synthetic-only'||graph.network_mode!=='local-counter-no-http')
  invalid();
 const states=[{id:'s0',values:graph.initial}],indices=new Map([[key(graph.initial),'s0']]);
 function ensure(state){
  const k=key(state);
  if(!indices.has(k)){
   if(states.length>=20)invalid();
   const id='s'+states.length;
   indices.set(k,id);states.push({id,values:state});
  }
  return indices.get(k);
 }
 const edges=graph.edges.map((edge,i)=>{
  const raw=evidence.steps[i];
  if(raw.id!==edge.id||!Array.isArray(raw.endpoint_paths)||
    raw.endpoint_paths.length!==(edge.simulated_api_delta?1:0)||
    raw.endpoint_paths.some(p=>typeof p!=='string'||!/^\/api\/[a-z][a-z0-9/_-]{0,40}$/.test(p)))
    invalid();
  return {id:'e'+i,action:edge.id,label:edge.label,
   from:ensure(edge.before),to:ensure(edge.after),
   changed_fields:[...edge.changed_fields],
   observed_api_requests:edge.simulated_api_delta,
   endpoint_paths:[...raw.endpoint_paths],
   verification:'controlled-single-action-window'};
 });
 const pathTo=edgeIndex=>{
  const target=graph.edges[edgeIndex].before;
  return shortestPath(graph.initial,target,graph.edges);
 };
 const testCases=edges.map((e,i)=>{
  const prefix=pathTo(i);
  const idx=[...prefix,i];
  return {edge_id:e.id,reset_first:true,
   path_edge_ids:idx.map(n=>'e'+n),
   actions:idx.map(n=>graph.edges[n].id),
   expected_destination:e.to,
   verification:'observed-path-only'};
 });
 // Edge-covering walk, minimizing redundant resets without claiming optimality.
 const remaining=new Set(edges.map((_,i)=>i));
 const coverage=[];
 let walk=[],cursor=graph.initial;
 let guard=0;
 while(remaining.size){
  if(++guard>70)invalid();
  const next=graph.edges.findIndex((edge,i)=>
   remaining.has(i)&&key(edge.before)===key(cursor));
  if(next>=0){
   walk.push(next);remaining.delete(next);cursor=graph.edges[next].after;
   continue;
  }
  if(walk.length){
   coverage.push(walk);walk=[];cursor=graph.initial;
  }
  const first=[...remaining].sort((i,j)=>{
   const len=pathTo(i).length-pathTo(j).length;
   return len||i-j;
  })[0];
  const path=pathTo(first);
  if(!path.length&&key(graph.edges[first].before)!==key(cursor))invalid();
  walk.push(...path);
  cursor=path.length?graph.edges[path.at(-1)].after:graph.initial;
 }
 if(walk.length)coverage.push(walk);
 if(coverage.length>20)invalid();
 const coverageRoutes=coverage.map((indices,i)=>({
  id:'route'+i,reset_first:true,
  path_edge_ids:indices.map(x=>'e'+x),
  actions:indices.map(x=>graph.edges[x].id),
  expected_destination:edges[indices.at(-1)].to,
  verified_in_source:false
 }));
 const relationMap=new Map();
 for(const edge of edges){
  if(!relationMap.has(edge.action))relationMap.set(edge.action,{action:edge.action,
   label:edge.label,changed_fields:new Set(),api_paths:new Set(),
   observed_transitions:0,transitions_with_api:0});
  const row=relationMap.get(edge.action);
  row.observed_transitions++;
  if(edge.observed_api_requests)row.transitions_with_api++;
  edge.changed_fields.forEach(k=>row.changed_fields.add(k));
  edge.endpoint_paths.forEach(p=>row.api_paths.add(p));
 }
 const relations=[...relationMap.values()].map(x=>({
  action:x.action,label:x.label,changed_fields:[...x.changed_fields].sort(),
  api_paths:[...x.api_paths].sort(),observed_transitions:x.observed_transitions,
  transitions_with_api:x.transitions_with_api,
  relationship_verification:'controlled-synthetic-only'
 }));
 if(edges.length!==graph.edges.length||coverageRoutes.reduce((n,r)=>n+r.actions.length,0)<edges.length)
  invalid();
 return {schema_version:1,kind:'observed-function-graph',
  scope:'controlled-synthetic-only',app_id:graph.app_id,
  source:'verified-chrome-transitions',states,edges,
  initial_state_id:'s0',
  test_cases:testCases,coverage_routes:coverageRoutes,relationships:relations,
  metrics:{unique_states:states.length,observed_transitions:edges.length,
   action_kinds:relations.length,api_linked_transitions:edges.filter(x=>x.observed_api_requests>0).length,
   route_count:coverageRoutes.length,
   planned_clicks:coverageRoutes.reduce((n,r)=>n+r.actions.length,0),
   coverage_of_observed_edges_pct:100},
  limitations:['Paths are computed from a bounded set of previously observed synthetic actions',
   'No claim that unobserved buttons, states, or API endpoints were discovered',
   'Coverage measures observed edges, not whole-site functional completeness',
   'Generated route actions must be independently replayed in controlled Chrome before certification']};
}
export function markObservedFeatureGraphVerified(result,replay){
 if(result?.kind!=='observed-function-graph'||result.scope!=='controlled-synthetic-only'||
  replay?.source!=='controlled-generic-replay'||replay.scope!=='synthetic-only'||
  replay.actual_api_calls!==0||replay.verified_steps!==result.metrics.planned_clicks||
  replay.observed_edge_coverage!==result.edges.length||
  !Array.isArray(replay.verified_route_ids)||
  replay.verified_route_ids.join(',')!==result.coverage_routes.map(r=>r.id).join(','))
  invalid();
 return {...result,
  coverage_routes:result.coverage_routes.map(r=>({...r,verified_in_source:true})),
  verification:{status:'verified-replayed-synthetic-only',
   observed_edges_verified:replay.observed_edge_coverage,
   routes_verified:replay.verified_route_ids.length,
   real_api_calls:0}};
}
