import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runDynamicAnalysis} from '../studio/dynamic-browser.mjs';
import {buildMvpArtifacts} from '../studio/mvp-builder.mjs';
import {compareChromeScreenshots} from '../studio/p5-visual-diff.mjs';
const TARGET='https://www.w3.org/',OFFLINE='https://rea-public-offline.example.org/';
if(process.env.REA_PUBLIC_CAPTURE_CONSENT!=='2026-10-18-w3c-once'||!process.env.CHROME_BIN)throw Error('CONSENT_OR_CHROME_MISSING');
const base=join(tmpdir(),'rea-public-smoke'),src=join(base,'source'),rep=join(base,'replica');
await mkdir(src,{recursive:true});await mkdir(rep,{recursive:true});
let result={target:TARGET,status:'NOT_STARTED',live_js_executed:false,private_credentials_used:false};
try{
 const a=await runDynamicAnalysis({target:TARGET,browserPath:process.env.CHROME_BIN,dir:src,scriptsDisabled:true});
 result={...result,status:'CAPTURED',source_verdict:a.report.verdict,source_failures:a.report.failures,source_dimensions:[a.report.screenshot_width,a.report.screenshot_height],source_truncated:a.report.screenshot_truncated,blocked_resources:a.report.resource_blocked};
 const g=a.inspection.page?.reconstruction_blueprint;
 if(g?.source!=='p4-geometry')throw Error('SOURCE_GEOMETRY_MISSING');
 const html=buildMvpArtifacts(g,{theme:'paper'}).outputs.faithful.html;
 await writeFile(join(base,'faithful.html'),html);
 const b=await runDynamicAnalysis({target:OFFLINE,browserPath:process.env.CHROME_BIN,dir:rep,scriptsDisabled:true,offlineViewport:{width:1440,height:900},relay:async url=>{if(url!==OFFLINE)throw Error('EXTERNAL_REPLICA_REQUEST');return {status:200,contentType:'text/html',body:Buffer.from(html)};}});
 if(b.report.verdict!=='PASS')throw Error('OFFLINE_RENDER_FAILED');
 const metrics=compareChromeScreenshots(await readFile(join(src,'screenshot.png')),await readFile(join(rep,'screenshot.png')));
 result={...result,status:'MEASURED_STATIC_ONLY',geometry:{boxes:g.boxes.length,titles:g.titles?.length||0},metrics:{pixel_match_pct:metrics.pixel_match_pct,rgb_mae:metrics.rgb_mae,coverage_pct:metrics.coverage_pct,dimensions_equal:metrics.dimensions_equal,samples:metrics.sample_count},replica_external_requests:0,limitations:['JS disabled on original; incomplete rendering possible','Visual match is not functional parity','W3C public benchmark is not the original dashboard']};
}catch(e){result={...result,status:'BLOCKED',reason:String(e.code||e.message).slice(0,110)};process.exitCode=1;}
finally{await writeFile(join(base,'report.json'),JSON.stringify(result,null,2));console.log('REA_PUBLIC_RESULT '+JSON.stringify(result));}
