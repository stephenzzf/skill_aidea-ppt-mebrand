#!/usr/bin/env node
const { resolvePython } = require("./python_runtime.cjs");
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
const python = resolvePython().executable;

async function check(data, label) {
  const file = path.join(task, `${label}.pptx`);
  fs.writeFileSync(file, data);
  const result = spawnSync(python, [path.join(__dirname, 'pptx_package_checks.py'), file], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return JSZip.loadAsync(data);
}

(async () => {
  // Office refreshes the chart cache from Excel after editing another value.
  // Preserve an explicit baseline observation and leave unmeasured periods blank.
  const observations = H.createPresentation();
  observations.addSlide().addChart(observations.ChartType.line,
    [{ name: 'Observed', labels: ['April', 'May', 'June'], values: [0, null, 85] }],
    { x: 1, y: 1, w: 5, h: 3 });
  const observedZip = await JSZip.loadAsync(await observations.write({ outputType: 'nodebuffer' }));
  const xlsx = await observedZip.file(/^ppt\/embeddings\/.*\.xlsx$/)[0].async('nodebuffer');
  const worksheet = await (await JSZip.loadAsync(xlsx)).file('xl/worksheets/sheet1.xml').async('string');
  assert.match(worksheet, /<c r="B2"><v>0<\/v><\/c>/);
  assert.match(worksheet, /<c r="B3"><v><\/v><\/c>/);
  assert.match(worksheet, /<c r="B4"><v>85<\/v><\/c>/);

  // Exercise the real serializer, including the same table alias and chart
  // that passed LibreOffice while failing native PowerPoint.
  const rawDeck = new PptxGenJS(); rawDeck.layout = 'LAYOUT_WIDE';
  const slide = rawDeck.addSlide(); slide.addNotes('Preserve source and speaker notes 123');
  slide.addTable([['Metric', 'Value'], ['Sample', '61.2']], { x: 1, y: 2, w: 5, rowH: 0.5, valign: 'mid' });
  slide.addText('Keep this native text', { x: 1, y: 4, w: 5, h: 1 });
  slide.addChart(rawDeck.ChartType.bar, [{ name: 'Score', labels: ['K3','K3.1 Pro'], values: [55.95,61.2] }], { x: 7, y: 2, w: 5, h: 4 });
  slide.addText([
    { text: 'Qualified target ', options: { color: '2E1F6B' } },
    { text: '100%', options: { color: '5C0BE0', bold: true } },
  ], { x: 1, y: 5, w: 5, h: 1, align: 'left', margin: 0 });
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
  const part = 'ppt/slides/slide1.xml';
  const rawSlide = await original.file(part).async('string');
  const richParagraph = rawSlide.match(/<a:p>(?:(?!<\/a:p>)[\s\S])*?Qualified target (?:(?!<\/a:p>)[\s\S])*?<\/a:p>/)[0];
  const definitions = richParagraph.match(/<a:pPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:pPr>)/g);
  assert.ok(definitions.length > 1, 'Exercise the pinned rich-run defect');
  const expectedParagraph = richParagraph.replace(definitions[0], '').split(definitions[0]).join('').replace('<a:p>', '<a:p>' + definitions[0]);
  assert.ok((await fixed.file(part).async('string')).includes(expectedParagraph), 'Preserve both text runs and their exact formatting');
  const conflicting = await JSZip.loadAsync(raw);
  conflicting.file(part, rawSlide.replace(richParagraph, richParagraph.replace(definitions[0], definitions[0].replace('algn="l"', 'algn="r"'))));
  await assert.rejects(normalizePptx(await conflicting.generateAsync({ type: 'nodebuffer' })), /Conflicting rich-text paragraph properties/);
  for (const align of ['l', 'r']) {
    const field = `<a:p><a:pPr algn="l"/><a:fld id="{11111111-1111-1111-1111-111111111111}" type="slidenum"><a:pPr algn="${align}"/><a:t>5</a:t></a:fld></a:p>`;
    const withField = await JSZip.loadAsync(result.data);
    withField.file(part, rawSlide.replace(richParagraph, field));
    const fieldResult = await normalizePptx(await withField.generateAsync({ type: 'nodebuffer' }));
    const preserved = await JSZip.loadAsync(fieldResult.data);
    assert.ok((await preserved.file(part).async('string')).includes(field), 'Preserve properties inside DrawingML fields');
  }
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
