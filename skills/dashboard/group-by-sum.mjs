/** rows + grouping column + finite measure -> first-seen-order [{key,total,count}].
 * Blank measures invalid; blank grouping value = '(blank)'.
 */
export function groupBySum(rows, group, measure) {
  if(!Array.isArray(rows)||rows.length>2000||!/^[A-Za-z_][A-Za-z_0-9]{0,39}$/.test(group)||!/^[A-Za-z_][A-Za-z_0-9]{0,39}$/.test(measure)||group===measure)throw Error('INVALID_GROUP_SCHEMA');
  const groups=new Map();
  for(const row of rows){
    if(!row||typeof row!=='object'||Array.isArray(row)||!Object.hasOwn(row,group)||!Object.hasOwn(row,measure))throw Error('MISSING_GROUP_COLUMN');
    const v=row[measure];if(v===null||typeof v==='boolean'||typeof v==='string'&&!v.trim())throw Error('INVALID_MEASURE');
    const number=Number(v);if(!Number.isFinite(number))throw Error('INVALID_MEASURE');
    const key=String(row[group]??'').trim()||'(blank)';
    const previous=groups.get(key)||{key,total:0,count:0};
    previous.total+=number;if(!Number.isFinite(previous.total))throw Error('SUM_OVERFLOW');previous.count++;groups.set(key,previous);
  }
  return [...groups.values()];
}
