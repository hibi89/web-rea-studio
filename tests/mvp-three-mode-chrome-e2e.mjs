// GitHub runner acceptance: three real Chrome renders × two viewports, from a
// synthetic saved Studio run. The source URL is NEVER fetched or executed.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer as tcpServer} from 'node:net';
import {createStudioServer} from '../studio/server.mjs';
import {CdpClient,screenshotPngDimensions} from '../studio/dynamic-browser.mjs';

const browserPath=process.env.CHROME_BIN;
if(!browserPath)throw Error('MVP_REAL_CHROME_REQUIRED');
const target='https://owned-mvp-synthetic.example.org/';
const fakeOrigin='https://mvp-offline-render.example.org';
const geometry={source:'p4-geometry',viewport:{width:1440,height:900},
 document:{width:1440,height:900},background:'#f4f5f6',boxes:[
  {tag:'body',depth:0,x:0,y:0,w:1440,h:900,background:'#f4f5f6',border_color:'transparent',border_width:'0px',radius:'0px'},
  {tag:'main',depth:1,x:120,y:100,w:1150,h:600,background:'#ffffff',border_color:'#dedede',border_width:'1px',radius:'12px'}
 ],titles:[{tag:'h1',x:170,y:140,w:700,h:60,text:'Authorized synthetic dashboard',color:'#1a2434',font_size:'32px',font_weight:'700'}]};
const payload={theme:'copper',requirements:'Local synthetic data',user_schema:{columns:[
 {name:'City',type:'text'},{name:'Count',type:'number'}]},sample_rows:[
 {City:'Seoul',Count:8},{City:'Busan',Count:20},{City:'Daejeon',Count:12}]};
const sha=x=>createHash('sha256').update(x).digest('hex');
const sleep=n=>new Promise(r=>setTimeout(r,n));
async function freePort(){const s=tcpServer();await new Promise((ok,bad)=>s.once('error',bad).listen(0,'127.0.0.1',ok));
 const port=s.address().port;await new Promise(ok=>s.close(ok));return port;}
async function waitForRun(base,id){for(let i=0;i<140;i++){
 const r=await fetch(`${base}/api/runs/${id}`);assert.equal(r.status,200);
 const meta=await r.json();if(meta.status==='completed')return meta;
 if(meta.status==='failed'||meta.status==='interrupted')throw Error('MVP_SYNTHETIC_RUN_FAILED '+JSON.stringify(meta));
 await sleep(25);
}throw Error('MVP_RUN_TIMEOUT');}
async function connect(profile,child){for(let i=0;i<90;i++){
 if(child.exitCode!==null)throw Error('MVP_CHROME_EXITED');
 try{const [p,path]=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split(/\r?\n/);
  if(Number(p)>0&&/^\/devtools\/browser\/[\w-]+$/.test(path)){
   const ws=new WebSocket('ws://127.0.0.1:'+p+path);
   await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('MVP_WEBSOCKET_TIMEOUT')),8000);
    ws.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});
    ws.addEventListener('error',()=>{clearTimeout(timer);reject(Error('MVP_WEBSOCKET_ERROR'));},{once:true});});
   return new CdpClient(ws);
  }
 }catch(e){if(/MVP_WEBSOCKET/.test(e.message))throw e;}
 await sleep(110);
}throw Error('MVP_CHROME_START_TIMEOUT');}
async function eventually(read,verify,reason){for(let i=0;i<80;i++){
 try{const value=await read();if(verify(value))return value;}catch{}
 await sleep(80);
}throw Error(reason);}
const stateExpr=String.raw`(()=>{const body=document.body;
 const rows=[...document.querySelectorAll('#records tbody tr')];
 const visible=rows.filter(r=>!r.hidden).map(r=>r.cells[0]?.textContent||'');
 return {ready:document.readyState,viewport:innerWidth,bodyBg:getComputedStyle(body).backgroundColor,
  heading:document.querySelector('main h1')?.textContent||document.querySelector('.label')?.textContent||'',
  regions:document.querySelectorAll('.region').length,labels:document.querySelectorAll('.label').length,
  rows:rows.length,visible,count:document.getElementById('count')?.textContent||'',
  overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,
  pageZoom:document.querySelector('.page')?Number(getComputedStyle(document.querySelector('.page')).zoom):null,
  pageRect:(()=>{const r=document.querySelector('.page')?.getBoundingClientRect();return r?{left:r.left,width:r.width,height:r.height}:null})(),
  panelRect:(()=>{const r=document.querySelectorAll('.region')[1]?.getBoundingClientRect();return r?{left:r.left,width:r.width}:null})(),
  labelRect:(()=>{const r=document.querySelector('.label')?.getBoundingClientRect();return r?{left:r.left,width:r.width}:null})(),
  shellDisplay:document.querySelector('.shell')?getComputedStyle(document.querySelector('.shell')).display:null,
  hasExternalScripts:!!document.querySelector('script[src]')};})()`;
async function main(){
 const root=await mkdtemp(join(tmpdir(),'rea-mvp-real-chrome-'));
 const profile=join(root,'chrome');
 const port=await freePort(),fixturePort=await freePort();
 const studio=createStudioServer({studioPort:port,fixturePort,storageDir:join(root,'runs'),
  approvedUrls:[target],browserPath:'/unused/chrome',dynamicExecutor:async ({target:source,scriptsDisabled})=>{
   assert.equal(source,target);assert.equal(scriptsDisabled,true);main.captureCount++;
   return {report:{verdict:'PASS',failures:[],analysis_mode:'static-visual',screenshot_saved:false},
    inspection:{schema_version:2,mode:'static-visual',scope:'explicit-https-allowlist',
     page:{reconstruction_blueprint:geometry},steps:[],network:[]}};
  }});
 let child,cdp,session,serverStarted=false,requested=null;
 const errors=[],externalRequests=[];let successfulDocuments=0;
 try{
  await studio.init();await new Promise((resolve,reject)=>studio.server.once('error',reject).listen(port,'127.0.0.1',resolve));serverStarted=true;
  const base='http://127.0.0.1:'+port;
  let res=await fetch(base+'/api/runs',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},
   body:JSON.stringify({target_url:target,analysis_mode:'static-visual'})});
  assert.equal(res.status,202);const {id}=await res.json();await waitForRun(base,id);
  assert.equal(main.captureCount,1);
  res=await fetch(`${base}/api/runs/${id}/mvp-build`,{method:'POST',
   headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  assert.equal(res.status,201);const manifest=await res.json();
  assert.deepEqual(Object.keys(manifest.modes).sort(),['faithful','remix','schema']);
  const documents={};for(const mode of ['faithful','remix','schema']){
   const preview=await fetch(base+manifest.modes[mode].preview_url);
   const download=await fetch(base+manifest.modes[mode].download_url);
   assert.equal(preview.status,200);assert.equal(download.status,200);
   assert.match(download.headers.get('content-disposition'),/attachment/);
   const bytes=Buffer.from(await preview.arrayBuffer());
   assert.deepEqual(bytes,Buffer.from(await download.arrayBuffer()));
   assert.equal(sha(bytes),manifest.modes[mode].sha256);
   assert.equal(bytes.length,manifest.modes[mode].bytes);
   documents[mode]={bytes,csp:preview.headers.get('content-security-policy')};
   assert.match(documents[mode].csp,/connect-src 'none'/);
  }
  // Chrome cannot leave the synthetic fixture: resolver is disabled and every
  // request is paused. Only the exact in-memory generated HTML is fulfilled.
  child=spawn(browserPath,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
   '--disable-background-networking','--disable-extensions','--disable-component-update',
   '--disable-sync','--disable-quic','--no-proxy-server','--host-resolver-rules=MAP * ~NOTFOUND',
   '--remote-debugging-port=0','--remote-debugging-address=127.0.0.1',
   '--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});
  cdp=await connect(profile,child);
  const created=await cdp.send('Target.createTarget',{url:'about:blank'});
  session=(await cdp.send('Target.attachToTarget',{targetId:created.targetId,flatten:true})).sessionId;
  await cdp.send('Page.enable',{},session);await cdp.send('Runtime.enable',{},session);
  await cdp.send('Network.enable',{},session);
  await cdp.send('Network.setBypassServiceWorker',{bypass:true},session);
  cdp.on('Fetch.requestPaused',async(event,sid)=>{
   if(sid!==session)return;
   const allow=requested&&event.request.url===requested.url&&event.request.method==='GET';
   try{
    if(!allow){
     // No web requests are sent; even favicon and telemetry are blocked.
     externalRequests.push(event.request.url);
     await cdp.send('Fetch.failRequest',{requestId:event.requestId,errorReason:'BlockedByClient'},session);
     return;
    }
    successfulDocuments++;
    await cdp.send('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:200,
     responseHeaders:[{name:'Content-Type',value:'text/html; charset=utf-8'},
      {name:'Content-Security-Policy',value:requested.csp},
      {name:'Cache-Control',value:'no-store'}],body:requested.bytes.toString('base64')},session);
   }catch(e){errors.push(String(e));}
  });
  await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]},session);
  const evaluate=async expression=>{
   const result=await cdp.send('Runtime.evaluate',{expression,returnByValue:true},session,8000);
   if(result.exceptionDetails)throw Error('MVP_RUNTIME_EVAL_EXCEPTION '+JSON.stringify(result.exceptionDetails));
   return result.result?.value;
  };
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   await cdp.send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:false},session);
   for(const mode of ['faithful','remix','schema']){
    requested={...documents[mode],url:`${fakeOrigin}/${mode}/${viewport.width}`};
    const nav=await cdp.send('Page.navigate',{url:requested.url},session);
    assert.ok(!nav.errorText,JSON.stringify(nav));
    const state=await eventually(()=>evaluate(stateExpr),s=>s?.ready==='complete'&&s.viewport===viewport.width&&
     (mode==='schema'?s.rows===3&&s.count==='3':s.regions===2&&s.labels===1),
     'MVP_CHROME_RENDER_TIMEOUT '+mode+' '+viewport.width);
    assert.equal(state.hasExternalScripts,false);
    assert.match(state.bodyBg,/^rgb\(/);
    if(mode==='schema'){
     assert.equal(state.rows,3);assert.deepEqual(state.visible,['Seoul','Busan','Daejeon']);
     assert.equal(state.overflow,false,'Schema workspace must fit viewport; table may scroll locally');
     assert.equal(state.shellDisplay,viewport.width===390?'block':'grid');
     const search=await evaluate("(()=>{const x=document.querySelector('#query');x.value='seoul';x.dispatchEvent(new Event('input',{bubbles:true}));return {count:document.querySelector('#count').textContent,rows:[...document.querySelectorAll('#records tbody tr')].filter(r=>!r.hidden).map(r=>r.cells[0].textContent)}})()");
     assert.equal(search.count,'1');assert.deepEqual(search.rows,['Seoul']);
     const order=await evaluate("(()=>{const x=document.querySelector('#query');x.value='';x.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-sort=\"1\"]').click();return [...document.querySelectorAll('#records tbody tr')].map(r=>r.cells[0].textContent)})()");
     assert.deepEqual(order,['Busan','Daejeon','Seoul']);
     const sortRepeat=await evaluate("(()=>{document.querySelector('[data-sort=\"1\"]').click();return [...document.querySelectorAll('#records tbody tr')].map(r=>r.cells[0].textContent)})()");
     assert.deepEqual(sortRepeat,['Seoul','Daejeon','Busan']);
    }else{
     assert.match(state.heading,/Authorized synthetic dashboard/);
     // MODE1/2 retain desktop geometry; mobile scales the complete static
     // picture instead of hiding overflowing content or claiming native reflow.
     assert.equal(state.overflow,false,mode+' horizontal overflow at '+viewport.width+'px');
     if(viewport.width===1440){
      assert.equal(state.pageZoom,1,'Desktop scale must remain unchanged');
      assert.ok(Math.abs(state.pageRect.width-1440)<0.1,'Desktop page geometry changed');
      assert.ok(Math.abs(state.panelRect.left-120)<0.1,'Desktop panel x changed');
      assert.ok(Math.abs(state.panelRect.width-1150)<0.1,'Desktop panel width changed');
     }else{
      const ratio=viewport.width/1440;
      assert.ok(Math.abs(state.pageZoom-ratio)<0.002,'Mobile scaling was not applied');
      assert.ok(Math.abs(state.pageRect.width-viewport.width)<1,'Entire source canvas must fit');
      assert.ok(Math.abs(state.panelRect.left-120*ratio)<1,'Panel must be proportionally positioned');
      assert.ok(Math.abs(state.panelRect.width-1150*ratio)<1,'Panel must keep full proportional width');
      assert.ok(state.labelRect.left>=0&&state.labelRect.left+state.labelRect.width<=viewport.width+1,
       'Text geometry must remain within the scaled canvas');
     }
    }
    const shot=await cdp.send('Page.captureScreenshot',{
     format:'png',captureBeyondViewport:false,fromSurface:true},session,12000);
    const png=Buffer.from(shot.data,'base64');const size=screenshotPngDimensions(png);
    assert.deepEqual(size,viewport);assert.ok(png.length>1000,'No empty screenshot');
    console.log(JSON.stringify({mvp_chrome:'PASS',mode,viewport,
     screenshot_sha256:sha(png),screenshot_bytes:png.length,background:state.bodyBg,
     heading:state.heading,regions:state.regions,rows:state.rows,
     horizontal_overflow:state.overflow,page_zoom:state.pageZoom,
     page_width:state.pageRect?.width??null,download_byte_identity:true,
     search_sort_checked:mode==='schema',synthetic_only:true,source_parity:false}));
   }
  }
  assert.equal(successfulDocuments,6);
  assert.equal(main.captureCount,1,'no recapture permitted from GET, previews, or Chrome');
  assert.equal(errors.length,0,JSON.stringify(errors));
  assert.ok(externalRequests.every(url=>url===fakeOrigin+'/favicon.ico'),JSON.stringify(externalRequests));
  console.log(JSON.stringify({three_mode_two_view_chrome:'PASS',renders:6,approved_source_fetches:0,
   in_memory_documents:successfulDocuments,external_requests_fulfilled:0,
   schema_search_sort_two_viewports:true,download_sha256_verified:true,
   real_original_site_similarity_verified:false}));
 }finally{
  if(cdp){try{await cdp.send('Browser.close',{},undefined,1200);}catch{}cdp.close();}
  if(child){child.kill();}
  if(serverStarted)await new Promise(resolve=>studio.server.close(resolve));
  await rm(root,{recursive:true,force:true,maxRetries:3,retryDelay:150});
 }
}
main.captureCount=0;
await main();