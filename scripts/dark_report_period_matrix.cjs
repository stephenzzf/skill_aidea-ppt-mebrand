const { reportTable } = require('./dark_report_table.cjs');

function periodMatrix(slide, page, theme, bodyTop) {
  const { periods, rows, corner } = page;
  const label = value => typeof value === 'string' && value.trim().length > 0;
  if (!label(corner) || !Array.isArray(periods) || !periods.length || !periods.every(label) ||
      !Array.isArray(rows) || !rows.length || !rows.every(row => row && label(row.label) &&
        Array.isArray(row.values) && row.values.length === periods.length)) {
    throw new Error('period-matrix requires a corner label, named periods and one value per period in each row.');
  }
  const table = [[corner, ...periods], ...rows.map(row => [row.label, ...row.values])];
  const columnWidths = page.columnWidths ?? [0.62, ...periods.map(() => 1)];
  const { deliverableRow } = page;
  if (deliverableRow !== undefined && (!Number.isInteger(deliverableRow) ||
      deliverableRow < 0 || deliverableRow >= rows.length)) {
    throw new Error('deliverableRow must identify an existing zero-based data row.');
  }
  function cellStyle(row, column) {
    const header = row === 0;
    const emphasized = header || column === 0 || row - 1 === deliverableRow;
    return {
      bold: emphasized,
      color: header ? 'FFFFFF' : emphasized ? theme.ink : theme.body,
      fill: { color: header ? theme.ink : emphasized ? theme.tint : 'FFFFFF' },
    };
  }
  reportTable(slide, { ...page, table, columnWidths }, theme, bodyTop, cellStyle);
}

module.exports = { periodMatrix };
