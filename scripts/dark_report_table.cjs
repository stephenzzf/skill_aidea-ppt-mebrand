// Full-width native tables for management review. Split oversized content at
// meaningful row boundaries and repeat its header in the next table page.
const { text, table } = require('./report_primitives.cjs');

const X = 0.55;
const WIDTH = 13 + 1 / 3 - 2 * X;
const TOP = 1.55;
const BOTTOM = 6.85;
const GAP = 0.15;

function lineCount(value, width, size) {
  // Budget wide glyphs separately from Latin runs. Reserve extra space for
  // word wrapping; render QA still checks the installed fonts' actual metrics.
  const capacity = width * 72 / size * 0.92;
  return String(value).split(/\r?\n/).reduce((total, line) => {
    let units = 0;
    for (const ch of line) units += ch.codePointAt(0) > 255 ? 1 : 0.58;
    return total + Math.max(1, Math.ceil(units / capacity));
  }, 0);
}

function measureReportTable(page, bodyTop = TOP, sizes = [16, 15, 14]) {
  const rows = page.table;
  if (!Array.isArray(rows) || !rows.length || !Array.isArray(rows[0]) || !rows[0].length ||
      rows.some(row => !Array.isArray(row) || row.length !== rows[0].length ||
        row.some(value => typeof value !== 'string' && !Number.isFinite(value)))) {
    throw new Error('A table page requires rectangular text or number rows, starting with its header.');
  }
  const weights = page.columnWidths ?? rows[0].map(() => 1);
  if (!Array.isArray(weights) || weights.length !== rows[0].length ||
      weights.some(value => !Number.isFinite(value) || value <= 0)) {
    throw new Error('columnWidths requires one positive relative width per table column.');
  }
  const sum = weights.reduce((acc, value) => acc + value, 0);
  const widths = weights.map(value => WIDTH * value / sum);
  const leadH = page.lead ? Math.max(0.39, lineCount(page.lead, WIDTH, 16) * 0.31) : 0;
  const noteH = page.note ? Math.max(0.34, lineCount(page.note, WIDTH, 13) * 0.26) : 0;
  const y = bodyTop + (leadH ? leadH + GAP : 0);
  const availableHeight = BOTTOM - y - (noteH ? noteH + GAP : 0);
  for (const size of sizes) {
    const heights = rows.map(row => {
      const lines = Math.max(...row.map((cell, i) => lineCount(cell, widths[i] - 0.16, size)));
      return Math.max(0.42, lines * size * 1.32 / 72 + 0.18);
    });
    const h = heights.reduce((acc, height) => acc + height, 0);
    if (h > availableHeight || Math.min(...widths) < size / 72 + 0.16) continue;
    return { x: X, y, w: WIDTH, h, colW: widths, rowH: heights, fontSize: size, leadH, noteH };
  }
  return null;
}

function reportTable(slide, page, theme, bodyTop = TOP) {
  const layout = measureReportTable(page, bodyTop);
  if (layout) {
    const { leadH, noteH, ...box } = layout;
    if (leadH) text(slide, page.lead, X, bodyTop, WIDTH, leadH, theme, { fontSize: 16 });
    table(slide, page.table, box, theme);
    if (noteH) text(slide, page.note, X, box.y + box.h + GAP, WIDTH, noteH, theme, { fontSize: 13 });
    return;
  }
  throw new Error('Table content exceeds this page: rebalance columnWidths or split rows across pages with repeated headers.');
}

module.exports = { reportTable, measureReportTable, lineCount };
