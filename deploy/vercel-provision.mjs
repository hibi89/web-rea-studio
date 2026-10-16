/** Idempotent first-time Vercel project + production deployment provisioning.
 * Triggered only from trusted default-branch GitHub Actions, using a GitHub Secret.
 * Never accepts a token or deployment target from an HTTP request/user prompt.
 */
import {readFile} from 'node:fs/promises';

const exitError=(kind)=>Object.assign(Error(kind),{code:kind});
const NAME=/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;
const REPO=/^[a-zA-Z0-9_.-]+$/;
const DIR=/^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*$/;

export function validateQueue(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||input.schema_version!==1||input.owner!=='hibi89'||input.team_id!=='team_oDTHTX6ht90nzgUWxnpzZxhU'||!Array.isArray(input.projects)||input.projects.length<1||input.projects.length>20)throw exitError('QUEUE_INVALID');
 const names=new Set();
 const projects=input.projects.map(p=>{
  if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!['project_name','repo','root_directory','branch'].includes(k)))throw exitError('QUEUE_ENTRY_INVALID');
  if(typeof p.project_name!=='string'||!NAME.test(p.project_name)||names.has(p.project_name))throw exitError('PROJECT_NAME_INVALID');
  if(typeof p.repo!=='string'||!p.repo.startsWith('hibi89/')||!REPO.test(p.repo.slice(7)))throw exitError('REPO_SCOPE_INVALID');
  if(typeof p.root_directory!=='string'||p.root_directory.length>100||!DIR.test(p.root_directory)||p.root_directory.split('/').some(s=>s==='..'||s==='.' ))throw exitError('ROOT_DIRECTORY_INVALID');
  if(typeof p.branch!=='string'||p.branch!=='main')throw exitError('BRANCH_SCOPE_INVALID');
  names.add(p.project_name);
  return Object.freeze({...p});
 });
 return Object.freeze({team_id:input.team_id,owner:input.owner,projects});
}

const urlFor=(endpoint,teamId)=>`https://api.vercel.com${endpoint}${endpoint.includes('?')?'&':'?'}teamId=${encodeURIComponent(teamId)}`;

export async function vercelCall(fetcher,token,teamId,endpoint,{method='GET',body}={}){
 const url=urlFor(endpoint,teamId);
 const result=await fetcher(url,{
  method,headers:{Authorization:`Bearer ${token}`,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000),redirect:'error'
 });
 // No response body is logged or thrown: a service might echo sensitive fields.
 if(result.status===404)return {status:404,body:null};
 if(result.status<200||result.status>=300)throw exitError(`VERCEL_HTTP_${result.status}_${method}`);
 const data=await result.json();
 return {status:result.status,body:data};
}

function matchesLink(link,project){
 if(!link || typeof link!=='object')return false;
 // Vercel often returns {type:'github', org:'hibi89', repo:'web-rea-studio'} or slug.
 const type=String(link.type||'');
 const owner=String(link.org||link.owner||'');
 const repo=String(link.repo||link.repoSlug||link.slug||'');
 return type==='github' && (repo===project.repo ||(owner==='hibi89'&&repo===project.repo.slice(7)));
}

export async function provision(queue,{token,fetcher=fetch,log=console.log}={}){
 if(!token || typeof token!=='string')throw exitError('VERCEL_TOKEN_MISSING');
 const q=validateQueue(queue),summary=[];
 for(const p of q.projects){
  const exists=await vercelCall(fetcher,token,q.team_id,`/v9/projects/${encodeURIComponent(p.project_name)}`);
  let id;
  if(exists.status===404){
   log(`Creating Vercel project ${p.project_name} from ${p.repo}`);
   const made=await vercelCall(fetcher,token,q.team_id,'/v11/projects',{
    method:'POST',body:{name:p.project_name,framework:null,rootDirectory:p.root_directory,gitRepository:{type:'github',repo:p.repo}}
   });
   id=made.body?.id;
   if(typeof id!=='string'||!id.startsWith('prj_'))throw exitError('CREATE_NO_PROJECT_ID');
   summary.push({name:p.project_name,created:true});
  }else{
   id=exists.body?.id;
   if(typeof id!=='string'||!id.startsWith('prj_'))throw exitError('LOOKUP_NO_PROJECT_ID');
   if(!matchesLink(exists.body?.link,p))throw exitError('EXISTING_PROJECT_MISMATCH');
   log(`Existing Vercel project ${p.project_name} already linked; verifying deployment`);
   summary.push({name:p.project_name,created:false});
  }
  const latest=await vercelCall(fetcher,token,q.team_id,`/v6/deployments?projectId=${encodeURIComponent(id)}&limit=1`);
  if(Array.isArray(latest.body?.deployments)&&latest.body.deployments.length){
   log(`Existing deployment found for ${p.project_name} (${String(latest.body.deployments[0].state||'unknown')})`);
   summary.at(-1).deployment='existing';continue;
  }
  const deployed=await vercelCall(fetcher,token,q.team_id,'/v13/deployments?skipAutoDetectionConfirmation=1',{
   method:'POST',body:{name:p.project_name,project:id,target:'production',gitSource:{type:'github',org:'hibi89',repo:p.repo.slice(7),ref:p.branch}}
  });
  if(typeof deployed.body?.uid!=='string')throw exitError('DEPLOYMENT_MISSING_ID');
  log(`Initial deployment queued for ${p.project_name}; URL: ${String(deployed.body?.url||'pending')}`);
  summary.at(-1).deployment='queued';
 }
 return summary;
}

if(process.argv[1] && import.meta.url===new URL(`file://${process.argv[1]}`).href){
 try{
  const input=JSON.parse(await readFile(new URL('vercel-queue.json',import.meta.url),'utf8'));
  if(!process.env.VERCEL_TOKEN){console.log('::warning::VERCEL_TOKEN secret not configured. No provisioning attempted.');process.exit(0);}
  const result=await provision(input,{token:process.env.VERCEL_TOKEN});
  console.log('Vercel provisioning summary: '+JSON.stringify(result));
 }catch(err){console.error(`::error::Vercel provisioning failed: ${err?.code||'INTERNAL_ERROR'}. See repository README for remediation.`);process.exitCode=1;}
}
