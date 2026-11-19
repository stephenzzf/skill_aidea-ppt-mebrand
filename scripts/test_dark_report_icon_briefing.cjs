const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const JSZip = require('jszip');
const { generate } = require('./dark_report.cjs');

const items = [
  { icon: 'operations', title: '检修派单', detail: '把到站时间和维修窗口写入任务。' },
  { icon: 'consult-verified', title: '复核交付', detail: '两名检修员分别确认压力与温度。' },
];
const page = { role: 'icon-briefing', title: '车辆日常检修', section: '交付',
  lead: '班组依次核对两类记录。', items, note: '记录由当班负责人保存。', notes: '合成检修业务' };
const deck = slides => ({ title: '车辆维护', navigation: ['交付'], slides });
async function temp(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'me-icon-briefing-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return path.join(dir, 'briefing.pptx');
}

test('rows and columns export registered glyphs and independent editable text', async t => {
  const out = await temp(t);
  await generate(deck([page, { ...page, layout: 'columns' }]), out, 'report');
  const zip = await JSZip.loadAsync(await fs.readFile(out));
  for (const index of [1, 2]) {
    const xml = await zip.file('ppt/slides/slide'+index+'.xml').async('string');
    const pictures = xml.match(/<p:pic>[\s\S]*?<\/p:pic>/g) || [];
    const texts = Array.from(xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g), m =>
      Array.from(m[0].matchAll(/<a:t>(.*?)<\/a:t>/g), run => run[1]).join(''));
    for (const item of items) {
      assert.equal(pictures.filter(pic => pic.includes('name="ME2026_ICON:'+item.icon+'"')).length, 1);
      assert.ok(texts.includes(item.title));
      assert.ok(texts.includes(item.detail));
    }
    assert.ok(texts.includes(page.lead));
    assert.ok(texts.includes(page.note));
  }
});

test('invalid icon keys, layouts, counts, missing qualifiers and oversized copy fail before export', async t => {
  const out = await temp(t);
  for (const [change, expected] of [
    [{ layout:'cards' }, /rows or columns/],
    [{ items:[items[0]] }, /two to four/],
    [{ items:[items[0], { ...items[1], icon:'unregistered-key' }] }, /Unknown semantic icon/],
    [{ items:[items[0], { ...items[1], detail:'' }] }, /nonempty detail/],
    [{ layout:'columns', items:[items[0], { ...items[1], detail:'压力与温度记录'.repeat(90) }] }, /does not fit/],
  ]) await assert.rejects(generate(deck([{ ...page, ...change }]), out, 'report'), expected);
  await assert.rejects(fs.stat(out), { code:'ENOENT' });
});

test('short comparisons occupy a compact band and longer descriptions expand the cards', async t => {
  const out = await temp(t);
  const short = { ...page, layout:'columns' };
  const longer = { ...short, items:items.map(item => ({ ...item, detail:item.detail.repeat(6) })) };
  await generate(deck([short, longer]), out, 'report');
  const zip = await JSZip.loadAsync(await fs.readFile(out));
  const cards = async number => {
    const xml = await zip.file('ppt/slides/slide'+number+'.xml').async('string');
    return Array.from(xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g), ([shape]) => {
      const loc = shape.match(/<a:off x="(\d+)" y="(\d+)"[^>]*\/>\s*<a:ext cx="(\d+)" cy="(\d+)"/);
      if (loc && Number(loc[3]) / 914400 > 5 && Number(loc[3]) / 914400 < 6.1 && !shape.includes('<a:t>')) {
        return { top:Number(loc[2]), height:Number(loc[4]) };
      }
    }).filter(Boolean);
  };
  const compact = await cards(1), expanded = await cards(2);
  assert.equal(compact.length, 2);
  assert.equal(expanded.length, 2);
  assert.deepEqual(compact[0], compact[1]);
  assert.ok(compact[0].top > expanded[0].top);
  assert.ok(compact[0].height < expanded[0].height);
});
