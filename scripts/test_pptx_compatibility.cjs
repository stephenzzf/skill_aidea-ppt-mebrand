#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const H = require('./brand_ppt_helpers.cjs');
const JSZip = require('jszip');
const PptxGenJS = require('pptxgenjs');
const { normalizePptx } = require('./pptx_compatibility.cjs');
const task = fs.mkdtempSync(path.join(os.tmpdir(), 'me-pptx-compatibility-'));
const python = process.env.AIDEA_PPT_PYTHON || 'python3';

async function check(data, label) {
  const file = path.join(task, `${label}.pptx`);
  fs.writeFileSync(file, data);
  const result = spawnSync(python, [path.join(__dirname, 'pptx_package_checks.py'), file], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return JSZip.loadAsync(data);
}

(async () => {
  // Exercise the real serializer, including the same table alias and chart
  // that passed LibreOffice while failing native PowerPoint.
  const rawDeck = new PptxGenJS(); rawDeck.layout = 'LAYOUT_WIDE';
  const slide = rawDeck.addSlide(); slide.addNotes('Preserve source and speaker notes 123');
  slide.addTable([['Metric', 'Value'], ['Sample', '61.2']], { x: 1, y: 2, w: 5, rowH: 0.5, valign: 'mid' });
  slide.addText('Keep this native text', { x: 1, y: 4, w: 5, h: 1 });
  slide.addChart(rawDeck.ChartType.bar, [{ name: 'Score', labels: ['K3','K3.1 Pro'], values: [55.95,61.2] }], { x: 7, y: 2, w: 5, h: 4 });
  rawDeck.addSlide().addText('Second page', { x: 1, y: 2, w: 6, h: 1 });
  const raw = await rawDeck.write({ outputType: 'nodebuffer' });
  const result = await normalizePptx(raw);
  const codes = new Set(result.changes.map(c => c.code));
  for (const code of ['phantom-master-override','shared-notes-theme','presentation-child-order','orphan-2d-chart-axis','invalid-text-anchor','xlsx-table-range']) assert.ok(codes.has(code), code);
  const fixed = await check(result.data, 'real-serializer-fixed');
  const original = await JSZip.loadAsync(raw);
  assert.equal(await fixed.file('ppt/notesMasters/notesMaster1.xml').async('string'), await original.file('ppt/notesMasters/notesMaster1.xml').async('string'), 'Notes master placeholders must be preserved');
  assert.equal(await fixed.file('ppt/notesSlides/notesSlide1.xml').async('string'), await original.file('ppt/notesSlides/notesSlide1.xml').async('string'), 'Speaker notes must be preserved');
  assert.equal(await fixed.file('ppt/theme/theme2.xml').async('string'), await fixed.file('ppt/theme/theme1.xml').async('string'), 'Separate notes theme retains ME style');
  const second = await normalizePptx(result.data);
  assert.equal(second.changes.length, 0, 'Normalization is idempotent');
  assert.deepEqual(second.data, result.data);

  const absolute = await JSZip.loadAsync(raw);
  for (const part of Object.keys(absolute.files).filter(n => /^ppt\/(?:notesMasters|slideMasters)\/_rels\/.*\.rels$/.test(n))) {
    const xml = await absolute.file(part).async('string');
    absolute.file(part, xml.replace('Target="../theme/theme1.xml"', 'Target="/ppt/theme/theme1.xml"'));
  }
  const absoluteFixed = await normalizePptx(await absolute.generateAsync({ type: 'nodebuffer' }));
  await check(absoluteFixed.data, 'absolute-theme-targets');
  assert.ok(absoluteFixed.changes.some(c => c.code === 'shared-notes-theme'));

  // Public authoring APIs must all use the same normalizer.
  for (const type of ['nodebuffer','base64','arraybuffer','uint8array','blob']) {
    const deck = H.createPresentation(); deck.addSlide().addText('Native body', { x: 1, y: 2, w: 6, h: 1 });
    const output = await deck.write({ outputType: type });
    const data = type === 'base64' ? Buffer.from(output, 'base64') : type === 'blob' ? Buffer.from(await output.arrayBuffer()) : Buffer.from(output);
    await check(data, `public-${type}`);
  }
  const deck = H.createPresentation(); deck.addSlide().addText('File output', { x: 1, y: 2, w: 6, h: 1 });
  const filename = path.join(task, 'public-writeFile.pptx');
  assert.equal(await deck.writeFile({ fileName: filename }), filename);
  await check(fs.readFileSync(filename), 'writeFile-verified');
  const streamed = await deck.stream();
  assert.ok(Buffer.isBuffer(streamed));
  await check(streamed, 'public-stream');

  // Valid 3D axes/custom masters must not be removed as phantom parts.
  const three = new PptxGenJS(); three.layout = 'LAYOUT_WIDE';
  three.defineSlideMaster({ title: 'CUSTOM', objects: [] });
  const s3 = three.addSlide('CUSTOM');
  s3.addChart(three.ChartType.bar3d, [{ name: 'Data', labels: ['a','b'], values: [1,2] }], { x: 1, y: 2, w: 6, h: 4 });
  const raw3 = await three.write({ outputType: 'nodebuffer' });
  const normalized3 = await normalizePptx(raw3);
  const zip3 = await check(normalized3.data, '3d-custom-master');
  const chart3 = Object.keys(zip3.files).find(n => /^ppt\/charts\/chart\d+\.xml$/.test(n));
  assert.match(await zip3.file(chart3).async('string'), /<c:serAx>/);
  assert.ok(zip3.file('ppt/slideMasters/slideMaster1.xml'));

  const ambiguous = await JSZip.loadAsync(result.data);
  const duplicate = '<p:sld xmlns:p="p" xmlns:a="a"><p:cNvPr id="2"/><p:cNvPr id="2"/><a:stCxn id="2"/></p:sld>';
  ambiguous.file('ppt/slides/slide1.xml', duplicate);
  const ambiguousData = await ambiguous.generateAsync({ type: 'nodebuffer' });
  await assert.rejects(() => normalizePptx(ambiguousData), /Ambiguous duplicate/);
  console.log(`PASS: serializer repair, idempotence, absolute theme targets, notes/data preservation, 7 public exports, 3D/custom master, ambiguous reference guard. Evidence: ${task}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
