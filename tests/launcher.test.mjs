import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {resolveNpxInvocation} from '../studio/core.mjs';

async function withTemp(action){
 const root=await mkdtemp(join(tmpdir(),'rea-launcher-'));
 try {return await action(root);}finally{await rm(root,{recursive:true,force:true});}
}

test('Windows-compatible REA command invokes Node npx-cli.js without cmd.exe',()=>withTemp(async root=>{
 const npmDir=join(root,'npm bin with spaces');await mkdir(npmDir);
 const npx=join(npmDir,'npx-cli.js');await writeFile(npx,'console.log(JSON.stringify(process.argv.slice(2)));');
 const launch=resolveNpxInvocation({env:{npm_execpath:join(npmDir,'npm-cli.js')}});
 assert.equal(launch.command,process.execPath);
 assert.equal(launch.args[0],npx);
 assert.deepEqual(launch.args.slice(1),['-y','rea-agents@6.5.0','capture-browser-scenario','scenario.json','--json']);
 assert.equal(launch.args.some(x=>x.includes('cmd.exe')||x.includes('/c')||x.includes('\\"')),false);
 const output=spawnSync(launch.command,launch.args,{cwd:root,encoding:'utf8',windowsHide:true,shell:false});
 assert.equal(output.status,0,output.stderr);
 assert.deepEqual(JSON.parse(output.stdout),launch.args.slice(1));
}));

test('missing npm CLI errors before executing shell commands',()=>{
 assert.throws(()=>resolveNpxInvocation({env:{}}),{code:'NPX_CLI_UNAVAILABLE'});
 assert.throws(()=>resolveNpxInvocation({env:{npm_execpath:'/not-present/npm-cli.js'}}),{code:'NPX_CLI_UNAVAILABLE'});
});
