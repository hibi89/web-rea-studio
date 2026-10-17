// P2 security lab: two synthetic HTTPS origins, served entirely through Chrome
// DevTools interception. No real DNS, external API, or production gateway changes.
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CdpClient} from './dynamic-browser.mjs';

export const SYNTHETIC_PAGE_ORIGIN='https://webrea-cors-fixture.example.org';
export const SYNTHETIC_API_ORIGIN='https://api.webrea-cors-fixture.example.org';
const PAGE=SYNTHETIC_PAGE_ORIGIN+'/';
const ENDPOINT=SYNTHETIC_API_ORIGIN+'/v1/report?view=summary';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export function classifySyntheticCorsRequest(request,{allowApi=false}={}){
 if(request?.method!=='GET')return null;
 let url;try{url=new URL(request.url);}catch{return null;}
 if(url.username||url.password||url.hash||url.protocol!=='https:')return null;
 if(url.href===PAGE&&request.resourceType==='Document')return 'document';
 if(allowApi===true&&url.href===ENDPOINT&&['Fetch','XHR'].includes(request.resourceType))return 'api';
 return null;
}
export function syntheticDocumentCsp({allowApi=false}={}){
 return "default-src 'none'; script-src 'unsafe-inline'; "+
  "connect-src 'self'"+(allowApi===true?' '+SYNTHETIC_API_ORIGIN:'')+
  "; style-src 'none'; img-src 'none'; font-src 'none'; "+
  "form-action 'none'; frame-src 'none'; object-src 'none'";
}
const documentHtml='<!doctype html><html><head><title>REA controlled cross-origin</title></head>'+
 '<body><p id="state">pending</p><script>'+
 'window.__localApiAttempts=0;'+
 '(async()=>{try{window.__localApiAttempts++;'+
 'const r=await fetch('+JSON.stringify(ENDPOINT)+',{method:"GET",credentials:"omit"});'+
 'if(!r.ok)throw Error("response-not-ok");'+
 'const data=await r.json();document.getElementById("state").textContent='+
 '"ready:"+String(data.total);'+
 '}catch{document.getElementById("state").textContent="failed";}})();'+
 '</script></body></html>';

async function connectChrome(profile,child){
 for(let i=0;i<90;i++){
  if(child.exitCode!==null)throw Error('CORS_CHROME_EXITED');
  try{
   const [port,path]=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split(/\r?\n/);
   if(Number(port)>0&&/^\/devtools\/browser\/[\w-]+$/.test(path)){
    const ws=new WebSocket('ws://127.0.0.1:'+port+path);
    await new Promise((resolve,reject)=>{
     const timer=setTimeout(()=>reject(Error('CORS_WS_TIMEOUT')),7000);
     ws.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});
     ws.addEventListener('error',()=>{clearTimeout(timer);reject(Error('CORS_WS_CONNECT_FAILED'));},{once:true});
    });
    return new CdpClient(ws);
   }
  }catch(e){if(['CORS_WS_TIMEOUT','CORS_WS_CONNECT_FAILED'].includes(e.message))throw e;}
  await wait(100);
 }
 throw Error('CORS_DEVTOOLS_START_TIMEOUT');
}

/** Only test-controlled names; cannot be pointed at a caller's URL. */
export async function runSyntheticCorsChrome({browserPath,allowApi=false,sendCors=false,launch=spawn}={}){
 if(typeof browserPath!=='string'||!browserPath.trim()||
    typeof allowApi!=='boolean'||typeof sendCors!=='boolean')
  throw Error('CORS_TEST_OPTIONS_INVALID');
 const profile=await mkdtemp(join(tmpdir(),'webrea-cors-fixture-'));
 let child,cdp,sid;
 let apiFulfilled=0,unexpectedBlocked=0,apiFailedByPolicy=0;
 const outstanding=new Set();
 try{
  child=launch(browserPath,['--headless=new','--disable-gpu','--no-first-run',
   '--no-default-browser-check','--disable-background-networking','--disable-extensions',
   '--disable-component-update','--disable-sync','--disable-quic','--no-proxy-server',
   '--host-resolver-rules=MAP * ~NOTFOUND','--remote-debugging-port=0',
   '--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,'about:blank'],
   {stdio:'ignore',windowsHide:true});
  cdp=await connectChrome(profile,child);
  const tab=await cdp.send('Target.createTarget',{url:'about:blank'});
  sid=(await cdp.send('Target.attachToTarget',{targetId:tab.targetId,flatten:true})).sessionId;
  await cdp.send('Page.enable',{},sid);
  await cdp.send('Runtime.enable',{},sid);
  await cdp.send('Network.enable',{},sid);
  await cdp.send('Network.setBypassServiceWorker',{bypass:true},sid);
  cdp.on('Fetch.requestPaused',(ev,session)=>{
   if(session!==sid)return;
   const work=(async()=>{
    const classification=classifySyntheticCorsRequest({
     url:ev.request?.url,method:ev.request?.method,resourceType:ev.resourceType
    },{allowApi});
    if(!classification){
     unexpectedBlocked++;
     if(ev.request?.url===ENDPOINT)apiFailedByPolicy++;
     await cdp.send('Fetch.failRequest',{requestId:ev.requestId,errorReason:'BlockedByClient'},sid);
     return;
    }
    const headers=[{name:'Cache-Control',value:'no-store'},
     {name:'Content-Type',value:classification==='document'?'text/html; charset=utf-8':'application/json'}];
    if(classification==='document')
     headers.push({name:'Content-Security-Policy',value:syntheticDocumentCsp({allowApi})});
    if(classification==='api'&&sendCors)
     headers.push({name:'Access-Control-Allow-Origin',value:SYNTHETIC_PAGE_ORIGIN});
    const body=classification==='document'?documentHtml:'{"total":31}';
    await cdp.send('Fetch.fulfillRequest',{requestId:ev.requestId,responseCode:200,
     responseHeaders:headers,body:Buffer.from(body).toString('base64')},sid);
    if(classification==='api')apiFulfilled++;
   })();
   outstanding.add(work);
   void work.finally(()=>outstanding.delete(work)).catch(()=>{});
  });
  await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]},sid);
  const nav=await cdp.send('Page.navigate',{url:PAGE},sid);
  if(nav.errorText)throw Error('CORS_FIXTURE_NAVIGATION_FAILED');
  let state=null,attempts=null;
  for(let i=0;i<130;i++){
   const result=await cdp.send('Runtime.evaluate',{expression:
    "(()=>({state:document.getElementById('state')?.textContent||null,attempts:window.__localApiAttempts??null}))()",
    returnByValue:true},sid);
   const v=result.result?.value;
   if(v&&(v.state==='failed'||v.state==='ready:31')){state=v.state;attempts=v.attempts;break;}
   await wait(65);
  }
  if(!state)throw Error('CORS_FIXTURE_TIMEOUT');
  await Promise.allSettled([...outstanding]);
  return {source:'isolated-two-origin-chrome-fixture',network_requests_to_real_hosts:0,
   actual_external_api_calls:0,synthetic_api_responses:apiFulfilled,
   unexpected_browser_requests_blocked:unexpectedBlocked,
   api_requests_blocked_by_policy:apiFailedByPolicy,
   csp_external_api_allowed:allowApi,cors_header_sent:sendCors,
   app_state:state,app_fetch_attempts:attempts};
 }finally{
  if(cdp){try{await cdp.send('Browser.close',{},undefined,1200);}catch{}cdp.close();}
  if(child&&child.exitCode===null){try{child.kill();}catch{}}
  if(child&&child.exitCode===null)
   await Promise.race([new Promise(ok=>child.once('exit',ok)),wait(800)]);
  await rm(profile,{recursive:true,force:true,maxRetries:4,retryDelay:125}).catch(()=>{});
 }
}
