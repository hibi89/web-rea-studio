import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMvpArtifacts,normalizeMvpInput,buildSiteBlueprint,mvpDocumentCsp} from '../studio/mvp-builder.mjs';

export const geometry={source:'p4-geometry',viewport:{width:1440,height:900},document:{width:1440,height:900},background:'#e6e9ee',
 boxes:[{x:0,y:0,w:1440,h:900,depth:0,background:'#e6e9ee',radius:'0px'},{x:30,y:30,w:370,h:200,depth:2,background:'#ffffff',radius:'12px'}],
 titles:[{x:48,y:70,w:320,h:42,text:'TEST DASHBOARD',color:'#1a2233',font_size:'30px',font_weight:'700'}]};
const payload={theme:'midnight',requirements:'Sales overview',user_schema:{columns:[{name:'Item',type:'text'},{name:'Value',type:'number'}]},sample_rows:[{Item:'Blue',Value:3},{Item:'Red',Value:14}]};

test('all three stand-alone HTML results are independent, distinct, and hash ready',()=>{
 const x=buildMvpArtifacts(geometry,payload);
 assert.deepEqual(Object.keys(x.outputs),['faithful','remix','schema']);
 for(const [mode,o] of Object.entries(x.outputs)){
  assert.match(o.html,/<!doctype html>/i);assert.ok(o.bytes>500);assert.equal(o.sha256.length,64);
  assert.doesNotMatch(o.html,/<iframe|<img|https?:\/\//i);
  assert.match(o.html,/Content-Security-Policy/);
 }
 assert.match(x.outputs.faithful.html,/TEST DASHBOARD/);
 assert.notEqual(x.outputs.faithful.sha256,x.outputs.remix.sha256);
 assert.match(x.outputs.remix.html,/#10192a/);
 assert.match(x.outputs.schema.html,/Sales overview/);
 assert.match(x.outputs.schema.html,/>Blue</);
 assert.match(x.outputs.schema.html,/<script>/);
 assert.match(mvpDocumentCsp('schema'),/script-src 'sha256-/);
 assert.match(mvpDocumentCsp('faithful'),/script-src 'none'/);
});

test('faithful and remix encode mobile-only proportional canvas fitting without hiding layout',()=>{
 const pages=buildMvpArtifacts(geometry,payload).outputs;
 for(const mode of ['faithful','remix']){
  const html=pages[mode].html;
  assert.match(html,/@media\(max-width:750px\)\{\.page\{zoom:min\(1,calc\(100vw \/ 1440px\)\)\}\}/);
  assert.doesNotMatch(html,/overflow-x:hidden/);
  assert.match(html,/original functions unverified/);
  assert.doesNotMatch(html,/<script>/);
 }
 assert.doesNotMatch(pages.schema.html,/\.page\{zoom:min/);
 const narrow={...geometry,document:{width:600,height:900}};
 assert.match(buildMvpArtifacts(narrow,payload).outputs.faithful.html,/100vw \/ 600px/);
});

test('schema and row edits change the stand-alone result',()=>{
 const original=buildMvpArtifacts(geometry,payload).outputs.schema.sha256;
 const changed=buildMvpArtifacts(geometry,{...payload,sample_rows:[{Item:'Blue',Value:300}]}).outputs.schema;
 assert.notEqual(changed.sha256,original);assert.match(changed.html,/>300</);
});

test('HTML/script injection, unexpected columns, and unbounded input rejected/escaped',()=>{
 assert.throws(()=>normalizeMvpInput({...payload,extra:42}),/INVALID_MVP_INPUT/);
 assert.throws(()=>normalizeMvpInput({...payload,user_schema:{columns:[{name:'x',type:'sql'}]}}),/INVALID_MVP_COLUMN/);
 assert.throws(()=>normalizeMvpInput({...payload,sample_rows:[{'not-a-column':'secret'}]}),/INVALID_MVP_ROW/);
 const body={...payload,sample_rows:[{Item:'</script><img src=x onerror=alert(1)>',Value:3}]};
 const output=buildMvpArtifacts(geometry,body).outputs.schema.html;
 assert.doesNotMatch(output,/<img src=x/);assert.match(output,/&lt;\/script&gt;/);
});

test('missing saved visual geometry is fail-closed',()=>{
 assert.throws(()=>buildSiteBlueprint({source:'other',boxes:[]}),/MVP_GEOMETRY_REQUIRED/);
 assert.throws(()=>buildSiteBlueprint({...geometry,boxes:[]}),/MVP_GEOMETRY_REQUIRED/);
});
