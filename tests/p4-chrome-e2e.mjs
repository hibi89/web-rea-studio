// Real headless Chrome acceptance gate for P4. In-memory fixture only.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runDynamicAnalysis,screenshotPngDimensions} from '../studio/dynamic-browser.mjs';
import {generateP4Reconstruction} from '../studio/p4-reconstruction.mjs';
import {compareChromeScreenshots} from '../studio/p5-visual-diff.mjs';
import {compareP4Geometry} from '../studio/p5-geometry-diff.mjs';
import {buildEvidenceManifest} from '../studio/evidence-manifest.mjs';
const browserPath=process.env.CHROME_BIN;
if(!browserPath)throw Error('CHROME_BIN required: real-browser check cannot be skipped');
const target='https://p4-fixture.example.org/';
const fixture="<!doctype html><html lang=\"ko\"><head><meta charset=\"utf-8\"><title>P4 controlled layout</title><style>*{box-sizing:border-box}html,body{margin:0}body{font-family:Arial;background:rgb(244,245,253)}aside{position:absolute;left:0;top:0;width:198px;height:1550px;background:rgb(255,255,255)}main{position:absolute;left:198px;top:0;width:1030px;min-height:1550px;padding:28px;background:rgb(239,241,253)}header{height:85px;background:rgb(239,241,253)}h1{margin:0;color:rgb(31,32,58);font-size:30px}article{display:inline-block;vertical-align:top;width:435px;height:490px;margin:10px;background:rgb(255,255,255);border-radius:12px}section{margin-top:12px}</style><script>document.body.dataset.executed=\"YES\";document.title=\"JAVASCRIPT RAN\";</script></head><body><aside></aside><main><header><h1>대시보드</h1></header><section><article></article><article></article></section><section><article></article><article></article></section></main></body></html>";
// F1 acceptance: invisible credential values and offsite hrefs must never
// appear in stored control evidence. CSP ensures zero page-script execution.
const fixtureWithControls=fixture.replace('</main>',
 '<div style="padding:6px"><button type="button">Refresh Chart</button>'+
 '<input type="password" value="SUPER_PRIVATE_PASSWORD_1234">'+
 '<input type="text" value="HIDDEN_TYPED_DATA_1234">'+
 '<a href="https://offsite.example.net/private?api_key=SENSITIVE">External</a>'+
 '<a href="/reports?auth=SECRET">Reports</a>'+
 '<div role="tab" aria-expanded="false" style="height:25px;width:95px">Overview</div>'+
 '</div></main>');
const dir=await mkdtemp(join(tmpdir(),'webrea-p4-ci-'));
let relayCalls=0;
try{
 const {report,inspection}=await runDynamicAnalysis({
  target,browserPath,dir,scriptsDisabled:true,
  relay:async requestUrl=>{
   relayCalls++;
   assert.equal(requestUrl,target,'Unexpected outbound resource');
   return {status:200,contentType:'text/html; charset=utf-8',body:Buffer.from(fixtureWithControls,'utf8')};
  }
 });
 assert.equal(report.verdict,'PASS',JSON.stringify(report.failures));
 assert.equal(report.analysis_mode,'static-visual');
 assert.equal(report.scripts_executed,false);
 assert.equal(report.application_render_status,'not-executed');
 assert.equal(inspection.page.title,'P4 controlled layout');
 assert.equal(relayCalls,1);
 assert.ok(report.screenshot_saved);
 assert.ok(report.screenshot_width>=1400);
 assert.ok(report.screenshot_height>=1500,'Full-page capture should include lower cards');
 assert.ok(report.screenshot_height<=4000);
 assert.equal(report.screenshot_truncated,false);
 const png=await readFile(join(dir,'screenshot.png'));
 assert.deepEqual(screenshotPngDimensions(png),{width:report.screenshot_width,height:report.screenshot_height});
 const controls=inspection.page.interaction_inventory;
 assert.ok(controls?.source==='passive-controls','F1 must capture real Chrome DOM');
 assert.ok(controls.counts.buttons>=1);
 assert.ok(controls.counts.inputs>=2);
 assert.ok(controls.counts.links>=2);
 assert.ok(controls.counts.tabs>=1);
 assert.equal(controls.counts.offsite_links,1);
 assert.equal(controls.actions_executed,0);
 assert.equal(report.verified_control_effects,0);
 const serialized=JSON.stringify(controls);
 assert.doesNotMatch(serialized,/SUPER_PRIVATE_PASSWORD|HIDDEN_TYPED_DATA|SENSITIVE|offsite\.example/);
 assert.equal(inspection.exploration.dependencies.causal_links_verified,0);
 assert.equal(inspection.exploration.dependencies.interaction_execution,'not-performed');
 const exported=buildEvidenceManifest(inspection,report);
 assert.equal(exported.controls.total,controls.counts.total);
 assert.equal(exported.visual.regions,inspection.page.reconstruction_blueprint.boxes.length);
 assert.equal(exported.network.causal_links_verified,0);
 assert.equal(exported.generated_artifacts.screenshot,true);
 assert.doesNotMatch(JSON.stringify(exported),/SUPER_PRIVATE_PASSWORD|HIDDEN_TYPED_DATA|SENSITIVE|offsite\.example/);
 const geom=inspection.page.reconstruction_blueprint;
 assert.ok(geom,'Real browser P4 geometry must be captured');
 assert.ok(geom.boxes.length>=5,JSON.stringify(geom.boxes));
 assert.ok(geom.titles.some(t=>t.text==='대시보드'));
 const reconstructed=generateP4Reconstruction(geom);
 assert.match(reconstructed,/대시보드/);
 assert.match(reconstructed,/script-src &#39;none&#39;/);
 assert.doesNotMatch(reconstructed,/<script\b|<iframe\b|https?:\/\//);
 assert.ok(!reconstructed.includes('JAVASCRIPT RAN'));
 // End-to-end proof: the generated standalone HTML is also rendered by a
 // second real, isolated Chrome, not merely inspected as a string.
 const replayDir=await mkdtemp(join(tmpdir(),'webrea-p4-replay-ci-'));
 let replayRelayCalls=0;
 try{
  const replayTarget='https://p4-replay.example.org/';
  const replay=await runDynamicAnalysis({
   target:replayTarget,browserPath,dir:replayDir,scriptsDisabled:true,
   relay:async url=>{
    replayRelayCalls++;
    assert.equal(url,replayTarget);
    return {status:200,contentType:'text/html; charset=utf-8',body:Buffer.from(reconstructed,'utf8')};
   }
  });
  assert.equal(replay.report.verdict,'PASS',JSON.stringify(replay.report.failures));
  assert.equal(replay.report.scripts_executed,false);
  assert.equal(replayRelayCalls,1);
  assert.equal(replay.report.screenshot_width,report.screenshot_width);
  assert.ok(replay.report.screenshot_height>=1500);
  const replayPng=await readFile(join(replayDir,'screenshot.png'));
  assert.deepEqual(screenshotPngDimensions(replayPng),{
   width:replay.report.screenshot_width,height:replay.report.screenshot_height});
  assert.ok(replay.inspection.page.body_bytes>0);
  const compared=compareChromeScreenshots(png,replayPng);
  assert.equal(compared.status,'measured-not-certified');
  assert.ok(compared.sample_count>1000);
  assert.ok(Number.isFinite(compared.rgb_mae));
  assert.ok(compared.rgb_mae>=0&&compared.rgb_mae<=255);
  assert.ok(compared.pixel_match_pct>=0&&compared.pixel_match_pct<=100);
  assert.equal(compared.dimensions_equal,true);
  // Prevent silent regressions in our deterministic Chrome fixture. This gate
  // must never be represented as the similarity of an arbitrary remote site.
  assert.ok(compared.pixel_match_pct>=90,JSON.stringify(compared));
  assert.ok(compared.rgb_mae<=20,JSON.stringify(compared));
  const regionMetrics=compareP4Geometry(geom,replay.inspection.page.reconstruction_blueprint);
  assert.equal(regionMetrics.status,'measured-not-certified');
  assert.ok(regionMetrics.original_regions>=5);
  assert.ok(regionMetrics.region_match_pct>=70,JSON.stringify(regionMetrics));
  console.log(JSON.stringify({p5_chrome_geometry_comparison:regionMetrics}));
  console.log(JSON.stringify({p5_chrome_visual_comparison:compared}));
 }finally{await rm(replayDir,{recursive:true,force:true});}
 console.log(JSON.stringify({chrome_e2e:'PASS',screenshot_px:[report.screenshot_width,report.screenshot_height],
  geometry_regions:geom.boxes.length,titles:geom.titles.length,controls_discovered:controls.counts.total,external_network_requests:0,reconstructed_html_chrome_render:'PASS',
  independent_html_bytes:Buffer.byteLength(reconstructed)}));
}finally{await rm(dir,{recursive:true,force:true});}
