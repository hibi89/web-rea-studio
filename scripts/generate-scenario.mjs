import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
const browser=process.env.REA_BROWSER_EXECUTABLE;
if(!browser||!resolve(browser)||!existsSync(browser)) {
  console.error('Set REA_BROWSER_EXECUTABLE to an existing absolute Chrome/Edge executable.');
  process.exit(2);
}
const port=Number(process.env.P0_PORT || 4317);
if(!Number.isInteger(port)||port<1||port>65535)process.exit(2);
const fixture=`http://127.0.0.1:${port}/`;
const scenario={
  browser:{ mode:'launch', executable_path: resolve(browser) },
  start_url:{url:fixture},
  actions:[
    {step_id:'initial-ready', action:'wait_for',locator:{kind:'css',selector:'#results[data-state="ready"]'},state:'visible',timeout_ms:10000},
    {step_id:'sort',action:'click',locator:{kind:'css',selector:'#sort'},timeout_ms:10000},
    {step_id:'toggle-info',action:'click',locator:{kind:'css',selector:'#toggle-notes'},timeout_ms:10000},
    {step_id:'help',action:'click',locator:{kind:'css',selector:'#view-info'},timeout_ms:10000},
    {step_id:'back',action:'click',locator:{kind:'css',selector:'#back'},timeout_ms:10000},
    {step_id:'final-ready',action:'wait_for',locator:{kind:'css',selector:'#results[data-state="ready"]'},state:'visible',timeout_ms:10000},
  ],
  capture:{after_each_step:['dom','accessibility','url'],at_end:['dom','accessibility','url'],events:['network','console','page-errors']}
};
await mkdir('results',{recursive:true});
await writeFile('results/browser-scenario.json',JSON.stringify(scenario,null,2));
console.log('Written: results/browser-scenario.json');
