import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {P4_GEOMETRY_PROBE,sanitizeP4Geometry,generateP4Reconstruction} from '../studio/p4-reconstruction.mjs';
const base=()=>({
 source:'p4-geometry',viewport:{width:1440,height:900},document:{width:1440,height:900},
 body_color:'rgb(245, 248, 251)',boxes:[
 {tag:'main',depth:1,x:0,y:0,w:1440,h:900,
  background:'rgb(245, 248, 251)',border_color:'transparent',border_width:'0px',radius:'0px'},
 {tag:'section',depth:2,x:180,y:120,w:620,h:420,
  background:'rgb(255, 255, 255)',border_color:'transparent',border_width:'0px',radius:'0px'}
 ],titles:[]
});
const bar=(x,h)=>({x,y:510-h,w:26,h,background:'rgb(42, 106, 206)',radius:'0px'});
test('P4 measured compact chart bars become scriptless, style-only geometry',()=>{
 const g=base();g.primitives=[bar(205,78),bar(258,180),bar(311,135)];
 const parsed=sanitizeP4Geometry(g);
 assert.equal(parsed.primitives.length,3);
 assert.equal(parsed.boxes.length,2);
 const html=generateP4Reconstruction(g);
 assert.equal((html.match(/class="primitive"/g)||[]).length,3);
 assert.match(html,/left:258px;top:330px;width:26px;height:180px;background:rgb\(42, 106, 206\)/);
 assert.match(html,/script-src &#39;none&#39;/);
 assert.doesNotMatch(html,/<script\b|<iframe\b|<img\b|https?:\/\//i);
});
test('legacy static captures never change bytes or inject new CSS if no primitives',()=>{
 const legacy=base();
 const html=generateP4Reconstruction(legacy);
 const withEmpty=structuredClone(legacy);withEmpty.primitives=[];
 assert.equal(generateP4Reconstruction(withEmpty),html);
 assert.equal(Object.hasOwn(sanitizeP4Geometry(withEmpty),'primitives'),false);
 assert.ok(!html.includes('class="primitive"')&&!html.includes(',.primitive'));
});
test('oversized, invisible, malicious, offscreen and invented chart shapes fail closed',()=>{
 const g=base();
 g.primitives=[
  bar(205,78),{...bar(205,78),background:'url(https://evil.invalid/SUPERSECRET)'},
  {...bar(205,78),background:'rgb(1,2,3);position:fixed'},
  {...bar(205,78),w:500,h:400}, // not compact
  {...bar(205,78),h:2},
  {...bar(205,78),x:5000},
  {...bar(205,78),y:900},
  {...bar(205,78),x:NaN},
  {...bar(205,78),w:undefined},
  {...bar(205,78),extra:'SUPERSECRET'},
  {...bar(205,78),background:'transparent'}
 ];
 const clean=sanitizeP4Geometry(g);
 assert.equal(clean.primitives.length,1);
 const html=generateP4Reconstruction(g);
 assert.equal((html.match(/class="primitive"/g)||[]).length,1);
 assert.doesNotMatch(html,/evil\.invalid|SUPERSECRET|position:fixed;left:205/);
});
test('at most 48 unique bounded primitive evidence records are accepted',()=>{
 const g=base();
 g.primitives=Array.from({length:65},(_,i)=>bar(205+i*3,78));
 const clean=sanitizeP4Geometry(g);
 assert.equal(clean.primitives.length,48);
 assert.equal((generateP4Reconstruction(g).match(/class="primitive"/g)||[]).length,48);
});
test('passive DOM probe detects compact colored divs without reading text or browser state',()=>{
 const root={tagName:'BODY',parentElement:null,textContent:''};
 const main={tagName:'MAIN',parentElement:root,textContent:'',
  getBoundingClientRect:()=>({left:0,top:0,width:1440,height:900})};
 const section={tagName:'SECTION',parentElement:main,textContent:'',
  getBoundingClientRect:()=>({left:180,top:120,width:620,height:420})};
 const div={tagName:'DIV',parentElement:section,textContent:'Sensitive bar label ignored',
  getBoundingClientRect:()=>({left:205,top:310,width:26,height:200})};
 const styles=new Map([
  [root,{backgroundColor:'rgb(245, 248, 251)'}],
  [main,{backgroundColor:'rgb(245, 248, 251)'}],
  [section,{backgroundColor:'rgb(255, 255, 255)'}],
  [div,{backgroundColor:'rgb(42, 106, 206)'}]
 ]);
 const ctx={document:{body:root,documentElement:{scrollWidth:1440,scrollHeight:900},
  querySelectorAll:()=>[main,section,div]},getComputedStyle:n=>({
   display:'block',visibility:'visible',opacity:'1',backgroundColor:styles.get(n).backgroundColor,
   borderTopLeftRadius:'0px',borderTopWidth:'0px',borderTopColor:'transparent',boxShadow:'none'}),
  innerWidth:1440,innerHeight:900,scrollX:0,scrollY:0,parseFloat};
 const raw=runInNewContext(P4_GEOMETRY_PROBE,ctx,{timeout:1000});
 assert.equal(raw.primitives.length,1);
 assert.equal(raw.primitives[0].w,26);
 const safe=sanitizeP4Geometry(raw);
 assert.equal(safe.primitives.length,1);
 assert.doesNotMatch(JSON.stringify(safe),/Sensitive bar label/);
 assert.doesNotMatch(P4_GEOMETRY_PROBE,/\bfetch\s*\(|\bXMLHttpRequest\b|\bclick\s*\(|\.value\b|localStorage|sessionStorage|\.innerHTML\b/);
});
