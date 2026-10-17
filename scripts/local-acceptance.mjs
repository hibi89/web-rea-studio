// Owner-triggered acceptance: run "npm run accept:local" on Windows.
// Never contact the real source, install REA or touch existing run evidence.
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {join,relative} from 'node:path';
import {randomUUID} from 'node:crypto';
import {runOwnerOfflineAcceptance} from './local-acceptance-core.mjs';

function browserChoice(env){
 const override=env.REA_BROWSER_EXECUTABLE?.trim()||env.CHROME_BIN?.trim();
 if(override)return override;
 return [
  env.ProgramFiles&&join(env.ProgramFiles,'Google','Chrome','Application','chrome.exe'),
  env['ProgramFiles(x86)']&&join(env['ProgramFiles(x86)'],'Google','Chrome','Application','chrome.exe'),
  env.LOCALAPPDATA&&join(env.LOCALAPPDATA,'Google','Chrome','Application','chrome.exe')
 ].find(p=>p&&existsSync(p))||'';
}
function runStep(step){
 return new Promise(resolve=>{
  const args=step.script?[step.script]:['--test','scripts/*.test.mjs','tests/*.test.mjs'];
  const child=spawn(process.execPath,args,{
   cwd:process.cwd(),shell:false,windowsHide:true,stdio:['ignore','pipe','pipe'],
   env:{...process.env,
    CHROME_BIN:step.chromePath,REA_BROWSER_EXECUTABLE:step.chromePath,
    npm_config_offline:'true',npm_config_audit:'false'}
  });
  let stdout='',remaining=125000,settled=false,timedOut=false;
  const capture=data=>{
   if(remaining<=0)return;
   const part=String(data).slice(0,remaining);
   stdout+=part;remaining-=part.length;
  };
  child.stdout?.on('data',capture);
  // stderr is deliberately not persisted or copied into public receipts.
  child.stderr?.resume();
  const done=(exitCode)=>{
   if(settled)return;settled=true;clearTimeout(timer);
   resolve({exitCode,stdout,timedOut});
  };
  const timer=setTimeout(()=>{timedOut=true;child.kill();done(1);},step.timeout_ms);
  child.once('error',()=>done(1));
  child.once('close',code=>done(code??1));
 });
}
const chromePath=browserChoice(process.env);
const result=await runOwnerOfflineAcceptance({
 platform:process.platform,nodeVersion:process.version,
 chromePath,chromeExists:!!chromePath&&existsSync(chromePath),
 npmExecPath:process.env.npm_execpath||'',
 startedAt:new Date().toISOString(),
 executor:async step=>{
  console.log('CHECK '+step.id);
  const value=await runStep(step);
  console.log('RESULT '+step.id+' '+(value.exitCode===0&&!value.timedOut?'completed':'failed'));
  return value;
 }
});
const folder=join(process.cwd(),'results','acceptance');
await mkdir(folder,{recursive:true,mode:0o700});
const safeDate=result.started_at.replace(/[:.]/g,'-')||'blocked';
const filename='acceptance-'+safeDate+'-'+randomUUID().slice(0,8)+'.json';
const full=join(folder,filename);
await writeFile(full,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
console.log('RECEIPT '+relative(process.cwd(),full).replaceAll('\\','/'));
console.log(JSON.stringify(result,null,2));
if(result.status!=='PASS')process.exitCode=1;
