import {createHash} from 'node:crypto';
import {mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {buildMvpArtifacts,mvpDocumentCsp} from './mvp-builder.mjs';

const idPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const fileNames={faithful:'faithful.html',remix:'remix.html',schema:'schema.html'};
const digest=x=>createHash('sha256').update(x).digest('hex');

export async function handleMvpApi({req,res,path,store,respond,studioPort,isBusy}){
 const match=/^\/api\/runs\/([a-f0-9-]+)\/(mvp-build|mvp(?:\/(faithful|remix|schema)(-download)?)?)$/.exec(path);
 if(!match)return false;
 const [,id,action,mode,download]=match;
 if(!idPattern.test(id))return respond(res,400,{error:'invalid_id'}),true;
 const meta=await store.get(id);
 if(!meta)return respond(res,404,{error:'not_found'}),true;
 const base=join(store.pathFor(id),'mvp');
 if(action==='mvp-build'){
  if(req.method!=='POST')return respond(res,405,{error:'method_not_allowed'}),true;
  if(req.headers.origin!==`http://127.0.0.1:${studioPort}`)return respond(res,403,{error:'origin_not_allowed'}),true;
  if(req.headers['content-type']!=='application/json')return respond(res,415,{error:'json_required'}),true;
  if(meta.mode!=='static-visual'||meta.status!=='completed')return respond(res,409,{error:'completed_static_visual_required'}),true;
  if(isBusy())return respond(res,409,{error:'local_analysis_busy'}),true;
  const [report,inspection]=await Promise.all([store.getReport(id),store.getInspection(id)]);
  if(report?.reconstruction_available!==true||inspection?.mode!=='static-visual'||inspection?.page?.reconstruction_blueprint?.source!=='p4-geometry')
   return respond(res,409,{error:'saved_geometry_unavailable'}),true;
  const parts=[];let bytes=0;
  for await(const chunk of req){bytes+=chunk.length;if(bytes>16384)return respond(res,413,{error:'mvp_request_too_large'}),true;parts.push(chunk);}
  let data;try{data=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{return respond(res,400,{error:'invalid_json'}),true;}
  let artifact;try{artifact=buildMvpArtifacts(inspection.page.reconstruction_blueprint,data);}catch(e){
   if(/^(INVALID_MVP_|DUPLICATE_MVP_|MVP_GEOMETRY_|MVP_VIEWPORT_|MVP_OUTPUT_)/.test(e.message))return respond(res,422,{error:e.message}),true;
   throw e;
  }
  try{await mkdir(base,{mode:0o700});}catch(e){if(e.code==='EEXIST')return respond(res,409,{error:'mvp_already_built'}),true;throw e;}
  try{
   const modes={};
   for(const [kind,{html,sha256,bytes:htmlBytes}] of Object.entries(artifact.outputs)){
    await writeFile(join(base,fileNames[kind]),html,{flag:'wx',mode:0o600});
    modes[kind]={sha256,bytes:htmlBytes,preview_url:`/api/runs/${id}/mvp/${kind}`,download_url:`/api/runs/${id}/mvp/${kind}-download`};
   }
   const manifest={version:1,run_id:id,scope:'saved-static-visual-offline-only',source_independent:true,source_site_refetched:false,
    evidence_status:artifact.blueprint.evidence_status,unknowns:artifact.unknowns,theme:artifact.theme,column_count:artifact.column_count,row_count:artifact.row_count,modes};
   await writeFile(join(base,'manifest.json'),JSON.stringify(manifest),{flag:'wx',mode:0o600});
   return respond(res,201,manifest),true;
  }catch(e){await rm(base,{recursive:true,force:true});throw e;}
 }
 if(req.method!=='GET')return respond(res,405,{error:'method_not_allowed'}),true;
 let manifest;
 try{manifest=JSON.parse(await readFile(join(base,'manifest.json'),'utf8'));}
 catch(e){if(e.code==='ENOENT')return respond(res,404,{error:'mvp_not_built'}),true;throw e;}
 if(manifest.run_id!==id||manifest.version!==1||!manifest.modes)return respond(res,409,{error:'mvp_manifest_mismatch'}),true;
 if(!mode)return respond(res,200,manifest),true;
 const entry=manifest.modes[mode];
 if(!entry||typeof entry.sha256!=='string')return respond(res,409,{error:'mvp_manifest_mismatch'}),true;
 let html;try{html=await readFile(join(base,fileNames[mode]));}catch(e){if(e.code==='ENOENT')return respond(res,409,{error:'mvp_html_missing'}),true;throw e;}
 if(digest(html)!==entry.sha256||html.byteLength!==entry.bytes)return respond(res,409,{error:'mvp_artifact_changed'}),true;
 const header={'Content-Security-Policy':mvpDocumentCsp(mode),'X-Frame-Options':'SAMEORIGIN',
  ...(download?{'Content-Disposition':`attachment; filename="rea-mvp-${mode}.html"`}:{})};
 return respond(res,200,html,'text/html; charset=utf-8',header),true;
}
