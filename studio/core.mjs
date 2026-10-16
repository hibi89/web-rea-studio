import {randomUUID, createHash} from 'node:crypto';
import {mkdir, readFile, readdir, rename, writeFile, open, stat} from 'node:fs/promises';
import {join, resolve} from 'node:path';
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
async function writeJsonAtomic(path,obj){
  const temp=`${path}.${randomUUID()}.tmp`;
  try { await writeFile(temp,JSON.stringify(obj,null,2),{flag:'wx',mode:0o600}); await rename(temp,path);}
  catch(e){try{await import('node:fs/promises').then(m=>m.unlink(temp))}catch{} throw e;}
}
export function makeStore(basePath) {
  const root=resolve(basePath);
  const pathFor=id=>{if(!ID_PATTERN.test(id))throw Error('Invalid run ID');return join(root,id)};
  const metaPath=id=>join(pathFor(id),'metadata.json');
  return {
    root,
    async init(){await mkdir(root,{recursive:true});for(const id of await readdir(root)){if(!ID_PATTERN.test(id))continue;let m;try{m=JSON.parse(await readFile(metaPath(id),'utf8'));}catch{continue;}if(['queued','running'].includes(m.status)){m.status='interrupted';m.updated_at=iso();m.error='Studio server stopped before completion';await writeJsonAtomic(metaPath(id),m);}}},
    async create(input){const id=randomUUID(),created_at=iso();await mkdir(pathFor(id),{recursive:false,mode:0o700});const meta={id, target_url:input.target_url,status:'queued',created_at,updated_at:created_at,engine:STUDIO_RELEASE};await writeJsonAtomic(metaPath(id),meta);return meta;},
    async update(id,patch){const old=await this.get(id);if(!old)throw Error('Missing run');const meta={...old,...patch,updated_at:iso()};await writeJsonAtomic(metaPath(id),meta);return meta;},
    async get(id){if(!ID_PATTERN.test(id))return null;try{return JSON.parse(await readFile(metaPath(id),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}},
    async list(){const out=[];for(const id of await readdir(root)){if(!ID_PATTERN.test(id))continue;const m=await this.get(id);if(m)out.push(m);}return out.sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,50);},
    async saveInput(id,scenario){await writeJsonAtomic(join(pathFor(id),'scenario.json'),scenario);},
    async saveReport(id,report){await writeJsonAtomic(join(pathFor(id),'report.json'),report);},
    async saveInspection(id,inspection){await writeJsonAtomic(join(pathFor(id),'inspection.json'),inspection);},
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
export async function runActualCapture({scenario,dir,timeoutMs=180000}) {
  const scenarioFile=join(dir,'scenario.json');
  const output=join(dir,'rea-capture.json');
  const error=join(dir,'rea-stderr.log');
  const outHandle=await open(output,'w',0o600),errHandle=await open(error,'w',0o600);
  const win=process.platform==='win32';
  const command=win?(process.env.ComSpec||'cmd.exe'):'npx';
  const args=win?['/d','/s','/c','"npx.cmd -y rea-agents@6.5.0 capture-browser-scenario scenario.json --json"']:['-y','rea-agents@6.5.0','capture-browser-scenario','scenario.json','--json'];
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
