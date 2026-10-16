import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeStore, defaultRunStorageDir,validateTarget,createScenario,browserExecutable,runActualCapture,ID_PATTERN} from './core.mjs';
import {parseApprovedUrls,runStaticAnalysis} from './static-analysis.mjs';
import {runDynamicAnalysis} from './dynamic-browser.mjs';
import {diagnoseRuns} from './diagnose.mjs';

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
export function createStudioServer({fixturePort=4317,studioPort=4320,storageDir=defaultRunStorageDir(),executor=runActualCapture,staticExecutor=runStaticAnalysis,dynamicExecutor=runDynamicAnalysis,approvedUrls=parseApprovedUrls(process.env.WEB_REA_ALLOWED_URLS),browserPath=browserExecutable()}={}){
 const allowed=new Set(approvedUrls.map(url=>parseApprovedUrls(url)[0]));
 const fixtureUrl=`http://127.0.0.1:${fixturePort}/`;
 function classifyTarget(input){
  if(input===null||typeof input!=='object'||Array.isArray(input)||typeof input.target_url!=='string'||Object.keys(input).some(k=>!['target_url','analysis_mode'].includes(k)))throw Error('Only target_url and analysis_mode are accepted');
  if(input.target_url===fixtureUrl){if(input.analysis_mode!==undefined&&input.analysis_mode!=='rea-browser')throw Error('Fixture only supports REA browser analysis');validateTarget({target_url:input.target_url},fixturePort);return {mode:'rea-browser',url:fixtureUrl};}
  if(allowed.has(input.target_url)){const requested=input.analysis_mode??'static-html';if(!['static-html','dynamic-passive'].includes(requested))throw Error('Invalid analysis mode for approved HTTPS target');return {mode:requested,url:input.target_url};}
  throw Error('Target not approved. Configure the exact authorized HTTPS URL before starting Studio.');
 }
 const store=makeStore(storageDir);
 let active=null;
 async function begin(input){
  const {url,mode}=classifyTarget(input);
  if(active) return {conflict:true};
  // Reservation happens before the first await; overlapping submissions cannot both start.
  active='reserved';
  try {
   const meta=await store.create({target_url:url,mode});
   active=meta.id;
   void (async()=>{
    try {
     await store.update(meta.id,{status:'running'});
     let execution;
     if(mode==='rea-browser'){
      const scenario=createScenario(browserPath,url);
      await store.saveInput(meta.id,scenario);
      execution=await executor({scenario,dir:store.pathFor(meta.id)});
     }else if(mode==='static-html'){
      await store.saveInput(meta.id,{kind:'static-html',target_url:url,method:'GET',resources:false});
      execution=await staticExecutor({target:url,dir:store.pathFor(meta.id)});
     }else if(mode==='dynamic-passive'){
      await store.saveInput(meta.id,{kind:'dynamic-passive',target_url:url,method:'GET',same_origin_only:true,actions:false});
      execution=await dynamicExecutor({target:url,browserPath,dir:store.pathFor(meta.id)});
     }else throw Error('Unrecognized analysis mode');
     // Both the actual REA executor and its deterministic test double use this result contract.
     const report=execution.report;
     if(!report||!['PASS','FAIL'].includes(report.verdict))throw Error('Invalid analyzer report');
     await store.saveReport(meta.id,report);
     if(execution.inspection)await store.saveInspection(meta.id,execution.inspection);
     await store.update(meta.id,{status:report.verdict==='PASS'?'completed':'failed',verdict:report.verdict,error:report.failures?.join(', ')||null});
    }catch(e){await store.update(meta.id,{status:'failed',error:safeDetail(e?.message),error_code:typeof e?.code==='string'&&/^[A-Z_]{3,40}$/.test(e.code)?e.code:'ANALYSIS_FAILED',diagnostic_path:mode==='rea-browser'?`runs/${meta.id}/rea-stderr.log`:null}).catch(()=>{});}
    finally{active=null;}
   })();
   return {meta};
  }catch(e){active=null;throw e;}
 }
 const respond=(res,code,data,type=jsonContent)=>{
  const body=Buffer.isBuffer(data)?data:type===jsonContent?JSON.stringify(data):data;
  res.writeHead(code,{...headers,'Content-Type':type,'Content-Length':Buffer.byteLength(body)});res.end(body);
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
   if(req.method==='GET'&&path==='/api/targets')return respond(res,200,{fixture:fixtureUrl,approved_urls:[...allowed],external_modes:['static-html','dynamic-passive']});
   if(req.method==='GET'&&path==='/api/runs')return respond(res,200,{runs:await store.list()});
   const match=/^\/api\/runs\/([a-f0-9-]+)(?:\/(report|inspection|screenshot|diagnosis))?$/.exec(path);
   if(req.method==='GET'&&match){
    const [,id,what]=match;
    if(!ID_PATTERN.test(id))return respond(res,400,{error:'invalid_id'});
    const meta=await store.get(id);
    if(!meta)return respond(res,404,{error:'not_found'});
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
    if(what==='screenshot'){
      const png=await store.getScreenshot(id);
      return png?respond(res,200,png,'image/png'):respond(res,404,{error:'screenshot_not_ready'});
    }
    return respond(res,200,meta);
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
