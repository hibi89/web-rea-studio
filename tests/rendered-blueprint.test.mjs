import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {LAYOUT_PROBE,sanitizeRenderedLayout} from '../studio/rendered-blueprint.mjs';

test('Chrome layout probe reads geometry without new requests or form values',()=>{
 const css={display:'block',visibility:'visible',fontSize:'16px',color:'rgb(0, 0, 0)',backgroundColor:'transparent',borderRadius:'4px'};
 const node={tagName:'MAIN',getAttribute:()=>null,getBoundingClientRect:()=>({x:5,y:6,width:320,height:180})};
 const context={document:{querySelectorAll:selector=>selector==='canvas'||selector==='svg'?[]:[node]},
  getComputedStyle:()=>css,innerWidth:1280,innerHeight:800};
 const snapshot=runInNewContext(LAYOUT_PROBE,context,{timeout:1000});
 const result=sanitizeRenderedLayout(snapshot);
 assert.equal(result.viewport.w,1280);
 assert.equal(result.components.length,1);
 assert.equal(result.components[0].rect.w,320);
 assert.equal(result.components[0].tag,'main');
 assert.equal(result.components[0].style.font_size,'16px');
 assert.doesNotMatch(LAYOUT_PROBE,/\bfetch\s*\(|\bXMLHttpRequest\b|\blocalStorage\b|\bclick\s*\(/);
});
test('untrusted layout values and forbidden tags are rejected before evidence saving',()=>{
 const raw={viewport:{w:1200,h:800},candidates:2,
  components:[
   {tag:'button',rect:{x:0,y:2,w:300000,h:32},style:{display:'block',color:'url(fake)',background:'rgb(2, 3, 4)',font_size:'18px',border_radius:'4px'}},
   {tag:'input',rect:{x:0,w:10},style:{display:'block'}}]};
 const out=sanitizeRenderedLayout(raw);
 assert.equal(out.components.length,1);
 assert.equal(out.components[0].rect.w,10000);
 assert.equal(out.components[0].style.color,'');
 assert.equal(out.components[0].style.background,'rgb(2, 3, 4)');
 assert.equal(out.components[0].style.font_size,'18px');
});
