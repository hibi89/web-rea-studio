// Only analyze the already retrieved HTML. No network or JavaScript execution.
const countTag=(html,tag)=>(html.match(new RegExp('<'+tag+'(?:\\s|/?>)','gi'))||[]).length;
const attr=(raw,key)=>new RegExp('(?:^|\\s)'+key+'\\s*=\\s*"([^"]*)"','i').exec(raw)?.[1]||'';
function safeResource(value,target,kind){
 try{
  const src=new URL(value,target),base=new URL(target);
  if(src.protocol!=='https:'||src.username||src.password)return null;
  if(src.origin===base.origin)return {kind,scope:'approved-origin',path:src.pathname.slice(0,100)};
  return /^[a-z0-9.-]{1,180}$/.test(src.hostname)?{kind,scope:'external',host:src.hostname}:null;
 }catch{return null;}
}
export function inspectFrontendHtml(html,target){
 if(typeof html!=='string'||html.length>600000)throw Error('HTML size exceeded');
 const scriptTags=[...html.matchAll(/<script\b([^>]{0,2048})>([\s\S]*?)<\/script\s*>/gi)].slice(0,32);
 const styles=[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].slice(0,32);
 const deps=[];
 for(const s of scriptTags){const src=attr(s[1],'src');if(src){const safe=safeResource(src,target,'script');if(safe)deps.push(safe);}}
 for(const m of html.matchAll(/<link\b([^>]{0,2048})>/gi)){
  if(deps.length>=32)break;
  if(!/stylesheet/i.test(attr(m[1],'rel')))continue;
  const safe=safeResource(attr(m[1],'href'),target,'stylesheet');if(safe)deps.push(safe);
 }
 const js=scriptTags.filter(s=>!attr(s[1],'src')).map(s=>s[2]).join(' ').slice(0,400000);
 const css=styles.map(s=>s[1]).join(' ').slice(0,250000);
 const tags=['header','nav','main','aside','section','article','footer','canvas','svg','table','button','input','form'];
 return {
  source:'html-only',certainty:'structural-hints',
  tags:Object.fromEntries(tags.map(tag=>[tag,countTag(html,tag)])),
  scripts:{total:scriptTags.length,inline:scriptTags.filter(s=>!attr(s[1],'src')).length,
   fetch_markers:(js.match(/\bfetch\s*\(/g)||[]).length,
   event_markers:(js.match(/\baddEventListener\s*\(/g)||[]).length,
   chart_markers:[...new Set((js.match(/\b(?:echarts|recharts|chart\.js|apexcharts|highcharts|plotly)\b/gi)||[]).map(s=>s.toLowerCase()))].slice(0,8)},
  css:{style_blocks:styles.length,rule_groups:(css.match(/\{/g)||[]).length,
   colors:[...new Set((css.match(/#[0-9a-f]{3,8}\b/gi)||[]).filter(s=>[4,5,7,9].includes(s.length)).map(s=>s.toLowerCase()))].slice(0,18)},
  resources:deps.slice(0,32),api_replay:'not_attempted'};
}
