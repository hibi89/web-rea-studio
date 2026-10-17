import {createFixtureServer} from '../fixtures/site/server.mjs';
import {createStudioServer} from './server.mjs';
import {existsSync} from 'node:fs';
import {browserExecutable,defaultRunStorageDir,importLegacyRuns} from './core.mjs';
import {join} from 'node:path';
import {loadApprovedTargets} from './approved-targets.mjs';
const fixturePort=Number(process.env.P0_PORT||4317),studioPort=Number(process.env.STUDIO_PORT||4320);
if(![fixturePort,studioPort].every(p=>Number.isInteger(p)&&p>0&&p<=65535)||fixturePort===studioPort)throw Error('Invalid ports');
const path=browserExecutable();
if(!path||!existsSync(path))console.warn('REA_BROWSER_EXECUTABLE not found; configure before running analyses');
const dataDir=defaultRunStorageDir();
const legacyDir=join(process.cwd(),'results','studio','runs');
let migration={imported:0,skipped:0};
// The owner-PC synthetic smoke must never inspect or import private legacy
// runs. This bypass requires an explicit, isolated temp storage override;
// normal Studio startup still performs the same non-destructive migration.
const isolatedSmoke=process.env.WEB_REA_ACCEPTANCE_SMOKE==='1'&&
 typeof process.env.WEB_REA_DATA_DIR==='string'&&
 process.env.WEB_REA_DATA_DIR.trim().length>0;
if(!isolatedSmoke){
 try{migration=await importLegacyRuns({from:legacyDir,to:dataDir});}
 catch(e){console.warn('Existing history could not be copied. Originals remain intact. Check OneDrive permissions; new runs use local storage.');}
}
const approvedUrls=await loadApprovedTargets();
const fixture=createFixtureServer(),studio=createStudioServer({fixturePort,studioPort,browserPath:path,storageDir:dataDir,approvedUrls});
await studio.init();
await new Promise((resolve,reject)=>fixture.once('error',reject).listen(fixturePort,'127.0.0.1',resolve));
try{await new Promise((resolve,reject)=>studio.server.once('error',reject).listen(studioPort,'127.0.0.1',resolve));}
catch(e){fixture.close();throw e;}
console.log(`Web REA Studio P2: http://127.0.0.1:${studioPort}`);
console.log('Local run storage outside OneDrive: '+dataDir);
console.log(`Legacy history imported: ${migration.imported}; already present: ${migration.skipped}`);
console.log(`Controlled fixture: http://127.0.0.1:${fixturePort}/`);
console.log(`External static HTML: ${approvedUrls.length} explicitly approved exact HTTPS URL(s). No external browser navigation.`);
for(const sig of ['SIGINT','SIGTERM'])process.once(sig,()=>{studio.server.close();fixture.close();});
