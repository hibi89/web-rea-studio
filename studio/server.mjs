import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeStore, validateTarget,createScenario,browserExecutable,runActualCapture,ID_PATTERN} from './core.mjs';

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
export function createStudioServer({fixturePort=4317,studioPort=4320,storageDir=join(process.cwd(),'results','studio','runs'),executor=runActualCapture,browserPath=browserExecutable()}={}){
 const store=makeStore(storageDir);
 let active=null;
 async function begin(input){
  const url=validateTarget(input,fixturePort);
  if(active) return {conflict:true};
  // Reservation happens before the first await; overlapping submissions cannot both start.
  active='reserved';
  try {
   const meta=await store.create({target_url:url});
   active=meta.id;
   void (async()=>{
    try {
     await store.update(meta.id,{status:'running'});
     const scenario=createScenario(browserPath,url);
     await store.saveInput(meta.id,scenario);
     const report=await executor({scenario,dir:store.pathFor(meta.id)});
     await store.saveReport(meta.id,report);
     await store.update(meta.id,{status:report.verdict==='PASS'?'completed':'failed',verdict:report.verdict,error:report.failures?.join(', ')||null});
    }catch(e){await store.update(meta.id,{status:'failed',error:safeDetail(e?.message)}).catch(()=>{});}
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
   if(u.search||u.hash)return respond(res,400,{error:'unexpected_query'});
   const path=u.pathname;
   if(req.method==='GET' && Object.hasOwn(CONTENT_TYPES,path)){
    const name=path==='/'?'index.html':path.slice(1);
    return respond(res,200,await readFile(join(PUBLIC,name)),CONTENT_TYPES[path]);
   }
   if(req.method==='GET'&&path==='/api/runs')return respond(res,200,{runs:await store.list()});
   const match=/^\/api\/runs\/([a-f0-9-]+)(?:\/(report|screenshot))?$/.exec(path);
   if(req.method==='GET'&&match){
    const [,id,what]=match;
    if(!ID_PATTERN.test(id))return respond(res,400,{error:'invalid_id'});
    const meta=await store.get(id);
    if(!meta)return respond(res,404,{error:'not_found'});
    if(what==='report'){
      const report=await store.getReport(id);
      return report?respond(res,200,report):respond(res,404,{error:'report_not_ready'});
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
    try{validateTarget(input,fixturePort);}catch(e){return respond(res,400,{error:safeDetail(e.message)});}
    const result=await begin(input);
    return result.conflict?respond(res,409,{error:'analysis_already_running'}):respond(res,202,result.meta);
   }
   return respond(res,404,{error:'not_found'});
  }catch(e){return respond(res,500,{error:'internal_error'});}
 });
 return {server,store,init:()=>store.init(),get active(){return active;}};
}
