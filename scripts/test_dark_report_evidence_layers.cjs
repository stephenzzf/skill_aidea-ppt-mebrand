const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { promisify } = require('node:util');
const execFile = promisify(require('node:child_process').execFile);
const JSZip = require('jszip');
const { generate } = require('./dark_report.cjs');

const repair = { role: 'evidence-layers', title: '维修响应已有记录，返修仍待跟踪', section: '复盘',
  layers: [
    { label: '响应', status: 'observed', result: '12 小时', detail: '本期受理至首次回复的中位数。' },
    { label: '返修', status: 'unavailable', result: '未统计', detail: '缺少维修后的跟踪记录。' },
  ],
  contextHeading: '工单范围', context: [{ label: '样本', detail: '仅包含试点网点的已关闭工单。' }],
  note: '统计窗口为四月。', notes: '本页仅用于版式回归。' };
const deck = p => ({ title: '运行复盘', navigation: ['复盘'], slides: [p] });
async function temp(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'evidence-layers-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}

test('public CLI builds layered observations with one code image and editable business text', async t => {
  const dir = await temp(t);
  await fs.writeFile(path.join(dir, 'brief.json'), JSON.stringify(deck(repair)));
  await execFile(process.execPath, [path.join(__dirname, 'generate_me2026_deck.cjs'), '--style', 'dark-report',
    '--use', 'report', '--input', 'brief.json', '--out', 'out.pptx'], { cwd: dir });
  const zip = await JSZip.loadAsync(await fs.readFile(path.join(dir, 'out.pptx')));
  const xml = await zip.file('ppt/slides/slide1.xml').async('string');
  const shapes = Array.from(xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g), m =>
    Array.from(m[0].matchAll(/<a:t>(.*?)<\/a:t>/g), r => r[1]).join(''));
  for (const item of repair.layers) for (const field of ['label', 'result', 'detail']) assert.ok(shapes.includes(item[field]));
  for (const field of [repair.contextHeading, repair.context[0].label, repair.context[0].detail, repair.note]) assert.ok(shapes.includes(field));
  assert.equal((xml.match(/name="ME_REPORT_EVIDENCE_PLATES"/g) || []).length, 1);
  assert.match(await zip.file('ppt/notesSlides/notesSlide1.xml').async('string'), /本页仅用于版式回归/);
});

test('rejects invalid evidence status, missing data copy and content exceeding its text frame', async t => {
  const dir = await temp(t);
  for (const [page, message] of [
    [{ ...repair, layers: [repair.layers[0], { ...repair.layers[1], status: 'assumed' }] }, /status/],
    [{ ...repair, layers: [repair.layers[0], { ...repair.layers[1], result: '' }] }, /requires text/],
    [{ ...repair, context: [] }, /context entries/],
    [{ ...repair, context: [{ label: '范围', detail: '这是一段很长的测量说明。'.repeat(80) }] }, /does not fit/],
  ]) {
    await assert.rejects(generate(deck(page), path.join(dir, 'invalid.pptx'), 'report'), message);
  }
  assert.deepEqual(await fs.readdir(dir), []);
});
