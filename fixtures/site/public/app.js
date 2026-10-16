const $=id=>document.getElementById(id);
let rows=[],descending=false;
const html=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(){
 const sorted=[...rows].sort((a,b)=>descending?b.score-a.score:a.title.localeCompare(b.title));
 $('count').textContent=String(rows.length);
 $('avg').textContent=rows.length?String(Math.round(rows.reduce((n,x)=>n+x.score,0)/rows.length)):'0';
 $('results').innerHTML='<table><thead><tr><th>디자인</th><th>분류</th><th>점수</th></tr></thead><tbody>'+sorted.map(x=>'<tr><td>'+html(x.title)+'</td><td>'+html(x.category)+'</td><td>'+x.score+'</td></tr>').join('')+'</tbody></table>';
 $('results').dataset.state='ready';
}
async function refresh(){
 $('results').dataset.state='loading';$('status').textContent='조회 중';
 const params=new URLSearchParams({days:$('days').value,category:$('category').value,q:$('search').value});
 try{const response=await fetch('/api/trends?'+params);if(!response.ok)throw Error('HTTP '+response.status);
 const data=await response.json();rows=data.items;render();$('status').textContent='조회 완료 · '+data.count+'개';}
 catch(e){$('results').dataset.state='error';$('results').textContent='조회 실패';$('status').textContent=e.message;}
}
function view(info){$('dashboard').hidden=info;$('help').hidden=!info;history.pushState({view:info?'help':'table'},'',info?'#help':'#table');}
$('refresh').addEventListener('click',refresh);
$('days').addEventListener('change',refresh);
$('category').addEventListener('change',refresh);
$('search').addEventListener('input',refresh);
$('sort').addEventListener('click',()=>{descending=!descending;render();});
$('toggle-notes').addEventListener('click',()=>{const visible=$('notes').hidden;$('notes').hidden=!visible;$('toggle-notes').setAttribute('aria-expanded',String(visible));});
$('view-info').addEventListener('click',()=>view(true));
$('view-table').addEventListener('click',()=>view(false));
$('back').addEventListener('click',()=>view(false));
window.addEventListener('popstate',()=>{$('dashboard').hidden=location.hash==='#help';$('help').hidden=location.hash!=='#help';});
refresh();
