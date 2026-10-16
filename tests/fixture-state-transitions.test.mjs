import test from 'node:test';
import assert from 'node:assert/strict';
import {fingerprintFixtureDom,summarizeFixtureTransitions} from '../studio/fixture-state-transitions.mjs';

function html({help=false,notes=false,rows=['Rose','Blue'],result='ready'}={}){
 const dashboard='<section id="dashboard"'+(help?' hidden':'')+'></section>';
 const helpPanel='<section id="help"'+(!help?' hidden':'')+'></section>';
 const toggle='<button id="toggle-notes" aria-expanded="'+(notes?'true':'false')+'">Info</button>';
 const table='<table><tbody>'+rows.map(x=>'<tr><td>'+x+'</td></tr>').join('')+'</tbody></table>';
 return '<html><body>'+dashboard+helpPanel+toggle+
  '<input type="password" value="PRIVATE_TEXT_NOT_FOR_REPORT">'+
  '<div id="results" data-state="'+result+'">'+table+'</div></body></html>';
}
test('F2 fixture state diff detects observed sorting, expanded notes and view changes',()=>{
 const steps=[
  {step_id:'initial-ready',action:'wait_for',status:'completed',
   artifacts:{dom:{state:'captured',value:{text:html()}}}},
  {step_id:'sort',action:'click',status:'completed',
   artifacts:{dom:{state:'captured',value:{text:html({rows:['Blue','Rose']})}}}},
  {step_id:'toggle-info',action:'click',status:'completed',
   artifacts:{dom:{state:'captured',value:{text:html({notes:true,rows:['Blue','Rose']})}}}},
  {step_id:'help',action:'click',status:'completed',
   artifacts:{dom:{state:'captured',value:{text:html({help:true,notes:true,rows:['Blue','Rose']})}}}},
  {step_id:'back',action:'click',status:'completed',
   artifacts:{dom:{state:'captured',value:{text:html({notes:true,rows:['Blue','Rose']})}}}},
 ];
 const result=summarizeFixtureTransitions(steps);
 assert.equal(result.source,'controlled-fixture-state-diff');
 assert.equal(result.changed_steps,4);
 assert.equal(result.observed_state_changes,4);
 assert.equal(result.steps[0].changed.length,0);
 assert.deepEqual(result.steps[1].changed,[{field:'table_row_order',from:'previous',to:'changed'}]);
 assert.deepEqual(result.steps[2].changed,[{field:'notes_expanded',from:false,to:true}]);
 assert.deepEqual(result.steps[3].changed,[{field:'panel',from:'dashboard',to:'help'}]);
 assert.deepEqual(result.steps[4].changed,[{field:'panel',from:'help',to:'dashboard'}]);
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE_TEXT|Rose|Blue|password|<input|[a-f0-9]{64}/);
});
test('F2 never claims state change on missing DOM or unchanged snapshot',()=>{
 const text=html();
 const result=summarizeFixtureTransitions([
  {step_id:'first',action:'wait_for',status:'completed',artifacts:{dom:{state:'captured',value:{text}}}},
  {step_id:'no-capture',action:'click',status:'failed',artifacts:{dom:{state:'missing'}}},
  {step_id:'same',action:'click',status:'completed',artifacts:{dom:{state:'captured',value:{text}}}},
 ]);
 assert.equal(result.changed_steps,0);
 assert.equal(result.steps[1].dom_observed,false);
 assert.equal(result.steps[2].changed.length,0);
});
test('F2 state parser includes only whitelisted bounded structural signals',()=>{
 const result=fingerprintFixtureDom(html({rows:['One'],result:'error'}));
 assert.equal(result.panel,'dashboard');
 assert.equal(result.result_state,'error');
 assert.equal(result.table_rows,1);
 assert.equal(result.notes_expanded,false);
 const empty=fingerprintFixtureDom('<div>unstructured</div>');
 assert.equal(empty.panel,null);
 assert.equal(empty.table_rows,null);
 assert.equal(fingerprintFixtureDom(null),null);
});
