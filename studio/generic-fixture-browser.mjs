// Strictly local synthetic Chrome observations and generated replay.
// No user URL, external website, credentials, or remote HTTP permitted.
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CdpClient} from './dynamic-browser.mjs';
import {generateGenericBehaviorHtml,normalizeGenericBehaviorEvidence} from './generic-behavior.mjs';
import {fixtureActionPolicy,auditFixtureInventory,getFixtureActionSelector,SYNTHETIC_CONTROL_PROBE} from './fixture-permissions.mjs';
import {buildObservedFeatureGraph} from './behavior-exploration.mjs';

const ORIGIN='https://webrea-generic-fixture.example.org',TARGET=ORIGIN+'/';
const profiles={
 catalog:{
  title:'상품 목록 실험',initial:{category:'all',count:8,layout:'grid'},
  actions:{filter:'카테고리 변경',layout:'목록 표시'},flows:[['filter','layout'],['layout']],
  source:`<!doctype html><html><body>
  <button id="src-filter">Summer filter</button><button id="src-layout">View layout</button>
  <button id="source-reset">Reset</button>
  <button id="src-delete" type="button" onclick="document.body.dataset.unsafeAction='1';fetch('/api/delete',{method:'POST'})">Delete</button>
  <button id="src-submit" type="submit">Submit</button>
  <a href="https://offsite-denied.example.org/?token=PRIVATE">Offsite</a>
  <input type="password" value="DONT_COLLECT_SECRET_VALUE">
  <span id="state-category">all</span><span id="state-count">8</span><span id="state-layout">grid</span>
  <script>
  let category='all',count=8,layout='grid';
  function paint(){for(const [k,v] of Object.entries({category,count,layout}))
   document.getElementById('state-'+k).textContent=String(v);}
  document.getElementById('src-filter').onclick=async()=>{
   category='summer';
   const result=await (await fetch('/api/items?category=summer')).json();
   count=result.count;paint();};
  document.getElementById('src-layout').onclick=()=>{layout='list';paint();};
  document.getElementById('source-reset').onclick=()=>{category='all';count=8;layout='grid';paint();};
  paint();
  </script></body></html>`,
  after:{filter:{category:'summer',count:3,layout:'grid'},layout:null},
  request:{filter:'/api/items',layout:null}
 },
 analytics:{
  title:'분석 대시보드 실험',initial:{chart:'bar',range:'week',total:12},
  actions:{range:'기간 확대',chart:'차트 전환'},flows:[['range','chart'],['chart']],
  source:`<!doctype html><html><body>
  <button id="src-range">Range</button><button id="src-chart">Chart</button>
  <button id="source-reset">Reset</button>
  <button id="src-delete" type="button" onclick="document.body.dataset.unsafeAction='1';fetch('/api/delete',{method:'POST'})">Delete</button>
  <button id="src-submit" type="submit">Submit</button>
  <a href="https://offsite-denied.example.org/?token=PRIVATE">Offsite</a>
  <input type="password" value="DONT_COLLECT_SECRET_VALUE">
  <span id="state-chart">bar</span><span id="state-range">week</span><span id="state-total">12</span>
  <script>
  let chart='bar',range='week',total=12;
  function paint(){for(const [k,v] of Object.entries({chart,range,total}))
   document.getElementById('state-'+k).textContent=String(v);}
  document.getElementById('src-range').onclick=async()=>{
   range='month';
   const result=await (await fetch('/api/metrics?range=month')).json();
   total=result.total;paint();};
  document.getElementById('src-chart').onclick=()=>{chart='line';paint();};
  document.getElementById('source-reset').onclick=()=>{chart='bar';range='week';total=12;paint();};
  paint();
  </script></body></html>`,
  request:{range:'/api/metrics',chart:null}
 },
 planner:{
  title:'일정 관리 실험',initial:{day:'monday',layout:'list',slots:4},
  actions:{day:'다음 날짜',view:'그리드 표시'},flows:[['day','view'],['view']],
  source:`<!doctype html><html><body>
  <button id="src-day" type="button">Next day</button>
  <button id="src-view" type="button">Switch view</button>
  <button id="source-reset" type="button">Reset</button>
  <button id="src-delete" type="button" onclick="document.body.dataset.unsafeAction='1';fetch('/api/delete',{method:'POST'})">Delete</button>
  <button id="src-submit" type="submit">Submit</button>
  <a href="https://offsite-denied.example.org/?token=PRIVATE">Offsite</a>
  <input type="password" value="DONT_COLLECT_SECRET_VALUE">
  <span id="state-day">monday</span><span id="state-layout">list</span><span id="state-slots">4</span>
  <script>
  let day='monday',layout='list',slots=4;
  function paint(){for(const [k,v] of Object.entries({day,layout,slots}))
   document.getElementById('state-'+k).textContent=String(v);}
  document.getElementById('src-day').onclick=async()=>{
   day='tuesday';
   const result=await (await fetch('/api/calendar?day=tuesday')).json();
   slots=result.slots;paint();};
  document.getElementById('src-view').onclick=()=>{layout='grid';paint();};
  document.getElementById('source-reset').onclick=()=>{day='monday';layout='list';slots=4;paint();};
  paint();
  </script></body></html>`,
  request:{day:'/api/calendar',view:null}
 }
};
const DELAY=ms=>new Promise(ok=>setTimeout(ok,ms));
const allowedRequest=(u,method,replay)=>{
 if(method!=='GET')return null;
 let url;try{url=new URL(u);}catch{return null;}
 if(url.origin!==ORIGIN||url.username||url.password||url.hash)return null;
 if(url.href===TARGET)return 'document';
 if(replay)return null;
 if(url.pathname==='/api/items'&&url.search==='?category=summer')return 'items';
 if(url.pathname==='/api/metrics'&&url.search==='?range=month')return 'metrics';
 if(url.pathname==='/api/calendar'&&url.search==='?day=tuesday')return 'calendar';
 return null;
};
export function classifyGenericFixtureRequest(url,method,{replay=false}={}){
 return allowedRequest(url,method,replay);
}
async function connect(profile,child){
 for(let i=0;i<90;i++){
  if(child.exitCode!==null)throw Error('F4G_CHROME_EXITED');
  try{
   const [port,path]=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split(/\r?\n/);
   if(Number(port)>0&&/^\/devtools\/browser\/[\w-]+$/.test(path)){
    const ws=new WebSocket('ws://127.0.0.1:'+port+path);
    await new Promise((resolve,reject)=>{
     const t=setTimeout(()=>reject(Error('F4G_WS_TIMEOUT')),8000);
     ws.addEventListener('open',()=>{clearTimeout(t);resolve();},{once:true});
     ws.addEventListener('error',()=>{clearTimeout(t);reject(Error('F4G_WS_ERROR'));},{once:true});
    });
    return new CdpClient(ws);
   }
  }catch(e){if(['F4G_WS_TIMEOUT','F4G_WS_ERROR'].includes(e.message))throw e;}
  await DELAY(110);
 }
 throw Error('F4G_START_TIMEOUT');
}
function same(a,b){return Object.keys(a).every(k=>a[k]===b[k]);}
async function runChrome({browserPath,appId,replayHtml=null,evidence=null,launch=spawn}={}){
 const profile=profiles[appId],replay=typeof replayHtml==='string';
 if(!profile||typeof browserPath!=='string'||!browserPath||replay&&!evidence)
  throw Error('F4G_SCOPE_REJECTED');
 if(replay&&(replayHtml.length>50000||
    !replayHtml.includes('<title>Web REA · Controlled Generic Replay</title>')||
    !replayHtml.includes('connect-src &#39;none&#39;')))
  throw Error('F4G_INVALID_REPLAY');
 const dir=await mkdtemp(join(tmpdir(),'webrea-generic-chrome-'));
 let child,cdp,sid,denied=0,networkFailures=0;
 const requests=[];
 try{
  child=launch(browserPath,['--headless=new','--disable-gpu','--no-first-run',
   '--no-default-browser-check','--disable-background-networking','--disable-extensions',
   '--disable-component-update','--disable-sync','--disable-quic','--no-proxy-server',
   '--host-resolver-rules=MAP * ~NOTFOUND','--remote-debugging-port=0',
   '--remote-debugging-address=127.0.0.1','--user-data-dir='+dir,'about:blank'],
   {stdio:'ignore',windowsHide:true});
  cdp=await connect(dir,child);
  const target=await cdp.send('Target.createTarget',{url:'about:blank'});
  sid=(await cdp.send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;
  await cdp.send('Page.enable',{},sid);
  await cdp.send('Runtime.enable',{},sid);
  await cdp.send('Network.enable',{},sid);
  await cdp.send('Network.setBypassServiceWorker',{bypass:true},sid);
  cdp.on('Fetch.requestPaused',async(event,session)=>{
   if(session!==sid)return;
   const decision=allowedRequest(event.request?.url,event.request?.method,replay);
   try{
    if(!decision){denied++;await cdp.send('Fetch.failRequest',{
     requestId:event.requestId,errorReason:'BlockedByClient'},sid);return;}
    let output=decision==='document'?(replay?replayHtml:profile.source):null;
    if(decision==='items')output=JSON.stringify({count:3});
    if(decision==='metrics')output=JSON.stringify({total:31});
    if(decision==='calendar')output=JSON.stringify({slots:2});
    if(decision!=='document')requests.push({path:decision==='items'?'/api/items':
     decision==='metrics'?'/api/metrics':'/api/calendar'});
    const headers=[{name:'Content-Type',value:decision==='document'?'text/html; charset=utf-8':'application/json'},
     {name:'Cache-Control',value:'no-store'}];
    if(decision==='document')headers.push({name:'Content-Security-Policy',
     value:replay?"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; form-action 'none'; img-src 'none'; font-src 'none'":
      "default-src 'none'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'none'; img-src 'none'; font-src 'none'"});
    await cdp.send('Fetch.fulfillRequest',{
     requestId:event.requestId,responseCode:200,responseHeaders:headers,
     body:Buffer.from(output).toString('base64')},sid);
   }catch{networkFailures++;}
  });
  await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]},sid);
  const navigation=await cdp.send('Page.navigate',{url:TARGET},sid);
  if(navigation.errorText)throw Error('F4G_NAVIGATION_FAILED');
  const fields=Object.keys(profile.initial).sort();
  const read=async()=>{
   const expression='(()=>{const keys='+JSON.stringify(fields)+
    ';return Object.fromEntries(keys.map(k=>[k,document.getElementById("state-"+k)?.textContent]))})()';
   const r=(await cdp.send('Runtime.evaluate',{expression,returnByValue:true},sid)).result?.value;
   if(!r||fields.some(k=>typeof r[k]!=='string'))return null;
   const clean={};
   for(const k of fields){
    clean[k]=typeof profile.initial[k]==='number'?Number(r[k]):r[k];
    if(typeof profile.initial[k]==='number'&&!Number.isSafeInteger(clean[k]))return null;
   }
   return clean;
  };
  const counter=async()=>{
   const r=(await cdp.send('Runtime.evaluate',{expression:
    "Number(document.getElementById('api-simulated')?.textContent)",returnByValue:true},sid)).result?.value;
   return Number.isSafeInteger(r)?r:null;
  };
  // Temporarily bypass the DOM disabled flag, dispatch a synthetic event,
  // then restore it. This verifies the JavaScript transition guard itself,
  // not merely the browser's native suppression of disabled button clicks.
  let rejectedTransitionsVerified=0;
  const verifyUnobservedTransitions=async()=>{
   if(!replay)return;
   const probe=(await cdp.send('Runtime.evaluate',{expression:
    "(()=>({disabled:[...document.querySelectorAll('button[data-action]')].filter(b=>b.disabled).map(b=>b.id),completed:Number(document.getElementById('completed-count')?.textContent)}))()",
    returnByValue:true},sid)).result?.value;
   if(!probe||!Array.isArray(probe.disabled)||!Number.isSafeInteger(probe.completed))
    throw Error('F4G_NEGATIVE_PROBE_INVALID');
   for(const id of probe.disabled){
    if(!/^action-[a-z][a-z0-9-]{0,31}$/.test(id))throw Error('F4G_NEGATIVE_ACTION_INVALID');
    const prior=await read(),calls=await counter(),sent=requests.length;
    const dispatched=(await cdp.send('Runtime.evaluate',{expression:
     '(()=>{const b=document.getElementById('+JSON.stringify(id)+');'+
     'if(!b||!b.disabled)return false;'+
     'b.disabled=false;try{b.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true}));}'+
     'finally{b.disabled=true;}return b.disabled===true})()',
     returnByValue:true},sid)).result?.value;
    if(dispatched!==true)throw Error('F4G_NEGATIVE_EVENT_MISSING');
    await DELAY(35);
    const next=await read();
    const completed=(await cdp.send('Runtime.evaluate',{expression:
     "Number(document.getElementById('completed-count')?.textContent)",
     returnByValue:true},sid)).result?.value;
    if(!prior||!next||!same(prior,next)||await counter()!==calls||
       requests.length!==sent||completed!==probe.completed)
     throw Error('F4G_UNOBSERVED_TRANSITION_CHANGED_STATE');
    rejectedTransitionsVerified++;
   }
  };
  const until=async(predicate)=>{
   const start=Date.now();
   while(Date.now()-start<7500){
    try{const s=await read();if(s&&await predicate(s))return s;}catch{}
    await DELAY(55);
   }
   throw Error('F4G_STATE_TIMEOUT');
  };
  await until(s=>same(s,profile.initial));
  const policy=replay?null:fixtureActionPolicy({appId,origin:ORIGIN});
  const readAuthorized=async()=>{
   const raw=(await cdp.send('Runtime.evaluate',{
    expression:SYNTHETIC_CONTROL_PROBE,returnByValue:true},sid)).result?.value;
   return auditFixtureInventory(raw,policy);
  };
  const authorized=replay?null:await readAuthorized();
  if(authorized&&(authorized.denied_controls<4||authorized.authorized_controls!==3))
   throw Error('F2_UNSAFE_CONTROLS_NOT_REJECTED');
  // The generated replay no longer uses prewritten per-app flow arrays.
  // Replay paths are derived from observed source transitions by a bounded
  // graph traversal planner. Only the *source observation* uses test scripts.
  const featureGraph=replay?buildObservedFeatureGraph(evidence):null;
  const flows=replay?featureGraph.coverage_routes.map(route=>route.path_edge_ids.map(edgeId=>{
   const edge=featureGraph.edges.find(e=>e.id===edgeId);
   if(!edge)throw Error('F2_ROUTE_EDGE_UNKNOWN');
   return {action:edge.action,edge};
  })):profile.flows.map(flow=>flow.map(action=>({action,edge:null})));
  const observed=[],visitedEdgeIds=new Set();
  let branchIndex=0;
  for(const flow of flows){
   if(branchIndex++){
    const resetId=replay?'reset-flow':getFixtureActionSelector('reset',await readAuthorized());
    const resetExpression="(()=>{const b=document.getElementById('"+resetId+
     "');if(!b||b.disabled)return false;b.click();return true})()";
    const clicked=(await cdp.send('Runtime.evaluate',{
     expression:resetExpression,returnByValue:true},sid)).result?.value;
    if(clicked!==true)throw Error('F4G_RESET_MISSING');
    await until(s=>same(s,profile.initial));
    if(replay&&await counter()!==0)throw Error('F4G_RESET_COUNTER_BAD');
   }
   let prior=await read();
   for(const routeStep of flow){
    const action=routeStep.action;
    const before=prior;
    if(replay){
     const sourceState=featureGraph.states.find(x=>x.id===routeStep.edge.from)?.values;
     if(!sourceState||!same(before,sourceState))throw Error('F2_PLANNED_SOURCE_MISMATCH');
    }
    const offset=requests.length,prevCounter=replay?await counter():0;
    const approvedId=replay?'action-'+action:getFixtureActionSelector(action,await readAuthorized());
    const select=JSON.stringify('#'+approvedId);
    const clicked=(await cdp.send('Runtime.evaluate',{
     expression:'(()=>{const b=document.querySelector('+select+');if(!b||b.disabled)return false;b.click();return true})()',
     returnByValue:true},sid)).result?.value;
    if(clicked!==true)throw Error('F4G_ACTION_MISSING');
    const expected=replay?
       featureGraph.states.find(x=>x.id===routeStep.edge.to)?.values:
       action==='filter'?{...prior,category:'summer',count:3}:
       action==='layout'?{...prior,layout:'list'}:
       action==='day'?{...prior,day:'tuesday',slots:2}:
       action==='view'?{...prior,layout:'grid'}:
       action==='range'?{...prior,range:'month',total:31}:
       action==='chart'?{...prior,chart:'line'}:null;
    if(!expected)throw Error('F4G_UNKNOWN_ACTION');
    const after=await until(s=>same(s,expected));
    await DELAY(90);
    if(replay)await verifyUnobservedTransitions();
    const actualRequests=requests.slice(offset);
    const expectedCalls=replay?routeStep.edge.observed_api_requests:(profile.request[action]?1:0);
    if(replay){
     if(actualRequests.length||await counter()-prevCounter!==expectedCalls)
      throw Error('F4G_REPLAY_CALL_MISMATCH');
    }else if(actualRequests.length!==expectedCalls)
      throw Error('F4G_SOURCE_CALL_MISMATCH');
    const changed=fields.filter(k=>before[k]!==after[k]);
    const item={id:action,label:profile.actions[action],action:'click',
     status:'completed',before,after,changed_fields:changed,
     request_count:expectedCalls,endpoint_paths:profile.request[action]?[profile.request[action]]:[],
     attribution:'controlled-single-action-window'};
    observed.push(item);
    if(replay)visitedEdgeIds.add(routeStep.edge.id);
    prior=after;
   }
  }
  if(networkFailures)throw Error('F4G_INTERCEPT_FAILURE');
  if(!replay){
   const unsafe=(await cdp.send('Runtime.evaluate',{
    expression:"document.body.dataset.unsafeAction || null",returnByValue:true},sid)).result?.value;
   if(unsafe!==null&&unsafe!==undefined)throw Error('F2_BLOCKED_ACTION_EXECUTED');
  }
  if(replay){
   if(requests.length)throw Error('F4G_REAL_API_REQUEST');
   if(rejectedTransitionsVerified<1)throw Error('F4G_UNVERIFIED_NEGATIVE_PATHS');
   const blueprint=normalizeGenericBehaviorEvidence(evidence);
   if(visitedEdgeIds.size!==blueprint.edges.length||
      observed.length!==featureGraph.metrics.planned_clicks)
    throw Error('F4G_EDGE_COVERAGE_MISMATCH');
   return {source:'controlled-generic-replay',scope:'synthetic-only',
    verified_steps:observed.length,actual_api_calls:0,
    observed_edge_coverage:visitedEdgeIds.size,
    verified_route_ids:featureGraph.coverage_routes.map(r=>r.id),
    simulated_api_calls:observed.reduce((n,v)=>n+v.request_count,0),
    branching:flows.length>1,denied_requests:denied,
    unobserved_transitions_rejected:rejectedTransitionsVerified};
  }
  const evidenceOutput={source:'controlled-generic-chrome',scope:'synthetic-only',
   verification:'real-isolated-chrome',app_id:appId,title:profile.title,
   initial:profile.initial,steps:observed,
   observed_action_api_links:observed.filter(s=>s.request_count).length,
   execution_policy:{source:authorized.source,scope:authorized.scope,
    authorized_controls:authorized.authorized_controls,
    denied_controls:authorized.denied_controls,
    unauthorized_actions_executed:0,external_navigation_performed:false,
    form_submissions_performed:0,
    approved_action_ids:authorized.actions.map(a=>a.action)}};
  normalizeGenericBehaviorEvidence(evidenceOutput);
  return evidenceOutput;
 }finally{
  if(cdp){try{await cdp.send('Browser.close',{},undefined,1200);}catch{}cdp.close();}
  if(child&&child.exitCode===null)try{child.kill();}catch{}
  await rm(dir,{recursive:true,force:true,maxRetries:4,retryDelay:150}).catch(()=>{});
 }
}
export async function observeGenericControlledApp({browserPath,appId}={}){
 return runChrome({browserPath,appId});
}
export async function verifyGenericControlledReplay({browserPath,evidence,html}={}){
 return runChrome({browserPath,appId:evidence?.app_id,replayHtml:html,evidence});
}
export function listGenericSyntheticFixtures(){return Object.keys(profiles);}
