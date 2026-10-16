import {randomUUID, createHash} from 'node:crypto';
import {mkdir, readFile, readdir, rename, writeFile, open, stat, unlink, cp} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join, resolve, relative, sep, dirname, isAbsolute} from 'node:path';
import {spawn} from 'node:child_process';
import {validateCapture} from '../scripts/check-capture.mjs';
import {buildInspection} from './inspection.mjs';

export const STUDIO_RELEASE = 'rea-agents@6.5.0';
export const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const iso = () => new Date().toISOString();
const allowedFields = new Set(['target_url']);
export function validateTarget(input, fixturePort=4317) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k=>!allowedFields.has(k))) throw Error('Only target_url is accepted');
  if (typeof input.target_url !== 'string') throw Error('target_url must be a string');
  const required = `http://127.0.0.1:${fixturePort}/`;
  if (input.target_url !== required) throw Error(`P1 safety boundary: only ${required} is authorized`);
  return required;
}
export function createScenario(browserPath,targetUrl) {
  if(typeof browserPath!=='string' || !browserPath.trim()) throw Error('Browser executable must be configured');
  return {
    browser:{mode:'launch',executable_path:resolve(browserPath)},
    start_url:{url:targetUrl},
    actions:[
      {step_id:'initial-ready',action:'wait_for',locator:{kind:'css',selector:'#results[data-state="ready"]'},state:'visible',timeout_ms:10000},
      {step_id:'sort',action:'click',locator:{kind:'css',selector:'#sort'},timeout_ms:10000},
      {step_id:'toggle-info',action:'click',locator:{kind:'css',selector:'#toggle-notes'},timeout_ms:10000},
      {step_id:'help',action:'click',locator:{kind:'css',selector:'#view-info'},timeout_ms:10000},
      {step_id:'back',action:'click',locator:{kind:'css',selector:'#back'},timeout_ms:10000},
      {step_id:'final-ready',action:'wait_for',locator:{kind:'css',selector:'#results[data-state="ready"]'},state:'visible',timeout_ms:10000},
    ],
    capture:{after_each_step:['dom','accessibility','url'],at_end:['dom','accessibility','url','screenshot'],events:['network','console','page-errors']}
  };
}
// Keep Windows run data away from OneDrive, which can lock existing files during
// metadata.json replacement. Existing historical runs are copied, never moved.
export function defaultRunStorageDir({platform=process.platform,env=process.env,cwd=process.cwd()}={}){
  if(env.WEB_REA_DATA_DIR?.trim())return resolve(env.WEB_REA_DATA_DIR);
  if(platform==='win32'){
    const local=env.LOCALAPPDATA||(env.USERPROFILE?join(env.USERPROFILE,'AppData','Local'):null);
    if(!local)throw Error('LOCALAPPDATA is required for safe local Studio storage');
    return join(local,'WebREAStudio','runs');
  }
  return join(cwd,'results','studio','runs');
}

const METADATA_VERSION=/^metadata\.v([0-9]{6})\.json$/;
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
async function writeJsonAtomic(path,obj,move=rename){
  const temp=`${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp,JSON.stringify(obj,null,2),{flag:'wx',mode:0o600});
    // Retry only transient filesystem locking; never remove the destination.
    for(let attempt=0;;attempt++){
      try{await move(temp,path);break;}
      catch(e){if(!['EPERM','EACCES','EBUSY'].includes(e.code)||attempt>=2)throw e;await sleep([100,300][attempt]);}
    }
  }catch(e){await unlink(temp).catch(()=>{});throw e;}
}

// One-time migration from the old project-local storage; keep the source intact.
// A staged copy avoids showing partially imported runs if OneDrive is busy.
export async function importLegacyRuns({from=join(process.cwd(),'results','studio','runs'),to=defaultRunStorageDir()}={}){
  if(resolve(from)===resolve(to))return {imported:0,skipped:0};
  let entries;try{entries=await readdir(from,{withFileTypes:true});}catch(e){if(e.code==='ENOENT')return {imported:0,skipped:0};throw e;}
  await mkdir(to,{recursive:true});
  let imported=0,skipped=0;
  for(const entry of entries){
    if(!entry.isDirectory()||!ID_PATTERN.test(entry.name))continue;
    const source=join(from,entry.name),dest=join(to,entry.name),staging=join(to,`.import-${entry.name}-${randomUUID()}`);
    try {
      try{await stat(dest);skipped++;continue;}catch(e){if(e.code!=='ENOENT')throw e;}
      await cp(source,staging,{recursive:true,force:false,errorOnExist:true,filter:filename=>{
        const rel=relative(source,filename);
        return rel===''||(!rel.includes(sep)&&!rel.endsWith('.tmp'));
      }});
      await rename(staging,dest);
      imported++;
    }catch(e){
      if(e.code==='EEXIST'){skipped++;continue;}
      throw Object.assign(Error('Legacy runs could not be copied into local storage; originals were not modified'),{code:'LEGACY_IMPORT_FAILED',cause:e});
    }finally{await import('node:fs/promises').then(m=>m.rm(staging,{recursive:true,force:true})).catch(()=>{});}
  }
  return {imported,skipped};
}

export function makeStore(basePath,{move=rename}={}) {
  const root=resolve(basePath);
  const pathFor=id=>{if(!ID_PATTERN.test(id))throw Error('Invalid run ID');return join(root,id)};
  const metaPath=(id,version=0)=>join(pathFor(id),version===0?'metadata.json':`metadata.v${String(version).padStart(6,'0')}.json`);
  const pending=new Map();
  async function serialized(id,action){
    const prior=pending.get(id)||Promise.resolve();
    const job=prior.catch(()=>{}).then(action);
    pending.set(id,job);
    try{return await job;}finally{if(pending.get(id)===job)pending.delete(id);}
  }
  return {
    root,
    async init(){
      await mkdir(root,{recursive:true});
      for(const id of await readdir(root)){
        if(!ID_PATTERN.test(id))continue;
        let meta;try{meta=await this.get(id);}catch(e){if(e.code==='ENOENT')continue;throw e;}
        if(meta&&['queued','running'].includes(meta.status)){
          await this.update(id,{status:'interrupted',error:'Studio server stopped before completion'});
        }
      }
    },
    async create(input){
      const id=randomUUID(),created_at=iso();
      await mkdir(pathFor(id),{recursive:false,mode:0o700});
      const meta={id,target_url:input.target_url,mode:input.mode||'rea-browser',status:'queued',created_at,updated_at:created_at,engine:input.mode==='static-html'?'static-html-v1':STUDIO_RELEASE};
      await writeJsonAtomic(metaPath(id),meta,move);
      return meta;
    },
    async update(id,patch){
      if(!ID_PATTERN.test(id))throw Error('Invalid run ID');
      return serialized(id,async()=>{
        const old=await this.get(id);
        if(!old)throw Error('Missing run');
        const next=old._revision===undefined?1:old._revision+1;
        if(next>999999)throw Error('Run metadata revision limit exceeded');
        const meta={...old,...patch,updated_at:iso(),_revision:next};
        // New destination for each update; no rename over metadata.json.
        await writeJsonAtomic(metaPath(id,next),meta,move);
        return meta;
      });
    },
    async get(id){
      if(!ID_PATTERN.test(id))return null;
      let files;try{files=await readdir(pathFor(id));}catch(e){if(e.code==='ENOENT')return null;throw e;}
      const versions=files.map(n=>({name:n,match:METADATA_VERSION.exec(n)})).filter(x=>x.match)
        .sort((a,b)=>Number(b.match[1])-Number(a.match[1]));
      const selected=versions[0]?.name||(files.includes('metadata.json')?'metadata.json':null);
      if(!selected)return null;
      const meta=JSON.parse(await readFile(join(pathFor(id),selected),'utf8'));
      if(meta.id!==id)throw Error('Metadata ID mismatch');
      if(selected!=='metadata.json')meta._revision=Number(versions[0].match[1]);
      return meta;
    },
    async list(){const out=[];for(const id of await readdir(root)){if(!ID_PATTERN.test(id))continue;const m=await this.get(id);if(m)out.push(m);}return out.sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,50);},
    async saveInput(id,scenario){await writeJsonAtomic(join(pathFor(id),'scenario.json'),scenario,move);},
    async saveReport(id,report){await writeJsonAtomic(join(pathFor(id),'report.json'),report,move);},
    async saveInspection(id,inspection){await writeJsonAtomic(join(pathFor(id),'inspection.json'),inspection,move);},
    async saveManifest(id,manifest){await writeJsonAtomic(join(pathFor(id),'manifest.json'),manifest,move);},
    async getManifest(id){if(!ID_PATTERN.test(id))return null;try{return JSON.parse(await readFile(join(pathFor(id),'manifest.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}},
    async saveComparison(id,data){await writeJsonAtomic(join(pathFor(id),'comparison.json'),data,move);},
    async getComparison(id){if(!ID_PATTERN.test(id))return null;try{return JSON.parse(await readFile(join(pathFor(id),'comparison.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}},
    async getReconstructionScreenshot(id){if(!ID_PATTERN.test(id))return null;try{return await readFile(join(pathFor(id),'reconstruction.png'));}catch(e){if(e.code==='ENOENT')return null;throw e;}},
    async getInspection(id){if(!ID_PATTERN.test(id))return null;try{return JSON.parse(await readFile(join(pathFor(id),'inspection.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}},
    async getReport(id){if(!ID_PATTERN.test(id))return null;try{return JSON.parse(await readFile(join(pathFor(id),'report.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}},
    async getScreenshot(id){if(!ID_PATTERN.test(id))return null;try{return await readFile(join(pathFor(id),'screenshot.png'));}catch(e){if(e.code==='ENOENT')return null;throw e;}},
    pathFor,
  };
}
export function browserExecutable(){
  if(process.env.REA_BROWSER_EXECUTABLE?.trim())return process.env.REA_BROWSER_EXECUTABLE;
  if(process.platform==='win32'){
    const pf=process.env.ProgramFiles||'C:\\Program Files';
    return join(pf,'Google','Chrome','Application','chrome.exe');
  }
  return process.env.REA_BROWSER_EXECUTABLE||'';
}
// npm run studio supplies the absolute npm CLI path. Its sibling npx-cli.js
// can be invoked with Node directly, without cmd.exe /c quoting ambiguities on Windows.
// No shell interpretation and no untrusted CLI arguments are involved.
export function resolveNpxInvocation({env=process.env,nodeBinary=process.execPath,exists=existsSync}={}){
  const npmCli=env.npm_execpath;
  if(typeof npmCli!=='string'||!isAbsolute(npmCli)){
    throw Object.assign(Error('npm CLI path unavailable; start Studio with npm run studio'),{code:'NPX_CLI_UNAVAILABLE'});
  }
  const npxCli=join(dirname(npmCli),'npx-cli.js');
  if(!exists(npxCli)){
    throw Object.assign(Error('npx-cli.js not found next to npm-cli.js; verify Node.js/npm installation'),{code:'NPX_CLI_UNAVAILABLE'});
  }
  return {command:nodeBinary,args:[npxCli,'-y',STUDIO_RELEASE,'capture-browser-scenario','scenario.json','--json']};
}

export async function runActualCapture({scenario,dir,timeoutMs=180000}) {
  const output=join(dir,'rea-capture.json');
  const error=join(dir,'rea-stderr.log');
  const outHandle=await open(output,'w',0o600),errHandle=await open(error,'w',0o600);
  // Direct Node launch also preserves spaced paths inside LOCALAPPDATA on Windows.
  const {command,args}=resolveNpxInvocation();
  try {
    await new Promise((ok,bad)=>{
      const child=spawn(command,args,{cwd:dir,stdio:['ignore',outHandle.fd,errHandle.fd],windowsHide:true,env:{...process.env,npm_config_yes:'true'}});
      let finished=false;
      const timer=setTimeout(()=>{child.kill();if(!finished){finished=true;bad(Object.assign(Error('REA capture exceeded execution limit; inspect local log'),{code:'REA_TIMEOUT'}))}},timeoutMs);
      child.once('error',e=>{clearTimeout(timer);if(!finished){finished=true;bad(Object.assign(Error('REA subprocess could not start; inspect browser and npm installation'),{code:'REA_START_FAILED',cause:e}))}});
      child.once('close',(code,signal)=>{clearTimeout(timer);if(!finished){finished=true;code===0?ok({code}):bad(Object.assign(Error(`REA subprocess exited with status ${code}; inspect local stderr log`),{code:'REA_EXIT_NONZERO'}))}});
    });
  }finally{await Promise.all([outHandle.close(),errHandle.close()]);}
  const fileStat=await stat(output);
  if(fileStat.size>15*1024*1024)throw Object.assign(Error('REA evidence exceeds 15 MiB local safety limit'),{code:'EVIDENCE_SIZE_LIMIT'});
  let capture;try{capture=JSON.parse(await readFile(output,'utf8'));}catch{throw Object.assign(Error('REA output is not valid JSON; inspect local stderr log'),{code:'INVALID_REA_JSON'});}
  const report=validateCapture(capture,scenario);
  const resultPayload=capture.normalized_result;
  const artifact=resultPayload?.steps?.at(-1)?.artifacts?.screenshot;
  let screenshot_saved=false;
  if(artifact?.state==='captured'){
    const png=Buffer.from(artifact.value.data_base64||'','base64');
    const digest=createHash('sha256').update(png).digest('hex');
    const signature=Buffer.from('89504e470d0a1a0a','hex');
    if(png.length===artifact.value.bytes&&digest===artifact.value.sha256&&png.subarray(0,8).equals(signature)){
      await writeFile(join(dir,'screenshot.png'),png,{mode:0o600});screenshot_saved=true;
    }
  }
  return {report:{...report,screenshot_saved},inspection:buildInspection(capture,report)};
}
