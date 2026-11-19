// Native analytical layouts. Header and brand footer are supplied by the caller.
const { text } = require('./report_primitives.cjs');
const { lineCount, measureReportTable } = require('./dark_report_table.cjs');

const X = 0.55,
  W = 12.23,
  BOTTOM = 6.85;
const BLUE = '2256B0',
  PURPLE = '5331B0',
  PALE = 'F3F0FA',
  INK = '2E1F6B';
const STEP_COLORS = ['38476F', '344D88', '3059A5', '4A43A6', '5D2BBA'];

function box(slide, x, y, w, h, color) {
  slide.addShape('rect', { x, y, w, h, fill: { color }, line: { transparency: 100 } });
}
function write(slide, theme, value, x, y, w, h, fontSize, options = {}) {
  if (typeof value !== 'string' || !value.trim()) throw Error('Analytical layout expected a nonempty text label.');
  const lines = lineCount(value, w, fontSize);
  if ((lines * fontSize * 1.17) / 72 > h + 0.05) {
    throw Error(
      `Label exceeds analytical layout: "${value}". Shorten its visible copy and retain the full wording in notes.`,
    );
  }
  text(slide, value, x, y, w, h, theme, { fontSize, ...options });
}
function rule(slide, x, y, w, h, color, arrow = false, upward = false) {
  slide.addShape('line', {
    x,
    y,
    w,
    h,
    flipV: upward,
    line: { color, width: 1.2, ...(arrow ? { endArrowType: 'triangle' } : {}) },
  });
}
function note(slide, page, theme) {
  if (page.note) write(slide, theme, page.note, X, 6.46, W, 0.36, 12, { color: theme.muted });
}

function quadrant(slide, page, theme, top) {
  const cells = page.cells;
  if (
    !Array.isArray(cells) ||
    cells.length !== 4 ||
    cells.some((c) => !['low', 'high'].includes(c.x) || !['low', 'high'].includes(c.y)) ||
    new Set(cells.map((c) => c.x + c.y)).size !== 4
  )
    throw Error('quadrant requires each low/high coordinate exactly once.');
  const highlight = page.highlight === undefined ? { x: 'high', y: 'high' } : page.highlight;
  if (highlight !== null && !cells.some((cell) => cell.x === highlight?.x && cell.y === highlight?.y)) {
    throw Error('quadrant highlight must identify a low/high coordinate or be null.');
  }
  const side = page.sideItems ?? [];
  if (!Array.isArray(side) || side.length > 5) throw Error('quadrant supports up to five companion rows.');
  const matrixX = 1.18,
    matrixY = top + 0.44,
    matrixW = side.length ? 7.04 : 11.48;
  const matrixH = 5.86 - matrixY,
    col = matrixW / 2,
    row = matrixH / 2;
  write(slide, theme, page.yAxis + ' ↑', X, top, matrixW, 0.34, 15, { color: INK, bold: true });
  for (const c of cells) {
    const right = c.x === 'high',
      high = c.y === 'high';
    const x = matrixX + (right ? col : 0),
      y = matrixY + (high ? 0 : row);
    const strong = c.x === highlight?.x && c.y === highlight?.y,
      fill = strong ? PURPLE : high ? 'E9E4F7' : right ? 'E5EFFB' : 'F3F2F6';
    box(slide, x + 0.025, y + 0.025, col - 0.05, row - 0.05, fill);
    write(slide, theme, c.title, x + 0.2, y + 0.15, col - 0.4, 0.56, 19, {
      color: strong ? 'FFFFFF' : INK,
      bold: true,
    });
    write(slide, theme, c.detail, x + 0.2, y + 0.73, col - 0.4, row - 0.92, 15, {
      color: strong ? 'FFFFFF' : theme.body,
      valign: 'top',
    });
  }
  rule(slide, matrixX - 0.05, matrixY - 0.04, 0, matrixH + 0.09, BLUE, true, true);
  rule(slide, matrixX - 0.05, 5.91, matrixW + 0.05, 0, BLUE, true);
  write(slide, theme, '高', X, matrixY, 0.41, 0.42, 14, { color: BLUE });
  write(slide, theme, '低', X, 5.42, 0.41, 0.42, 14, { color: BLUE });
  write(slide, theme, '低', matrixX, 5.99, 0.44, 0.35, 13);
  write(slide, theme, page.xAxis + ' →', matrixX + 0.55, 5.99, matrixW - 1.1, 0.35, 15, {
    align: 'center',
    bold: true,
    color: INK,
  });
  write(slide, theme, '高', matrixX + matrixW - 0.44, 5.99, 0.44, 0.35, 13, { align: 'right' });
  if (side.length) {
    const sx = 8.57,
      sw = X + W - sx,
      sy = top + 0.49,
      rh = (6.29 - sy) / side.length;
    write(slide, theme, page.sideTitle, sx, top, sw, 0.4, 17, { color: INK, bold: true });
    side.forEach((item, i) => {
      const y = sy + i * rh;
      rule(slide, sx, y, sw, 0, theme.rule);
      write(slide, theme, item.title, sx + 0.02, y + 0.07, sw - 0.04, 0.35, 15, { color: BLUE, bold: true });
      write(slide, theme, item.detail, sx + 0.02, y + 0.43, sw - 0.04, rh - 0.47, 14, { valign: 'top' });
    });
  }
  note(slide, page, theme);
}

function maturity(slide, page, theme, top) {
  const levels = page.levels;
  if (!Array.isArray(levels) || levels.length < 3 || levels.length > 5)
    throw Error('maturity requires three to five ordered levels.');
  if (page.examples && (!Array.isArray(page.examples) || page.examples.length !== levels.length))
    throw Error('maturity examples must align one-to-one with levels.');
  const col = W / levels.length;
  if (page.lead) write(slide, theme, page.lead, X, top, W, 0.46, 16, { color: INK });
  const start = top + (page.lead ? 0.64 : 0.16),
    floor = page.examples ? 4.9 : 6.17;
  const rise = Math.min(0.23, (floor - start - 1.6) / (levels.length - 1));
  levels.forEach((item, i) => {
    const x = X + i * col,
      y = start + (levels.length - i - 1) * rise;
    box(slide, x, y, col - 0.045, floor - y, i === levels.length - 1 ? 'E9E1FA' : 'F1F3FA');
    box(slide, x, y, col - 0.045, 0.54, STEP_COLORS[Math.round((i * 4) / (levels.length - 1))]);
    write(slide, theme, item.level, x + 0.11, y + 0.05, col - 0.27, 0.44, 19, { bold: true, color: 'FFFFFF' });
    write(slide, theme, item.title, x + 0.12, y + 0.64, col - 0.29, 0.47, 17, { bold: true, color: INK });
    write(slide, theme, item.detail, x + 0.12, y + 1.14, col - 0.29, floor - y - 1.18, 14, { valign: 'top' });
  });
  if (page.examples) {
    write(slide, theme, page.exampleTitle, X, 5.0, W, 0.36, 15, { bold: true, color: PURPLE });
    page.examples.forEach((example, i) => {
      box(slide, X + i * col, 5.44, col - 0.045, 0.87, 'F5F5F8');
      write(slide, theme, example, X + i * col + 0.12, 5.5, col - 0.29, 0.73, 14, { valign: 'top' });
    });
  }
  note(slide, page, theme);
}

function evidenceChart(slide, pptx, page, theme, top) {
  const { labels, values, comparison } = page;
  if (
    !Array.isArray(values) ||
    !values.length ||
    values.some((v) => !Number.isFinite(v)) ||
    !Array.isArray(labels) ||
    labels.length !== values.length ||
    labels.some((v) => typeof v !== 'string' || !v.trim())
  ) {
    throw Error('evidence-chart requires one finite exact value for each category. Put estimates in approximation.');
  }
  if (!Array.isArray(comparison) || !comparison.length || comparison.length > 5)
    throw Error('comparison requires one to five text value/label pairs.');
  const split = 7.72,
    sourceY = 6.07;
  write(slide, theme, page.chartTitle, X, top, split - 0.85, 0.4, 18, { bold: true, color: INK });
  let barTop = top + 0.49;
  if (page.approximation) {
    box(slide, X, barTop, split - 0.83, 0.54, 'EAF2FC');
    write(slide, theme, page.approximation, X + 0.13, barTop + 0.04, split - 1.1, 0.45, 15, {
      color: BLUE,
      bold: true,
    });
    barTop += 0.7;
  }
  const fmt = page.numberFormat || 'General';
  // Outside-end labels need room beyond the longest bar. Keep zero in the
  // domain and provide padding for signed series at both visible ends.
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(0, ...values);
  const span = maximum - minimum || 1;
  slide.addChart(pptx.ChartType.bar, [{ name: page.chartTitle, labels, values }], {
    x: X,
    y: barTop,
    w: split - 0.8,
    h: sourceY - barTop - 0.11,
    barDir: 'bar',
    barGrouping: 'clustered',
    catAxisOrientation: 'maxMin',
    showTitle: false,
    showLegend: false,
    showValue: true,
    showCatName: false,
    showCatNameInLegend: false,
    dataLabelFormatCode: fmt,
    dataLabelPosition: 'outEnd',
    dataLabelColor: INK,
    dataLabelFontFace: theme.latin,
    dataLabelFontBold: true,
    dataLabelFontSize: 16,
    catAxisLabelFontFace: theme.cjk,
    catAxisLabelFontSize: 14,
    catAxisLineShow: false,
    valAxisHidden: true,
    valAxisLabelFormatCode: fmt,
    valAxisMinVal: minimum < 0 ? minimum - span * 0.22 : 0,
    valAxisMaxVal: maximum > 0 ? maximum + span * 0.22 : minimum === 0 ? 1 : 0,
    valGridLine: { style: 'none' },
    chartColors: [theme.blue],
    showBorder: false,
  });
  const sx = split + 0.28,
    sw = X + W - sx,
    sy = top + 0.7,
    rh = (sourceY - sy - 0.18) / comparison.length;
  box(slide, split, top, 0.018, 6.72 - top, theme.rule);
  write(slide, theme, page.comparisonTitle, sx, top, sw, 0.48, 18, { bold: true, color: PURPLE });
  comparison.forEach((item, i) => {
    const y = sy + i * rh;
    rule(slide, sx, y, sw, 0, theme.rule);
    write(slide, theme, item.value, sx + 0.03, y + 0.09, 1.53, rh - 0.16, 22, { bold: true, color: PURPLE });
    write(slide, theme, item.label, sx + 1.64, y + 0.09, sw - 1.67, rh - 0.16, 15);
  });
  write(slide, theme, page.chartSource, X, sourceY, split - 0.85, 0.72, 13, { color: theme.muted, valign: 'top' });
  write(slide, theme, page.comparisonSource, sx, sourceY, sw, 0.72, 13, { color: theme.muted, valign: 'top' });
}

function registerPages(page, top) {
  if (!['locked', 'paginate'].includes(page.mode)) throw Error('source-register mode must be locked or paginate.');
  if (
    !Array.isArray(page.headers) ||
    !page.headers.length ||
    !Array.isArray(page.rows) ||
    !page.rows.length ||
    page.rows.some(
      (row) =>
        !Array.isArray(row) ||
        row.length !== page.headers.length ||
        row.some((v) => typeof v !== 'string' && !Number.isFinite(v)),
    )
  ) {
    throw Error('source-register requires complete rectangular records with headers.');
  }
  const { headers, rows } = page;
  if (page.mode === 'locked') {
    if (!Array.isArray(page.indexRows) || !page.indexRows.length)
      throw Error('A locked register requires an explicit visible index.');
    const pointer = '完整明细见本页备注';
    const notes = [page.notes, ...[headers, ...rows].map((row) => row.join(' ｜ '))].filter(Boolean).join('\n');
    return [
      {
        ...page,
        table: [page.indexHeaders, ...page.indexRows],
        columnWidths: page.indexColumnWidths,
        notes,
        note: [page.note, pointer].filter(Boolean).join(' · '),
      },
    ];
  }
  const groups = [];
  let current = [];
  for (const row of rows) {
    if (measureReportTable({ ...page, table: [headers, ...current, row] }, top, [14])) {
      current.push(row);
      continue;
    }
    if (!current.length || !measureReportTable({ ...page, table: [headers, row] }, top, [14])) {
      throw Error(
        'A register row exceeds the page height. Shorten the visible extract and preserve the complete record in notes.',
      );
    }
    groups.push(current);
    current = [row];
  }
  groups.push(current);
  return groups.map((group, i) => ({
    ...page,
    table: [headers, ...group],
    continued: groups.length > 1,
    kicker: groups.length === 1 ? page.kicker : `${page.kicker} · ${i + 1}/${groups.length}`,
  }));
}

function sourceRegister(slide, page, theme, top) {
  // A multipage register keeps the same type size and column widths on each continuation.
  const layout = measureReportTable(page, top, page.continued ? [14] : [16, 15, 14]);
  if (!layout) throw Error('Visible register exceeds page height. Rebalance columnWidths or use a shorter index.');
  const { leadH, noteH, ...dims } = layout;
  if (leadH) text(slide, page.lead, X, top, W, leadH, theme, { fontSize: 16, color: INK });
  const cells = page.table.map((row, r) =>
    row.map((value, c) => ({
      text: String(value),
      options: {
        bold: r === 0 || c === 0,
        color: r === 0 ? 'FFFFFF' : c === 0 ? PURPLE : theme.body,
        fill: { color: r === 0 ? INK : r % 2 === 1 ? 'F0F0F7' : 'FBFAFD' },
      },
    })),
  );
  slide.addTable(cells, {
    ...dims,
    fontFace: theme.cjk,
    margin: 0.08,
    border: { type: 'solid', pt: 0.6, color: 'FFFFFF' },
    autoPage: false,
  });
  if (noteH) text(slide, page.note, X, dims.y + dims.h + 0.15, W, noteH, theme, { fontSize: 13, color: theme.muted });
}

module.exports = { quadrant, maturity, evidenceChart, registerPages, sourceRegister };
