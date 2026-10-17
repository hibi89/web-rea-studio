import test from 'node:test';
import assert from 'node:assert/strict';
import {ANONYMOUS_LAYOUT_PROBE,sanitizeAnonymousLayoutProbe,
 assessAnonymousLayout} from '../studio/f3-q1-layout-proof.mjs';
const view={width:1440,height:900};
function raw(width=1440,columns=3){
 const x0=20,gap=12,gridWidth=1000,cell=(gridWidth-(columns-1)*gap)/columns;
 return {kind:'anonymous-offline-grid-only',viewport:width,
  document_scroll_width:width,document_client_width:width,
  grid_columns:Array.from({length:columns},()=>cell.toFixed(1)+'px').join(' '),
  grid:[20,126,gridWidth,370],zone_count:9,native_controls:0,
  zones:Array.from({length:9},(_,i)=>[x0+(i%columns)*(cell+gap),
   142+Math.floor(i/columns)*124,cell,112])};
}
test('fixed read-only probe cannot fetch/execute actions and sanitizer limits output',()=>{
 assert.match(ANONYMOUS_LAYOUT_PROBE,/getComputedStyle/);
 assert.doesNotMatch(ANONYMOUS_LAYOUT_PROBE,/fetch\s*\(|XMLHttpRequest|\.click\s*\(|localStorage|cookie/);
 const x=sanitizeAnonymousLayoutProbe(raw());
 assert.equal(x.computed_grid_columns,3);assert.equal(x.zone_count,9);
 assert.equal('grid_columns' in x,false);
 for(const altered of [
  {...raw(),grid_columns:'calc(var(--private))'},
  {...raw(),kind:'fake'},
  {...raw(),zones:Array(11).fill([0,0,10,10])},
  {...raw(),grid_columns:'100px url(https://private.example)'},
  {...raw(),grid:[null,0,10,10]}
 ])assert.equal(sanitizeAnonymousLayoutProbe(altered),null);
});
test('desktop computed three columns and distinct three rows pass only real layout constraints',()=>{
 const v=sanitizeAnonymousLayoutProbe(raw());
 const p=assessAnonymousLayout({measurement:v,viewport:view});
 assert.equal(p.status,'PASS_GENERATED_OFFLINE_LAYOUT');
 assert.equal(p.computed_columns,3);
 assert.equal(p.checked_zones,9);
 assert.equal(p.original_site_layout_verified,false);
 assert.equal(p.external_requests_verified_by_layout_probe,false);
});
test('mobile actual one-column stack must remain in bounds',()=>{
 const one=raw(390,1);
 one.grid=[12,110,366,1100];
 one.zones=Array.from({length:9},(_,i)=>[12,150+i*125,366,112]);
 const m=sanitizeAnonymousLayoutProbe(one);
 assert.equal(assessAnonymousLayout({measurement:m,viewport:{width:390,height:844}}).status,
  'PASS_GENERATED_OFFLINE_LAYOUT');
 const broken=sanitizeAnonymousLayoutProbe({...one,document_scroll_width:550});
 assert.equal(assessAnonymousLayout({measurement:broken,viewport:{width:390,height:844}}).reason,
  'HORIZONTAL_DOCUMENT_OVERFLOW');
});
test('wrong columns, forged viewport, native controls, bounds and reordered zones fail closed',()=>{
 const reference=sanitizeAnonymousLayoutProbe(raw());
 const failures=[
  [ {...reference,computed_grid_columns:4},'COMPUTED_GRID_COLUMNS_MISMATCH'],
  [ {...reference,document_client_width:1200},'UNEXPECTED_DOCUMENT_PROVENANCE_OR_CONTROLS'],
  [ {...reference,native_controls:1},'UNEXPECTED_DOCUMENT_PROVENANCE_OR_CONTROLS'],
  [ {...reference,document_scroll_width:1450},'HORIZONTAL_DOCUMENT_OVERFLOW'],
  [ {...reference,zones:reference.zones.map((x,i)=>i===2?[1390,x[1],100,x[3]]:x)},'ZONE_BOUNDARY_OR_SIZE_INVALID'],
  [ {...reference,zones:[...reference.zones.slice(1),reference.zones[0]]},'DESKTOP_COLUMN_ORDER_MISMATCH'],
  [ null,'MEASUREMENT_OR_VIEWPORT_MISSING']
 ];
 for(const [value,reason] of failures){
  const p=assessAnonymousLayout({measurement:value,viewport:view});
  assert.equal(p.status,'BLOCKED');
  assert.equal(p.reason,reason);
  assert.equal(p.original_site_layout_verified,false);
 }
});
