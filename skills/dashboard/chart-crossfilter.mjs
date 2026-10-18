/** Selection -> same filtered rows -> single chart & KPI; no mocks. */
export function chartCrossfilter(rows, mapping, selected, filterSkill, groupSkill) {
  if(!mapping||![mapping.dimension,mapping.group,mapping.measure].every(v=>typeof v==='string')||
    new Set([mapping.dimension,mapping.group,mapping.measure]).size!==3||
    typeof filterSkill!=='function'||typeof groupSkill!=='function')throw Error('INVALID_CROSSFILTER_MAPPING');
  const selectedRows=filterSkill(rows,mapping.dimension,selected);
  const chart=groupSkill(selectedRows,mapping.group,mapping.measure);
  const total=chart.reduce((sum,item)=>sum+item.total,0);if(!Number.isFinite(total))throw Error('TOTAL_OVERFLOW');
  return {total,count:selectedRows.length,chart,trace:{dimension:mapping.dimension,selected,group:mapping.group,
    measure:mapping.measure,source_rows:rows.length,selected_rows:selectedRows.length,
    stages:['dimension-filter','group-by-sum','chart-crossfilter']}};
}
