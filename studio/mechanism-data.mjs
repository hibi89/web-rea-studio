/** No network: read bounded user-owned CSV/JSON bytes. */
export function parseCsvRows(text){
  if(typeof text!=='string'||text.length>300000)throw Error('DATA_TOO_LARGE');
  text=text.replace(/^\uFEFF/,'');
  const records=[];let cells=[],cell='',quoted=false,closed=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
    if(closed&&c!==','&&c!=='\r'&&c!=='\n')throw Error('INVALID_CSV_QUOTE');
    if(c==='"'){if(cell.length||closed)throw Error('INVALID_CSV_QUOTE');quoted=true;continue;}
    if(c===','){cells.push(cell);cell='';closed=false;continue;}
    if(c==='\r'||c==='\n'){
      if(c==='\r'&&text[i+1]==='\n')i++;
      cells.push(cell);if(cells.some(v=>v.trim()!==''))records.push(cells);
      cells=[];cell='';closed=false;continue;
    }
    cell+=c;if(cell.length>250)throw Error('CELL_TOO_LONG');
  }
  if(quoted)throw Error('UNTERMINATED_CSV_QUOTE');
  cells.push(cell);if(cells.some(v=>v.trim()!==''))records.push(cells);
  if(records.length<2)throw Error('EMPTY_CSV');
  const columns=records.shift().map(s=>s.trim());
  if(columns.length>20||columns.some(c=>!/^[A-Za-z_][A-Za-z_0-9]{0,39}$/.test(c))||new Set(columns).size!==columns.length)throw Error('INVALID_HEADERS');
  if(records.length>2000||records.some(row=>row.length!==columns.length))throw Error('INVALID_ROW_WIDTH');
  return records.map(values=>Object.fromEntries(columns.map((c,i)=>[c,values[i]])));
}
export function normalizeDataset(rows){
  if(!Array.isArray(rows)||rows.length<1||rows.length>2000)throw Error('INVALID_DATASET_ROWS');
  const first=rows[0];if(!first||typeof first!=='object'||Array.isArray(first))throw Error('INVALID_DATASET_ROW');
  const columns=Object.keys(first);
  if(columns.length>20||columns.length<3||columns.some(c=>!/^[A-Za-z_][A-Za-z_0-9]{0,39}$/.test(c))||new Set(columns).size!==columns.length)throw Error('INVALID_HEADERS');
  return rows.map(row=>{
    if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).length!==columns.length||columns.some(c=>!Object.hasOwn(row,c)))throw Error('INCONSISTENT_ROWS');
    const out=Object.create(null);
    for(const c of columns){
      const v=row[c];if(v!==null&&!['string','number','boolean'].includes(typeof v)||String(v??'').length>250||typeof v==='number'&&!Number.isFinite(v))throw Error('INVALID_CELL');
      out[c]=v;
    }return out;
  });
}
export function parseDataset(text,format){
  if(typeof text!=='string'||text.length>300000)throw Error('DATA_TOO_LARGE');
  if(format!=='csv'&&format!=='json')throw Error('INVALID_FORMAT');
  const obj=format==='csv'?parseCsvRows(text):JSON.parse(text);
  return normalizeDataset(format==='json'&&!Array.isArray(obj)?obj?.rows:obj);
}
export function suggestMapping(rows){
  const cols=Object.keys(rows[0]||{});
  const choose=(hints,used,numeric=false)=>cols.find(c=>!used.includes(c)&&hints.some(h=>c.toLowerCase().includes(h)))||
    cols.find(c=>!used.includes(c)&&(!numeric||rows.every(r=>r[c]!==null&&String(r[c]).trim()!==''&&Number.isFinite(Number(r[c])))))||'';
  const dimension=choose(['region','country','area','국가'],[]);
  const group=choose(['month','date','period','time','월'],[dimension]);
  const measure=choose(['revenue','sales','amount','value','total','매출'],[dimension,group],true);
  return {dimension,group,measure};
}
