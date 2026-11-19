const assert = require('node:assert/strict');
const test = require('node:test');
const { reportTable } = require('./dark_report_table.cjs');

const theme = { body: '4D4A66', ink: '2E1F6B', cjk: '等线', latin: 'Poppins', tint: 'F4F1FB', rule: 'DFDCE8' };

test('review table reserves room for scope and keeps header, data and relative widths editable', () => {
  const objects = [];
  const slide = {
    addText(runs, options) { objects.push({ type: 'text', runs, ...options }); },
    addTable(rows, options) { objects.push({ type: 'table', rows, ...options }); },
  };
  const table = [['决策事项', '建议及依据', '责任'], ['拟增加售前支持', '分阶段验证实施进度及试点范围。', '集团审议']];
  reportTable(slide, { table, lead: '逐项核对', note: '范围以预算确认结果为准。', columnWidths: [1, 2, 1] }, theme, 2.25);
  const [lead, grid, note] = objects;
  assert.equal(lead.y, 2.25);
  assert.equal(grid.type, 'table');
  assert.deepEqual(grid.rows.map(row => row.map(cell => cell.text)), table);
  assert.equal(grid.autoPage, false);
  assert.equal(grid.colW[1], grid.colW[0] * 2);
  assert.ok(lead.y + lead.h < grid.y && grid.y + grid.h < note.y);
  assert.ok(note.y + note.h <= 6.85);
});

test('oversize review table reports the need to split before emitting partial content', () => {
  const table = [['需求', '范围'], ...Array.from({ length: 38 }, () => ['条目', '限定'])];
  assert.throws(() => reportTable({}, { table }, theme), /split rows/);
});

test('mixed-script text preserves an explicit paragraph boundary through PPTX export', async () => {
  const JSZip = require('jszip');
  const { createPresentation } = require('./brand_ppt_helpers.cjs');
  const { text } = require('./report_primitives.cjs');
  const pptx = createPresentation();
  text(pptx.addSlide(), '年度复盘\n历史 Brief 复杂样本', 1, 1, 10, 2, theme);
  const zip = await JSZip.loadAsync(await pptx.write({ outputType: 'nodebuffer' }));
  const xml = await zip.file('ppt/slides/slide1.xml').async('string');
  const paragraphs = Array.from(xml.matchAll(/<a:p>[\s\S]*?<\/a:p>/g), ([paragraph]) =>
    Array.from(paragraph.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g), ([, value]) => value).join(''));
  assert.deepEqual(paragraphs, ['年度复盘', '历史 Brief 复杂样本']);
});

test('period matrix keeps period order, missing entries and multiline deliverables in their native cells', () => {
  const { periodMatrix } = require('./dark_report_period_matrix.cjs');
  let cells;
  const slide = { addTable(value) { cells = value; } };
  const page = { corner: '周期', periods: ['上半期', '下半期'], rows: [{ label: '交付', values: ['', '复核\n归档'] }] };
  periodMatrix(slide, page, theme);
  assert.deepEqual(cells.map(row => row.map(cell => cell.text)), [['周期', '上半期', '下半期'], ['交付', '', '复核\n归档']]);
  assert.throws(() => periodMatrix(slide, { ...page, periods: ['上半期'] }, theme), /one value per period/);
});
