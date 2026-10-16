// F2 isolated action/network proof: fixed synthetic page only.
// NEVER run actions on any user-supplied or third-party URL.
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CdpClient} from './dynamic-browser.mjs';
const ORIGIN='https://webrea-controlled-fixture.example.org';
const TARGET=ORIGIN+'/';
const html=String.raw`<!doctype html><html><head><title>F2 synthetic</title></head><body>
<button id="period">Period</button><button id="sort">Sort</button>
<button id="help">Help</button><button id="refresh">Refresh</button>
<div id="period-state">7</div><div id="sort-state">asc</div>
<div id="view-state">table</div><div id="rows">0</div><div id="ready">no</div>
<script>
let period=7,order='asc',view='table';
function paint(){document.getElementById('period-state').textContent=String(period);
 document.getElementById('sort-state').textContent=order;
 document.getElementById('view-state').textContent=view;}
async function load(){document.getElementById('ready').textContent='no';
 const data=await (await fetch('/api/rows?period='+period)).json();
 document.getElementById('rows').textContent=String(data.count);
 document.getElementById('ready').textContent='yes';}
document.getElementById('period').onclick=()=>{period=30;paint();load();};
document.getElementById('sort').onclick=()=>{order='desc';paint();};
document.getElementById('help').onclick=()=>{view='help';paint();};
document.getElementById('refresh').onclick=()=>load();
paint();load();
</script></body></html>`;
const sleep=n=>new Promise(r=>setTimeout(r,n));
function classify(url,method){
 if(method!=='GET')return null;
 let u;try{u=new URL(url);}catch{return null;}
 if(u.origin!==ORIGIN||u.username||u.password||u.hash)return null;
 if(u.href===TARGET)return {kind:'document'};
 if(u.pathname==='/api/rows'&&u.searchParams.size===1&&
    ['7','30'].includes(u.searchParams.get('period')))
    return {kind:'api',period:Number(u.searchParams.get('period'))};
 return null;
}
export function classifyControlledF2Request(url,method){return classify(url,method);}
async function connect(profile,child){
 for(let i=0;i<90;i++){
  if(child.exitCode!==null)throw Error('F2_CHROME_EXITED');
  try{
   const [p,path]=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split(/\r?\n/);
   if(Number(p)>0&&/^\/devtools\/browser\/[\w-]+$/.test(path)){
    const ws=new WebSocket('ws://127.0.0.1:'+p+path);
    await new Promise((res,rej)=>{
     const t=setTimeout(()=>rej(Error('F2_WS_TIMEOUT')),8000);
     ws.addEventListener('open',()=>{clearTimeout(t);res();},{once:true});
     ws.addEventListener('error',()=>{clearTimeout(t);rej(Error('F2_WS_ERROR'));},{once:true});
    });
    return new CdpClient(ws);
   }
  }catch(e){if(e.message==='F2_WS_TIMEOUT'||e.message==='F2_WS_ERROR')throw e;}
  await sleep(110);
 }
 throw Error('F2_CHROME_START_TIMEOUT');
}
const STATE=String.raw`(()=>{const g=x=>document.getElementById(x)?.textContent;return {
 period:Number(g('period-state')),order:g('sort-state'),
 view:g('view-state'),rows:Number(g('rows')),ready:g('ready')==='yes'
}})()`;
const STATE_REPLAY=String.raw`(()=>{const g=x=>document.getElementById(x)?.textContent;return {
 period:Number(g('period-state')),order:g('order-state'),
 view:g('view-state'),rows:Number(g('rows-state')),ready:g('ready-state')==='yes'
}})()`;
const actions=[
 {name:'change-period',selector:'#period',requests:1,expect:s=>s.period===30&&s.rows===8},
 {name:'sort-rows',selector:'#sort',requests:0,expect:s=>s.order==='desc'},
 {name:'open-help',selector:'#help',requests:0,expect:s=>s.view==='help'},
 {name:'refresh',selector:'#refresh',requests:1,expect:s=>s.rows===8}
];
export async function verifyControlledF2Actions({browserPath,launch=spawn,prototypeHtml=null}={}){
 const replay=typeof prototypeHtml==='string';
 if(prototypeHtml!==null&&(!replay||prototypeHtml.length>75000||prototypeHtml.length<1000||
    !prototypeHtml.includes('<title>Web REA · Synthetic Behavior Replay</title>')||
    !prototypeHtml.includes('connect-src &#39;none&#39;')))throw Error('F4_UNTRUSTED_REPLAY_DOCUMENT');
 if(typeof browserPath!=='string'||!browserPath.trim())throw Error('F2_BROWSER_REQUIRED');
 const profile=await mkdtemp(join(tmpdir(),'webrea-f2-controlled-'));
 let child,cdp,sid;const requests=[];let denied=0,failures=0;
 try{
  child=launch(browserPath,['--headless=new','--disable-gpu','--no-first-run',
   '--no-default-browser-check','--disable-background-networking','--disable-extensions',
   '--disable-component-update','--disable-sync','--disable-quic','--no-proxy-server',
   '--host-resolver-rules=MAP * ~NOTFOUND','--remote-debugging-port=0',
   '--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,'about:blank'],
   {stdio:'ignore',windowsHide:true});
  cdp=await connect(profile,child);
  const tab=await cdp.send('Target.createTarget',{url:'about:blank'});
  sid=(await cdp.send('Target.attachToTarget',{targetId:tab.targetId,flatten:true})).sessionId;
  await cdp.send('Page.enable',{},sid);
  await cdp.send('Runtime.enable',{},sid);
  await cdp.send('Network.enable',{},sid);
  await cdp.send('Network.setBypassServiceWorker',{bypass:true},sid);
  cdp.on('Fetch.requestPaused',async(e,session)=>{
   if(session!==sid)return;
   const decision=classify(e.request?.url,e.request?.method);
   // In F4 replay the only allowed resource is the initial in-memory page.
   // The generated application must not call /api/rows or any other API.
   const allowed=decision&&(replay?decision.kind==='document':true);
   try{
    if(!allowed){denied++;await cdp.send('Fetch.failRequest',
      {requestId:e.requestId,errorReason:'BlockedByClient'},sid);return;}
    const content=decision.kind==='document'?(replay?prototypeHtml:html):
     JSON.stringify({count:decision.period===7?3:8});
    if(decision.kind==='api')requests.push({path:'/api/rows',method:'GET'});
    const headers=[{name:'Content-Type',value:decision.kind==='document'?
      'text/html; charset=utf-8':'application/json; charset=utf-8'},
      {name:'Cache-Control',value:'no-store'}];
    if(decision.kind==='document')headers.push({name:'Content-Security-Policy',
      value:replay?"default-src 'none'; script-src 'unsafe-inline'; connect-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; frame-src 'none'; form-action 'none'":
       "default-src 'none'; script-src 'unsafe-inline'; connect-src 'self'; style-src 'none'; img-src 'none'; font-src 'none'; frame-src 'none'; form-action 'none'"});
    await cdp.send('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:200,
      responseHeaders:headers,body:Buffer.from(content).toString('base64')},sid);
   }catch{failures++;}
  });
  await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]},sid);
  const navigation=await cdp.send('Page.navigate',{url:TARGET},sid);
  if(navigation.errorText)throw Error('F2_NAVIGATION_FAILED');
  const readState=async()=>{
   const v=(await cdp.send('Runtime.evaluate',{expression:replay?STATE_REPLAY:STATE,returnByValue:true},sid)).result?.value;
   return v&&[7,30].includes(v.period)&&['asc','desc'].includes(v.order)&&
    ['table','help'].includes(v.view)&&Number.isInteger(v.rows)&&
    v.rows>=0&&v.rows<=100&&typeof v.ready==='boolean'?v:null;
  };
  async function until(predicate){
   const t=Date.now();
   while(Date.now()-t<7500){let x;try{x=await readState();}catch{}
    if(x&&predicate(x))return x;
    await sleep(50);
   }
   throw Error('F2_CONTROLLED_STATE_TIMEOUT');
  }
  let prior=await until(s=>s.ready&&s.period===7&&s.rows===3);
  if(replay?requests.length!==0:requests.length!==1)throw Error('F2_INITIAL_API_UNEXPECTED');
  async function simulatedCount(){
   const output=(await cdp.send('Runtime.evaluate',{
    expression:"Number(document.getElementById('api-simulated')?.textContent)",
    returnByValue:true},sid)).result?.value;
   if(!Number.isSafeInteger(output)||output<0||output>10)throw Error('F4_INVALID_SIMULATED_COUNTER');
   return output;
  }
  let previousSimulated=replay?await simulatedCount():0;
  if(replay&&previousSimulated!==1)throw Error('F4_REPLAY_INITIAL_STATE_INVALID');
  const steps=[];
  for(const a of actions){
   const offset=requests.length;
   const code='(()=>{const b=document.querySelector('+JSON.stringify(a.selector)+');if(!b)return false;b.click();return true})()';
   const clicked=(await cdp.send('Runtime.evaluate',{expression:code,returnByValue:true},sid)).result?.value;
   if(clicked!==true)throw Error('F2_CONTROL_MISSING');
   const state=await until(s=>s.ready&&a.expect(s));
   const calls=requests.slice(offset);
   let simulatedDelta=0;
   if(replay){
    const simulated=await simulatedCount();
    simulatedDelta=simulated-previousSimulated;
    previousSimulated=simulated;
    if(calls.length!==0||simulatedDelta!==a.requests)throw Error('F4_REPLAY_NETWORK_MISMATCH');
   }else if(calls.length!==a.requests)throw Error('F2_API_LINK_MISMATCH');
   const fields=Object.keys(state).filter(k=>k!=='ready'&&state[k]!==prior[k]);
   if(!fields.length&&a.name!=='refresh')throw Error('F2_EXPECTED_CHANGE_MISSING');
   steps.push({step_id:a.name,action:'click',status:'completed',
    changed_fields:fields,state_before:prior,state_after:state,
    network_requests:calls.length,
    ...(replay?{simulated_api_calls:simulatedDelta}:{}),
    endpoint_paths:[...new Set(calls.map(v=>v.path))],
    attribution:replay?'verified-local-simulation':'verified-in-controlled-single-action-window'});
   prior=state;
  }
  if(failures)throw Error('F2_INTERCEPTION_FAILURE');
  if(replay){
   if(requests.length!==0)throw Error('F4_REPLAY_MADE_HTTP_CALLS');
   return {source:'controlled-f4-replay',scope:'generated-synthetic-only',
    executed_actions:steps.length,passed_steps:steps.length,
    real_api_requests:0,simulated_api_calls:steps.reduce((n,step)=>n+step.simulated_api_calls,0),
    steps:steps.map(step=>({step_id:step.step_id,status:step.status,
     state_after:step.state_after,simulated_api_calls:step.simulated_api_calls})),
    limitations:['Only isolated generated synthetic HTML was exercised',
     'Simulated API counter is not a real request or backend reproduction']};
  }
  return {source:'controlled-f2-chrome',scope:'in-memory-synthetic-only',
   verified_actions:steps.length,verified_action_api_links:steps.filter(x=>x.network_requests).length,
   initial_api_requests:1,denied_unknown_requests:denied,steps,
   limitations:['No actions on real websites','Only synthetic fixed page tested',
    'Request attribution verified only for isolated serial fixture actions']};
 }finally{
  if(cdp){try{await cdp.send('Browser.close',{},undefined,1200);}catch{}cdp.close();}
  if(child&&child.exitCode===null)try{child.kill();}catch{}
  await rm(profile,{recursive:true,force:true,maxRetries:4,retryDelay:150}).catch(()=>{});
 }
}

export async function verifyControlledF4Replay({browserPath,prototypeHtml,launch=spawn}={}){
 if(typeof prototypeHtml!=='string')throw Error('F4_DOCUMENT_REQUIRED');
 return verifyControlledF2Actions({browserPath,launch,prototypeHtml});
}
