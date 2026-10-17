import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {P4_GEOMETRY_PROBE,sanitizeP4Geometry,generateP4Reconstruction}
 from '../studio/p4-reconstruction.mjs';

const baseline=()=>({source:'p4-geometry',viewport:{width:1440,height:900},
 document:{width:1440,height:900},body_color:'rgb(244, 247, 251)',
 boxes:[{tag:'article',depth:3,x:80,y:90,w:440,h:360,
  background:'rgb(255, 255, 255)',border_width:'0px',border_color:'transparent',
  radius:'8px'}],titles:[]});
test('P4 isolated safe card shadow is sanitized and rendered without executable code',()=>{
 const data=baseline();
 data.boxes[0].box_shadow='rgba(18, 32, 65, 0.42) 0px 16px 34px 0px';
 const out=sanitizeP4Geometry(data);
 assert.equal(out.boxes[0].box_shadow,data.boxes[0].box_shadow);
 const html=generateP4Reconstruction(out);
 assert.match(html,/box-shadow:rgba\(18, 32, 65, 0\.42\) 0px 16px 34px 0px;/);
 assert.match(html,/script-src &#39;none&#39;/);
 assert.doesNotMatch(html,/<script\b|<iframe\b|https?:\/\//);
});
test('legacy saved geometry is byte compatible without optional shadow property',()=>{
 const data=baseline();
 const legacy=generateP4Reconstruction(data);
 data.boxes[0].box_shadow='none';
 assert.equal(generateP4Reconstruction(data),legacy);
 const clean=sanitizeP4Geometry(data);
 assert.equal(Object.hasOwn(clean.boxes[0],'box_shadow'),false);
});
test('unsafe, huge, multiple, and inset CSS shadows fail closed without copying payload',()=>{
 for(const payload of [
  '0px 0px 5px red, 0px 1px 1px blue',
  'inset rgba(0,0,0,0.5) 0px 2px 3px 0px',
  'var(--token)',
  'url(https://example.invalid/pixel?token=SENSITIVE) 1px 2px 3px 4px',
  'rgba(999, 2, 3, 0.5) 0px 2px 3px 0px',
  'rgba(0, 2, 3, 0.5) 0px 100px 3px 0px',
  'rgba(0, 2, 3, 0.5) 0px 2px 99px 0px',
  'rgba(0, 2, 3, 0.5) 0px 2px 3px 50px',
  'rgba(0, 2, 3, 0.5) 0px 2px 3px 0px;position:absolute'
 ]){
  const data=baseline();
  data.boxes[0].box_shadow=payload;
  const cleaned=sanitizeP4Geometry(data);
  assert.equal(Object.hasOwn(cleaned.boxes[0],'box_shadow'),false,payload);
  const html=generateP4Reconstruction(data);
  assert.ok(!html.includes(payload));
  assert.doesNotMatch(html,/example\.invalid|SENSITIVE/);
 }
});
test('static Chrome probe reads shadow-only divs but never form input values or storage',()=>{
 const body={tagName:'BODY',parentElement:null,textContent:''};
 const card={tagName:'DIV',parentElement:body,textContent:'',
  getBoundingClientRect:()=>({left:90,top:70,width:390,height:300})};
 const defaults={display:'block',visibility:'visible',opacity:'1',backgroundColor:'transparent',
  borderTopLeftRadius:'0px',borderTopWidth:'0px',borderTopColor:'transparent',boxShadow:'rgba(18, 32, 65, 0.42) 0px 16px 34px 0px'};
 const ctx={document:{body,documentElement:{scrollWidth:1440,scrollHeight:900},
  querySelectorAll:()=>[card]},getComputedStyle:()=>defaults,
  innerWidth:1440,innerHeight:900,scrollX:0,scrollY:0,parseFloat};
 const raw=runInNewContext(P4_GEOMETRY_PROBE,ctx,{timeout:1000});
 assert.equal(raw.boxes.length,1);
 assert.equal(raw.boxes[0].tag,'div');
 assert.equal(raw.boxes[0].box_shadow,defaults.boxShadow);
 assert.equal(sanitizeP4Geometry(raw).boxes[0].box_shadow,defaults.boxShadow);
 assert.doesNotMatch(P4_GEOMETRY_PROBE,/\bfetch\s*\(|\bXMLHttpRequest\b|\bclick\s*\(|\.value\b|localStorage|sessionStorage|\.innerHTML\b/);
});
