const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const JSZip = require('jszip');
const { createPresentation } = require('./brand_ppt_helpers.cjs');
const { caseEvidence } = require('./dark_report_case_evidence.cjs');

const theme = { ink: '2E1F6B', body: '4D4A66', violet: '5C0BE0', tint: 'F4F1FB', rule: 'DFDCE8', cjk: '等线', latin: 'Poppins' };
async function sample() {
  const img = await sharp({ create: { width: 8, height: 6, channels: 4, background: { r: 200, g: 0, b: 2, alpha: 0 } } }).png().toBuffer();
  const png = Buffer.concat([img, Buffer.from('PRIVATE_TRAILING_SOURCE')]).toString('base64');
  return { lead: '测试范围', evidenceTitle: '回答样本', actions: ['比较样本'], actionTitle: '动作',
    evidence: [{ png, caption: '模型 A', source: '样本 1', protection: 'flattened-redaction' }],
    note: '指定样本仅说明当次观察', trend: { title: '同口径趋势', scope: '相对首月累计变化', metric: '+5%',
      metricScope: '从首月至次月', seriesName: '累计变化', labels: ['四月', '五月'], values: [0, 5] } };
}

test('native chart and workbook carry the same periods and values; only opaque visible pixels enter the package', async () => {
  const p = createPresentation();
  await caseEvidence(p.addSlide(), p, await sample(), theme);
  const z = await JSZip.loadAsync(await p.write({ outputType: 'nodebuffer' }));
  const chart = await z.file(/^ppt\/charts\/chart\d+\.xml$/)[0].async('string');
  for (const value of ['四月', '五月', '0', '5']) assert.ok(chart.includes('<c:v>' + value + '</c:v>'));
  const embedded = await JSZip.loadAsync(await z.file(/^ppt\/embeddings\/.*\.xlsx$/)[0].async('nodebuffer'));
  const cells = await embedded.file('xl/worksheets/sheet1.xml').async('string');
  assert.match(cells, /r="B2"[^>]*><v>0<\/v>/);
  assert.match(cells, /r="B3"[^>]*><v>5<\/v>/);
  const files = z.file(/^ppt\/media\/.*\.png$/); assert.equal(files.length, 1);
  const png = await files[0].async('nodebuffer');
  assert.equal(png.includes(Buffer.from('PRIVATE_TRAILING_SOURCE')), false);
  const metadata = await sharp(png).metadata(); assert.equal(metadata.hasAlpha, false);
  const pixels = await sharp(png).raw().toBuffer(); assert.ok(pixels.every(c => c === 255));
});

test('rejects unprepared sources and mismatched numeric series', async () => {
  const p = createPresentation(), page = await sample();
  await assert.rejects(caseEvidence(p.addSlide(), p, { ...page, trend: { ...page.trend, values: [] } }, theme), /matching finite numeric/);
  await assert.rejects(caseEvidence(p.addSlide(), p, { ...page, evidence: [{ ...page.evidence[0], protection: 'original' }] }, theme), /declaration/);
  await assert.rejects(caseEvidence(p.addSlide(), p, { ...page, evidence: [{ ...page.evidence[0], png: Buffer.from('not PNG').toString('base64') }] }, theme), /PNG signature/);
});

test('screenshot case pairs the featured and supporting pictures with editable claims and the sample boundary', async () => {
  const p = createPresentation(), page = await sample();
  const second = { ...page.evidence[0], caption: '模型 B', detail: '指定问法中列出官网' };
  await caseEvidence(p.addSlide(), p, { ...page, trend: undefined,
    evidence: [...page.evidence, second], evidenceScope: '同日同市场',
    goalTitle: '目标', goal: '核查推荐', actions: [{ title: '核对', detail: '查看引用' }],
    resultTitle: '当次结果', result: '品牌出现在样本中' }, theme);
  const zip = await JSZip.loadAsync(await p.write({ outputType: 'nodebuffer' }));
  const slide = await zip.file('ppt/slides/slide1.xml').async('string');
  assert.equal((slide.match(/<p:pic>/g) || []).length, 2);
  for (const copy of ['核查推荐', '同日同市场', second.detail, page.note]) assert.ok(slide.includes(copy));
  assert.equal(zip.file(/^ppt\/charts\/chart\d+\.xml$/).length, 0);
});
