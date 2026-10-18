/** rows[] + dimension column + selected string|null (null = ALL) -> selected rows. */
export function dimensionFilter(rows, dimension, selected=null) {
  if(!Array.isArray(rows)||rows.length>2000||!/^[A-Za-z_][A-Za-z_0-9]{0,39}$/.test(dimension))throw Error('INVALID_FILTER_SCHEMA');
  if(selected!==null&&typeof selected!=='string')throw Error('INVALID_FILTER_VALUE');
  return rows.filter(row=>{
    if(!row||typeof row!=='object'||Array.isArray(row)||!Object.hasOwn(row,dimension))throw Error('MISSING_FILTER_COLUMN');
    const v=row[dimension];if(v!==null&&!['string','number','boolean'].includes(typeof v))throw Error('INVALID_FILTER_CELL');
    return selected===null||String(v??'')===selected;
  });
}
