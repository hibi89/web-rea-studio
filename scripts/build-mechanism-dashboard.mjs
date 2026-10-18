import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseDataset,suggestMapping} from '../studio/mechanism-data.mjs';
import {generateMechanismDashboard,buildMechanismSpec} from '../studio/mechanism-dashboard.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);if(args.length%2)throw Error('CLI arguments require values');
const opts={};
for(let i=0;i<args.length;i+=2){
 if(!['--input','--out','--dimension','--group','--measure'].includes(args[i])||opts[args[i]]!==undefined)throw Error('INVALID_OPTION');
 opts[args[i]]=args[i+1];
}
const input=resolve(opts['--input']||resolve(root,'fixtures/mechanisms/sales.csv'));
const out=resolve(opts['--out']||resolve(root,'output/dashboard.html'));
const format=extname(input).toLowerCase().slice(1);
const rows=parseDataset(await readFile(input,'utf8'),format);
const keys=['--dimension','--group','--measure'];
const explicit=keys.every(k=>opts[k]!==undefined);
if(!explicit&&keys.some(k=>opts[k]!==undefined))throw Error('ALL_THREE_MAPPING_OPTIONS_REQUIRED');
if(!explicit&&![resolve(root,'fixtures/mechanisms/sales.csv'),resolve(root,'fixtures/mechanisms/sales.json')].includes(input))throw Error('EXPLICIT_MAPPING_REQUIRED_FOR_USER_DATA');
const mapping=explicit?{dimension:opts['--dimension'],group:opts['--group'],measure:opts['--measure']}:suggestMapping(rows);
const html=generateMechanismDashboard(rows,mapping);
const spec=buildMechanismSpec(rows,mapping);
await mkdir(dirname(out),{recursive:true});
await writeFile(out,html,'utf8');
const specPath=resolve(dirname(out),'mechanism-spec.json');
await writeFile(specPath,JSON.stringify(spec,null,2)+'\n','utf8');
console.log(JSON.stringify({status:'generated',html:out,spec:specPath,rows:rows.length,mapping,bytes:Buffer.byteLength(html)}));
