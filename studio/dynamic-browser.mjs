import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {approveBrowserRequest,fetchGatewayResource,redactedResourcePath,LOCKDOWN_CSP,STATIC_VISUAL_CSP,DYNAMIC_LIMITS} from './dynamic-gateway.mjs';
import {validateHttpsUrl} from './static-analysis.mjs';
import {LAYOUT_PROBE,sanitizeRenderedLayout} from './rendered-blueprint.mjs';
import {P4_GEOMETRY_PROBE,sanitizeP4Geometry} from './p4-reconstruction.mjs';
import {CONTROL_PROBE,sanitizeControlInventory,summarizePassiveDependencies} from './interaction-blueprint.mjs';

const error=(code,message)=>Object.assign(Error(message),{code});
const wait=ms=>new Promise(r=>setTimeout(r,ms));

/** Distinguish successful screenshot capture from successful app rendering.
 * A screenshot of an error message is diagnostic evidence, not successful reproduction.
 */
export function assessPassiveRender(page,metrics){
 const pending=typeof metrics.pending==='number'?metrics.pending:Math.max(0,(metrics.requested||0)-(metrics.fulfilled||0)-(metrics.blocked||0));
 const failures=[];
 if(page?.application_fetch_error_visible===true)failures.push('application_fetch_error_visible');
 if(pending>0)failures.push('resource_requests_unsettled');
 if((metrics.fetchRejections||0)>0)failures.push('fetch_requests_rejected');
 if((metrics.criticalBlocked||0)>0)failures.push('critical_resources_blocked');
 return {verdict:failures.length?'FAIL':'PASS',failures,pending,
  render_fidelity:failures.length?'incomplete':metrics.blocked?'partial':'unverified'};
}


/** Avoid sampling the page while delayed scripts are still issuing API requests.
 * Exit once the minimum render time and an actual quiet interval have elapsed,
 * and every CDP Fetch interception has settled. Hard deadline prevents hangs.
 */
export async function waitForPassiveIdle({snapshot,minWaitMs=5000,quietMs=1800,maxWaitMs=22000,pollMs=100,clock=Date.now,sleep=wait}={}){
 const began=clock();let lastChange=began;
 let previous='';
 while(clock()-began<maxWaitMs){
  const value=snapshot();
  const key=`${value.requested}/${value.settled}/${value.pending}`;
  if(key!==previous){lastChange=clock();previous=key;}
  if(clock()-began>=minWaitMs && value.pending===0 && clock()-lastChange>=quietMs)return {idle:true,wait_ms:clock()-began};
  await sleep(pollMs);
 }
 return {idle:false,wait_ms:clock()-began};
}

export function sanitizedNetworkTarget(raw,approved){
 try{
  const u=new URL(raw),owner=new URL(approved);
  if(u.origin===owner.origin)return {path:u.pathname.slice(0,160),scope:'approved-origin'};
  if(u.protocol!=='https:')return {path:null,scope:'other-scheme'};
  if(u.username||u.password)return {path:null,scope:'credential-url'};
  if(!/^[a-z0-9.-]{1,180}$/i.test(u.hostname))return {path:null,scope:'other-origin'};
  return {path:null,scope:'other-origin',host:u.hostname.toLowerCase()};
 }catch{return {path:null,scope:'invalid-url'};}
}


/* Passive local diagnostic only: observe fetch/XHR without issuing requests. */
export const PASSIVE_TRACE_SCRIPT=String.raw`(()=>{
 const log=[];let fetches=0,rejections=0,xhrs=0;
 const safeUrl=input=>{
  try{
   const raw=typeof input==='string'?input:input&&typeof input.url==='string'?input.url:'';
   const u=new URL(raw,location.href);
   if(u.origin===location.origin)return {scope:'approved-origin',path:u.pathname.slice(0,120)};
   if(u.protocol==='https:' && /^[a-z0-9.-]{1,180}$/i.test(u.hostname))return {scope:'other-origin',host:u.hostname.toLowerCase()};
  }catch{}
  return {scope:'unknown'};
 };
 const emit=(kind,target)=>{
  if(log.length<32)log.push({kind,...safeUrl(target)});
 };
 const nativeFetch=window.fetch;
 if(typeof nativeFetch==='function'){
  window.fetch=function(...args){
   fetches++;emit('fetch-attempt',args[0]);
   let result;
   try{result=Reflect.apply(nativeFetch,this,args);}
   catch(e){rejections++;emit('fetch-rejected',args[0]);throw e;}
   return result.catch(e=>{rejections++;emit('fetch-rejected',args[0]);throw e;});
  };
 }
 if(typeof XMLHttpRequest!=='undefined'){
  const nativeOpen=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(method,url,...args){
   xhrs++;emit('xhr-open',url);
   return Reflect.apply(nativeOpen,this,[method,url,...args]);
  };
 }
 Object.defineProperty(window,'__webrea_passive_trace',{value:{
  snapshot:()=>({fetches,rejections,xhrs,events:log.slice()})
 },writable:false,configurable:false});
})()`;
export function isIncidentalFavicon(request,target){
 try{
  const u=new URL(request.url),t=new URL(target);
  return request.method==='GET' && request.resourceType==='Other' &&
   u.href===t.origin+'/favicon.ico';
 }catch{return false;}
}
export function sanitizeClientTrace(trace,target){
 const safeEvents=[];
 for(const event of Array.isArray(trace?.events)?trace.events.slice(0,32):[]){
  if(!event||!['fetch-attempt','fetch-rejected','xhr-open'].includes(event.kind))continue;
  const safe={kind:event.kind};
  if(event.scope==='approved-origin'&&typeof event.path==='string'&&/^\/[A-Za-z0-9_./%~-]{0,119}$/.test(event.path) && !event.path.includes('..')){
   safe.path=event.path;safe.scope='approved-origin';
  }else if(event.scope==='other-origin'&&typeof event.host==='string'&&/^[a-z0-9.-]{1,180}$/.test(event.host)){
   safe.host=event.host;safe.scope='other-origin';
  }else safe.scope='unknown';
  safeEvents.push(safe);
 }
 const bound=n=>Number.isInteger(n)&&n>=0&&n<=1000?n:0;
 return {fetches:bound(trace?.fetches),rejections:bound(trace?.rejections),xhrs:bound(trace?.xhrs),events:safeEvents};
}

export const STATIC_VISUAL_VIEWPORT=Object.freeze({width:1440,height:900,deviceScaleFactor:1,mobile:false});
export function staticVisualCaptureSpec(layout,{width=1440,height=900,maxHeight=4000}={}){
 const proposed=layout?.cssContentSize?.height??layout?.contentSize?.height;
 const pageHeight=typeof proposed==='number'&&Number.isFinite(proposed)&&proposed>0?Math.ceil(proposed):height;
 const heightUsed=Math.min(maxHeight,Math.max(height,pageHeight));
 return {clip:{x:0,y:0,width,height:heightUsed,scale:1},
  page_height:pageHeight,truncated:pageHeight>maxHeight};
}
export function screenshotPngDimensions(png){
 if(!Buffer.isBuffer(png)||png.length<24||!png.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))return null;
 return {width:png.readUInt32BE(16),height:png.readUInt32BE(20)};
}

export class CdpClient{
 constructor(ws){
  this.ws=ws;this.next=1;this.pending=new Map();this.handlers=new Map();
  ws.addEventListener('message',event=>{
   let m;try{m=JSON.parse(event.data);}catch{return;}
   if(m.id){const p=this.pending.get(m.id);if(!p)return;this.pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(error('CDP_REMOTE_ERROR',m.error.message||'Chrome DevTools command failed')):p.resolve(m.result||{});return;}
   for(const h of this.handlers.get(m.method)||[])Promise.resolve().then(()=>h(m.params||{},m.sessionId)).catch(()=>{});
  });
  ws.addEventListener('close',()=>{for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(error('CDP_DISCONNECTED','Chrome disconnected'));}this.pending.clear();});
 }
 on(event,handler){const h=this.handlers.get(event)||[];h.push(handler);this.handlers.set(event,h);}
 send(method,params={},sessionId,ms=15000){
  if(this.ws.readyState!==1)return Promise.reject(error('CDP_DISCONNECTED','Chrome websocket is not open'));
  const id=this.next++;return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{this.pending.delete(id);reject(error('CDP_TIMEOUT',`Chrome command timed out: ${method}`));},ms);
   this.pending.set(id,{resolve,reject,timer});
   this.ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
  });
 }
 close(){try{this.ws.close();}catch{}}
}

async function connectBrowser(port,pathname){
 const socket=new WebSocket(`ws://127.0.0.1:${port}${pathname}`);
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(error('CDP_CONNECT_TIMEOUT','Chrome debugging connection timed out')),10000);
  socket.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});
  socket.addEventListener('error',()=>{clearTimeout(timer);reject(error('CDP_CONNECT_FAILED','Chrome debugging connection failed'));},{once:true});
 });
 return new CdpClient(socket);
}
async function getDevtoolsPort(profile,child){
 const file=join(profile,'DevToolsActivePort');
 for(let i=0;i<80;i++){
  if(child.exitCode!==null)throw error('CHROME_EXITED','Chrome quit before debugger startup');
  try{const t=(await readFile(file,'utf8')).split(/\r?\n/);const port=Number(t[0]);if(port>0&&port<65536&&/^\/devtools\/browser\/[\w-]+$/.test(t[1]))return {port,path:t[1]};}catch{}
  await wait(125);
 }
 throw error('CDP_START_TIMEOUT','Chrome debugging port file not created');
}
const browserJs=`(()=>{
 const clean=s=>String(s??'').replace(/[\\x00-\\x1f]/g,' ').slice(0,120);
 // Only a boolean error signal crosses the browser boundary, not the page text.
 const visibleText=String(document.body?.innerText||'').slice(0,100000);
 const application_fetch_error_visible=/failed to fetch|보고서를 불러오지 못했습니다/i.test(visibleText);
 const passive_trace=window.__webrea_passive_trace?.snapshot?.()||null;
 return {title:clean(document.title),state:document.readyState,application_fetch_error_visible,passive_trace,
 headings:[...document.querySelectorAll('h1,h2,h3')].slice(0,25).map(el=>({tag:el.tagName,text:clean(el.textContent)})),
 controls:[...document.querySelectorAll('button,input,select,textarea')].slice(0,50).map(el=>({tag:el.tagName,id:clean(el.id),type:clean(el.getAttribute('type'))})),
 counts:{buttons:document.querySelectorAll('button').length,inputs:document.querySelectorAll('input').length,forms:document.querySelectorAll('form').length,links:document.querySelectorAll('a').length},
 body_bytes:document.body?.innerText?.length||0};
})()`;

/** Passive browser: no clicks, no credentials, no navigation off exact selected URL.
 * All browser network requests route through a bounded Node HTTPS relay, while
 * browser DNS resolution and proxy use are disabled as defense in depth.
 */
export async function runDynamicAnalysis({target,browserPath,dir,relay=fetchGatewayResource,launch=spawn,timeoutMs=DYNAMIC_LIMITS.maxDurationMs,scriptsDisabled=false}={}){
 if(typeof scriptsDisabled!=='boolean')throw error('INVALID_RENDER_OPTION','scriptsDisabled must be boolean');
 validateHttpsUrl(target);
 if(typeof browserPath!=='string'||!browserPath.trim())throw error('BROWSER_NOT_FOUND','Chrome path required');
 const profile=await mkdtemp(join(tmpdir(),'webrea-cdp-'));
 const flags=['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-extensions','--disable-component-update','--disable-sync','--disable-quic','--no-proxy-server','--host-resolver-rules=MAP * ~NOTFOUND','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`,'about:blank'];
 let child,cdp,sessionId;
 const events=[],metrics={requested:0,fulfilled:0,blocked:0,criticalBlocked:0,bytes:0,synthetic_favicons:0},start=Date.now(),tasks=new Set();
 const pendingIds=new Set(),networkPaths=new Map();
 let chromeFailures=0;
 try{
  child=launch(browserPath,flags,{stdio:'ignore',windowsHide:true});
  const {port,path}=await getDevtoolsPort(profile,child);
  cdp=await connectBrowser(port,path);
  const created=await cdp.send('Target.createTarget',{url:'about:blank'});
  sessionId=(await cdp.send('Target.attachToTarget',{targetId:created.targetId,flatten:true})).sessionId;
  await cdp.send('Page.enable',{},sessionId);
  // Only the opt-in Static Visual mode changes viewport size.
  if(scriptsDisabled)await cdp.send('Emulation.setDeviceMetricsOverride',STATIC_VISUAL_VIEWPORT,sessionId);
  await cdp.send('Network.enable',{},sessionId);
  await cdp.send('Network.setBypassServiceWorker',{bypass:true},sessionId);
  await cdp.send('Runtime.enable',{},sessionId);
  if(!scriptsDisabled)await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:PASSIVE_TRACE_SCRIPT},sessionId);
  cdp.on('Network.requestWillBeSent',(event,sid)=>{
   if(sid!==sessionId)return;
   if(networkPaths.size<150)networkPaths.set(event.requestId,sanitizedNetworkTarget(event.request?.url,target));
  });
  cdp.on('Network.loadingFailed',(event,sid)=>{
   if(sid!==sessionId)return;
   chromeFailures++;
   const details=networkPaths.get(event.requestId)||{path:null,scope:'unknown'};
   // Do not send the browser's unsanitized error strings or any URL query to UI.
   const reason=event.blockedReason&&/^[a-zA-Z_]{1,40}$/.test(event.blockedReason)?event.blockedReason:
    event.corsErrorStatus?'cors_error':/ERR_BLOCKED_BY_CLIENT/.test(event.errorText||'')?'blocked_by_client':'network_failed';
   if(events.length<120)events.push({kind:'browser-failed',...details,reason});
  });
  cdp.on('Fetch.requestPaused',(req,sid)=>{
   if(sid!==sessionId)return;
   pendingIds.add(req.requestId);
   const promise=(async()=>{
    metrics.requested++;
    const request={url:req.request?.url,method:req.request?.method,resourceType:req.resourceType};
    const approved=approveBrowserRequest(request,{target,seen:metrics.requested-1,bytes:metrics.bytes});
    const path=redactedResourcePath(req.request?.url,target);
    const criticalResource=['Document','Script','XHR','Fetch'].includes(req.resourceType);
    // Record the request even if it remains pending when the screenshot is taken.
    // Only same-origin pathname metadata is retained; query parameters are removed.
    if(events.length<120)events.push({kind:'requested',...sanitizedNetworkTarget(req.request?.url,target),resource_type:req.resourceType});
    if(isIncidentalFavicon(request,target)){
     // Browsers auto-request a favicon even if the application doesn't use it.
     // Complete this cosmetic request locally; never fetch an unknown icon from the site.
     try{
      await cdp.send('Fetch.fulfillRequest',{requestId:req.requestId,responseCode:204,
       responseHeaders:[{name:'Cache-Control',value:'no-store'}]},sessionId);
      metrics.fulfilled++;metrics.synthetic_favicons++;
      if(events.length<120)events.push({kind:'synthetic-favicon',path:'/favicon.ico',status:204});
     }catch{
      metrics.blocked++;
      if(events.length<120)events.push({kind:'favicon-failed',path:'/favicon.ico',reason:'cdp_completion_failed'});
      await cdp.send('Fetch.failRequest',{requestId:req.requestId,errorReason:'BlockedByClient'},sessionId).catch(()=>{});
     }
     return;
    }
    if(!approved.allowed){metrics.blocked++;if(criticalResource)metrics.criticalBlocked++;if(events.length<120)events.push({kind:'blocked',...sanitizedNetworkTarget(req.request?.url,target),resource_type:req.resourceType,reason:approved.reason});await cdp.send('Fetch.failRequest',{requestId:req.requestId,errorReason:'BlockedByClient'},sessionId);return;}
    try{
     const response=await relay(approved.url);
     if(metrics.bytes+response.body.length>DYNAMIC_LIMITS.maxBytes)throw error('BUDGET_EXHAUSTED','Resource budget');
     metrics.bytes+=response.body.length;
     const responseHeaders=[{name:'Content-Type',value:response.contentType},{name:'Cache-Control',value:'no-store'},{name:'X-Content-Type-Options',value:'nosniff'}];
     if(req.resourceType==='Document')responseHeaders.push({name:'Content-Security-Policy',value:scriptsDisabled?STATIC_VISUAL_CSP:LOCKDOWN_CSP});
     await cdp.send('Fetch.fulfillRequest',{requestId:req.requestId,responseCode:response.status,responseHeaders,body:response.body.toString('base64')},sessionId);
     metrics.fulfilled++;
     if(events.length<120)events.push({kind:'fulfilled',path,status:response.status,bytes:response.body.length});
    }catch(e){
     metrics.blocked++;
     if(criticalResource)metrics.criticalBlocked++;
     const reason=typeof e.code==='string'&&/^[A-Z_]{3,50}$/.test(e.code)?e.code:'REQUEST_FAILED';
     if(events.length<120)events.push({kind:'blocked',path,resource_type:req.resourceType,reason});
     await cdp.send('Fetch.failRequest',{requestId:req.requestId,errorReason:'BlockedByClient'},sessionId).catch(()=>{});
    }
   })();tasks.add(promise);
   void promise.finally(()=>{tasks.delete(promise);pendingIds.delete(req.requestId);}).catch(()=>{});
  });
  await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]},sessionId);
  const navigated=await cdp.send('Page.navigate',{url:target},sessionId);
  if(navigated.errorText)throw error('NAVIGATION_FAILED',`Target navigation failed (${String(navigated.errorText).slice(0,100)}); no screenshot claimed`);
  // Allow late async API requests to appear and actually settle. In particular,
  // Chrome navigates before JS-created fetches necessarily begin. The old logic
  // could leave after 1.8s and capture a page whose API was still loading.
  const budget=Math.max(1500,Math.min(22000,start+timeoutMs-4000-Date.now()));
  const idle=await waitForPassiveIdle({snapshot:()=>({requested:metrics.requested,
    settled:metrics.fulfilled+metrics.blocked,pending:pendingIds.size}),
    maxWaitMs:budget,minWaitMs:Math.min(5000,Math.floor(budget*0.45))});
  if(!idle.idle && events.length<120)events.push({kind:'wait-timeout',pending:pendingIds.size});
  const runtime=await cdp.send('Runtime.evaluate',{expression:browserJs,returnByValue:true,awaitPromise:false},sessionId);
  const initialPage=runtime.result?.value;
  if(!initialPage||typeof initialPage!=='object')throw error('DOM_CAPTURE_FAILED','Browser page summary unavailable');
  const frame=await cdp.send('Page.getFrameTree',{},sessionId);
  const observedUrl=frame.frameTree?.frame?.url;
  if(observedUrl!==target)throw error('NAVIGATION_OUT_OF_SCOPE','Chrome final URL differs from approved URL');
  if(metrics.fulfilled===0)throw error('NO_APPROVED_RESPONSE','No document or resources could be loaded');
  let region=null,captureVariant=scriptsDisabled?'viewport-fallback':'viewport';
  if(scriptsDisabled){
   try{
    const m=await cdp.send('Page.getLayoutMetrics',{},sessionId,2500);
    region=staticVisualCaptureSpec(m);
   }catch{}
  }
  let shot;
  if(scriptsDisabled&&region){
   try{
    shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,fromSurface:true,clip:region.clip},sessionId);
    captureVariant=region.truncated?'full-page-bounded':'full-page';
   }catch{
    // Only one fallback; the screenshot is not silently reported as full page.
    shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true},sessionId);
   }
  }else shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true},sessionId);
  const png=Buffer.from(shot.data||'','base64');
  if(png.length<100||png.length>5*1024*1024||!png.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))throw error('SCREENSHOT_INVALID','PNG capture missing/invalid');
  const screenshot_sha256=createHash('sha256').update(png).digest('hex');
  const screenshotSize=screenshotPngDimensions(png);
  if(!screenshotSize||screenshotSize.width<1||screenshotSize.width>4000||screenshotSize.height<1||screenshotSize.height>5000)
   throw error('SCREENSHOT_INVALID','PNG screenshot dimensions invalid');
  await writeFile(join(dir,'screenshot.png'),png,{mode:0o600});
  // Recheck DOM after screenshot because the browser may paint a newer error
  // than the first Runtime.evaluate snapshot observed.
  const afterScreenshot=await cdp.send('Runtime.evaluate',{expression:browserJs,returnByValue:true,awaitPromise:false},sessionId);
  const finalPage=afterScreenshot.result?.value;
  const rawPage=finalPage&&typeof finalPage==='object'?finalPage:initialPage;
  const telemetry=sanitizeClientTrace(rawPage.passive_trace,target);
  const page={...rawPage,passive_trace:telemetry,
   application_fetch_error_visible:initialPage.application_fetch_error_visible===true||rawPage.application_fetch_error_visible===true};
  // A separate read-only geometry probe; never make screenshot/report depend on it.
  let layout=null;
  try{
   const observation=await cdp.send('Runtime.evaluate',{expression:LAYOUT_PROBE,returnByValue:true,awaitPromise:false},sessionId,2500);
   layout=sanitizeRenderedLayout(observation.result?.value);
  }catch{}
  page.frontend_blueprint=layout||{source:'computed-dom',status:'probe-unavailable'};
  // P4 capture is only meaningful on script-disabled initial HTML. It does not
  // make extra HTTP requests, invoke page scripts or read input values.
  let geometry=null;
  if(scriptsDisabled){
   try{
    const sampled=await cdp.send('Runtime.evaluate',{expression:P4_GEOMETRY_PROBE,returnByValue:true,awaitPromise:false},sessionId,4000);
    geometry=sanitizeP4Geometry(sampled.result?.value);
   }catch{}
   if(geometry)page.reconstruction_blueprint=geometry;
  }
  // F1/F2: read-only control map + observed network dependencies.
  // Probe reads visible DOM affordances, not actions, input values, or URLs.
  let inventory=null;
  try{
   const inventoryResult=await cdp.send('Runtime.evaluate',{
    expression:CONTROL_PROBE,returnByValue:true,awaitPromise:false},sessionId,3000);
   inventory=sanitizeControlInventory(inventoryResult.result?.value);
  }catch{}
  page.interaction_inventory=inventory||{source:'passive-controls',verification:'probe-unavailable',actions_executed:0};
  const networkEvidence=[...events,...telemetry.events].slice(0,100);
  const dependencyMap=summarizePassiveDependencies(networkEvidence,inventory,{
   mode:scriptsDisabled?'static-visual':'dynamic-passive'});
  const assessment=assessPassiveRender(page,{...metrics,pending:pendingIds.size,fetchRejections:scriptsDisabled?0:telemetry.rejections});
  const mode=scriptsDisabled?'static-visual':'dynamic-passive';
  const completeness=scriptsDisabled
   ?assessment.verdict==='FAIL'?'incomplete-static-visual':'static-dom-visual-only'
   :assessment.verdict==='FAIL'?'incomplete':metrics.blocked?'partial-resource-load':'passive-browser-only';
  const inspection={schema_version:3,scope:'explicit-https-allowlist',mode,completeness,scripts_executed:!scriptsDisabled,screen_capture:{width:screenshotSize.width,height:screenshotSize.height,variant:captureVariant,truncated:region?.truncated===true&&captureVariant==='full-page-bounded'},
    browser:{product:'Chrome/CDP',version:null},page,exploration:{inventory:page.interaction_inventory,dependencies:dependencyMap},steps:[{step_id:'authorized-navigation',action:'GET',status:'completed',elapsed_ms:Date.now()-start}],network:[...events,...telemetry.events].slice(0,100),network_diagnostics:{browser_failures:chromeFailures,wait_ms:idle.wait_ms,wait_idle:idle.idle,pending_requests:pendingIds.size,fetch_attempts:telemetry.fetches,fetch_rejections:telemetry.rejections,xhr_attempts:telemetry.xhrs,synthetic_favicons:metrics.synthetic_favicons},limitations:[...(scriptsDisabled?['JavaScript blocked by CSP; HTML-only visual capture, not real application rendering','No live API calls or interactions']:['Passive fetch/XHR observation (no added HTTP requests)']),'favicon.ico may be locally synthesized','No clicks or form submission','Only same-origin GET resources relayed','No cookies, authentication, redirects or third-party assets','Not a full operating-system network sandbox','No original source-code recovery']};
  const report={verdict:assessment.verdict,analysis_mode:mode,scripts_executed:!scriptsDisabled,application_render_status:scriptsDisabled?'not-executed':'attempted',failures:assessment.failures,step_count:1,completed_steps:1,resource_requests:metrics.requested,resource_fulfilled:metrics.fulfilled,resource_blocked:metrics.blocked,critical_resources_blocked:metrics.criticalBlocked,resource_pending:assessment.pending,chrome_network_failures:chromeFailures,resource_wait_idle:idle.idle,resource_wait_ms:idle.wait_ms,resource_bytes:metrics.bytes,layout_elements:layout?.components?.length??0,controls_discovered:inventory?.counts?.total??0,verified_control_effects:0,p4_regions:geometry?.boxes?.length??0,p4_titles:geometry?.titles?.length??0,layout_capture_status:layout?'captured':'unavailable',capture_status:'screenshot-captured',fetch_attempts:telemetry.fetches,fetch_rejections:telemetry.rejections,xhr_attempts:telemetry.xhrs,synthetic_favicons:metrics.synthetic_favicons,screenshot_saved:true,screenshot_sha256,screenshot_width:screenshotSize.width,screenshot_height:screenshotSize.height,screenshot_variant:captureVariant,screenshot_truncated:region?.truncated===true&&captureVariant==='full-page-bounded',render_fidelity:scriptsDisabled?'static-html-only':assessment.render_fidelity,application_fetch_error_visible:page.application_fetch_error_visible===true,note:scriptsDisabled?'JS blocked by script-src none CSP: HTML-only visual snapshot. No original app functionality, live API data, or parity validated.':'PNG/DOM capture is separate from application render success; failures indicate incomplete data loading. No clicks or complete reconstruction.'};
  return {report,inspection};
 }finally{
  if(cdp){try{await cdp.send('Browser.close',{},undefined,1500);}catch{}cdp.close();}
  if(child && child.exitCode===null){try{child.kill();}catch{}}
  if(child && child.exitCode===null)await Promise.race([new Promise(ok=>child.once('exit',ok)),wait(1200)]);
  await rm(profile,{recursive:true,force:true,maxRetries:4,retryDelay:150}).catch(()=>{});
 }
}
