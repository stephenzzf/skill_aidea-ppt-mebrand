// Editable decision layouts. The common report base owns title, navigation and footer.
const { text } = require('./report_primitives.cjs');
const { lineCount } = require('./dark_report_table.cjs');

const LEFT = 0.55;
const WIDTH = 12.23;
const NOTE_Y = 6.49;
const TINT = 'F3F1FA';
const STAGE_COLORS = ['5C0BE0', '4C36C5', '354EB7', '2468AD', '14718A'];

function required(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw Error(`Expected nonempty text for ${field}.`);
  return value;
}

function list(value, field, min, max = Infinity) {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    throw Error(`Invalid number of entries for ${field}.`);
  return value;
}

function rect(slide, x, y, w, h, color) {
  slide.addShape('rect', { x, y, w, h, fill: { color }, line: { transparency: 100 } });
}

function label(slide, theme, value, x, y, w, h, fontSize, color = theme.body, bold = false, align = 'left') {
  required(value, 'label');
  if (h <= 0 || lineCount(value, w, fontSize) * fontSize * 1.16 / 72 > h + 0.045)
    throw Error(`Text exceeds the available space: "${value}". Split the content at a meaningful boundary.`);
  text(slide, value, x, y, w, h, theme, { fontSize, color, bold, align });
}

function note(slide, theme, page) {
  if (page.note) label(slide, theme, page.note, 0.58, NOTE_Y, 12.1, 0.40, 12, '68617F');
}

function headerRow(page, columns) {
  return list(page.headers, 'headers', columns, columns).map(value => required(value, 'header'));
}

// Fit rows to their measured content. The header and first column retain the
// reference styling, including when responsibility rows use a different count.
function recordTable(slide, theme, rows, top, widths, preferredHeight) {
  const available = NOTE_Y - top - 0.12;
  const heights = rows.map((row, i) => {
    const lines = Math.max(...row.map((value, c) => lineCount(value, widths[c] - 0.21, 14)));
    return Math.max(i === 0 ? 0.40 : 0.46, lines * 14 * 1.18 / 72 + 0.06);
  });
  const minHeight = heights.reduce((a, b) => a + b, 0);
  if (minHeight > available) throw Error('Table rows exceed the page. Split the rows and repeat the header.');
  const extra = Math.max(0, Math.min(available, preferredHeight) - minHeight) / (rows.length - 1);
  for (let i = 1; i < heights.length; i++) heights[i] += extra;
  const cells = rows.map((row, i) => row.map((value, c) => ({
    text: value, options: { bold: !i || !c, color: !i ? 'FFFFFF' : !c ? theme.ink : theme.body,
      fill: { color: !i ? theme.ink : i % 2 ? TINT : 'FAF9FD' } },
  })));
  slide.addTable(cells, { x: LEFT, y: top, w: WIDTH, h: heights.reduce((a, b) => a + b, 0),
    colW: widths, rowH: heights, autoPage: false, fontFace: theme.cjk, fontSize: 14, lang: 'zh-CN',
    margin: [0.025, 0.09, 0.025, 0.12], valign: 'middle', border: { type: 'solid', pt: 0.7, color: 'FFFFFF' } });
}

function stageResponsibilities(slide, page, theme, top) {
  const stages = list(page.stages, 'stages', 2, STAGE_COLORS.length);
  const rows = [headerRow(page, 2), ...list(page.responsibilities, 'responsibilities', 1).map(
    row => [required(row?.role, 'role'), required(row?.duty, 'duty')])];
  label(slide, theme, page.stageHeading, LEFT, top + 0.04, WIDTH, 0.31, 15, theme.ink, true);
  const gap = 0.095;
  const width = (WIDTH - (stages.length - 1) * gap) / stages.length;
  stages.forEach((stage, i) => {
    const x = LEFT + i * (width + gap);
    const title = required(stage?.number, 'stage number') + '  ' + required(stage?.title, 'stage title');
    rect(slide, x, top + 0.51, width, 0.54, STAGE_COLORS[i]);
    label(slide, theme, title, x + 0.10, top + 0.54, width - 0.19, 0.43, 15, 'FFFFFF', true);
    rect(slide, x, top + 1.07, width, 1.16, TINT);
    label(slide, theme, stage.detail, x + 0.11, top + 1.12, width - 0.22, 1.04, 14);
  });
  label(slide, theme, page.responsibilityHeading, LEFT, top + 2.44, WIDTH, 0.31, 15, theme.ink, true);
  recordTable(slide, theme, rows, top + 2.87, [3.37, 8.86], 0.4 + (rows.length - 1) * 0.51);
  note(slide, theme, page);
}

function caseIndex(slide, page, theme, top) {
  const rows = [headerRow(page, 4), ...list(page.cases, 'cases', 1).map(row =>
    ['subject', 'task', 'evidence', 'locator'].map(field => required(row?.[field], field)))];
  label(slide, theme, page.lead, 0.56, top + 0.05, 12.2, 0.35, 16, theme.ink, true);
  recordTable(slide, theme, rows, top + 0.57, [3.08, 4.38, 3.86, 0.91], 0.42 + (rows.length - 1) * 0.55);
  note(slide, theme, page);
}

function candidateSelection(slide, page, theme, top) {
  const { pool, shortlist } = page;
  const examples = list(pool?.examples, 'pool.examples', 1).map(value => required(value, 'pool example'));
  const items = list(shortlist?.items, 'shortlist.items', 1, 3);
  if (!Number.isSafeInteger(pool.count) || pool.count < Math.max(examples.length, items.length) ||
      shortlist.count !== items.length) throw Error('Candidate counts must agree with the disclosed examples and selected items.');
  if (examples.length < pool.count) required(pool.disclosure, 'pool.disclosure');
  label(slide, theme, page.lead, 0.56, top + 0.05, 12.2, 0.35, 16, theme.ink, true);
  const cardTop = top + 1.25;
  const evidenceY = 5.63;
  const cardHeight = evidenceY - 0.21 - cardTop;
  for (const [group, x, width, color] of [[pool, LEFT, 5.10, theme.ink], [shortlist, 6.43, 6.35, theme.violet]]) {
    rect(slide, x, top + 0.67, width, 0.56, color);
    label(slide, theme, group.count + ' ' + required(group.label, 'group label'),
      x + 0.16, top + 0.72, width - 0.38, 0.42, 18, 'FFFFFF', true);
  }
  rect(slide, LEFT, cardTop, 5.10, cardHeight, TINT);
  label(slide, theme, pool.exampleHeading, LEFT + 0.20, cardTop + 0.19, 4.69, 0.43, 16, theme.ink, true);
  const disclosureSpace = pool.disclosure ? 0.82 : 0;
  label(slide, theme, examples.join('、'), LEFT + 0.20, cardTop + 0.79, 4.69, cardHeight - 0.95 - disclosureSpace, 17);
  if (pool.disclosure) label(slide, theme, pool.disclosure, LEFT + 0.20, cardTop + cardHeight - 0.83, 4.65, 0.50, 14, '68617F');
  label(slide, theme, '→', 5.76, cardTop + cardHeight / 2 - 0.66, 0.56, 0.56, 25, theme.violet, true, 'center');
  const stride = (cardHeight + 0.03) / items.length;
  items.forEach((item, i) => {
    const y = cardTop + i * stride;
    rect(slide, 6.43, y, 6.35, stride - 0.03, TINT);
    label(slide, theme, item?.title, 6.60, y + 0.10, 5.99, 0.35, 16, theme.ink, true);
    label(slide, theme, item?.reason, 6.60, y + 0.50, 5.99, stride - 0.59, 15);
  });
  rect(slide, LEFT, evidenceY, WIDTH, 0.69, 'EBF1FA');
  label(slide, theme, page.evidence, 0.70, evidenceY + 0.07, 11.91, 0.55, 15, theme.ink);
  note(slide, theme, page);
}

module.exports = { stageResponsibilities, caseIndex, candidateSelection };
