import {readFile} from 'node:fs/promises';
const path=process.argv[2];
if(!path){console.error('Usage: node scripts/check-capture.mjs <output-file>');process.exit(2);}
try{
 const raw=await readFile(path,'utf8'),data=JSON.parse(raw);
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Expected JSON object');
 if(data.isError===true||data.error||data.status==='error')throw Error('REA reported an error');
 console.log(JSON.stringify({json_valid:true,top_level_keys:Object.keys(data).slice(0,24),size_bytes:Buffer.byteLength(raw),capture_claim:'UNVERIFIED: browser action results must be reviewed.'},null,2));
}catch(e){console.error('Capture needs inspection: '+e.message);process.exitCode=1;}
