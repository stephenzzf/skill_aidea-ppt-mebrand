#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const Module = require('node:module');
const modulesDir = process.env.AIDEA_PPT_NODE_MODULES || process.env.CODEX_NODE_MODULES;
if (modulesDir && fs.existsSync(modulesDir)) {
  process.env.NODE_PATH = [modulesDir, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
  Module._initPaths();
}

const skillDir = path.resolve(__dirname, '..');
const taskDir = fs.mkdtempSync(path.join(os.tmpdir(), 'me2026-qa-contract-'));
const node = process.execPath;
const qa = path.join(skillDir, 'scripts', 'qa_me2026.cjs');
const PptxGenJS = require('pptxgenjs');
const { installCompatibility } = require('./pptx_compatibility.cjs');
const { privateFontConfig, discoverOfficeFontDirs } = require('./qa_render.cjs');

function run(args, label) {
  const result = spawnSync(node, args, { cwd: skillDir, encoding: 'utf8', env: process.env, maxBuffer: 8 * 1024 * 1024 });
  if (result.error) throw result.error;
  fs.writeFileSync(path.join(taskDir, `${label}.log`), `${result.stdout || ''}${result.stderr || ''}`);
  return result;
}

async function main() {
try {
  const officeFontDirs = discoverOfficeFontDirs();
  const defaultFontConfig = privateFontConfig(path.join(taskDir, 'private-fontconfig-default'));
  for (const directory of officeFontDirs) assert.ok(defaultFontConfig.fontDirs.includes(directory), 'installed Office DFonts must enter the task-private Fontconfig search path');
  const powerPointFonts = officeFontDirs.find((directory) => /Microsoft PowerPoint.*\.app/i.test(directory));
  if (powerPointFonts && fs.existsSync('/Applications/Microsoft PowerPoint 2.app/Contents/Resources/DFonts/msyh.ttc')) {
    const fcMatch = spawnSync('fc-match', ['--format', '%{family}|%{file}', 'Microsoft YaHei'], {
      encoding: 'utf8', env: { ...process.env, FONTCONFIG_FILE: defaultFontConfig.configPath, XDG_CACHE_HOME: taskDir },
    });
    assert.equal(fcMatch.status, 0, fcMatch.stderr);
    const [family, fontFile] = fcMatch.stdout.trim().split('|');
    assert.match(family, /Microsoft YaHei/i);
    assert.ok(fontFile.startsWith(powerPointFonts), `fontconfig should resolve the bundled Microsoft YaHei font: ${fontFile}`);
  }
  const explicitFontDir = path.join(taskDir, 'explicit-fonts'); fs.mkdirSync(explicitFontDir);
  const previousFontDirs = process.env.AIDEA_PPT_FONT_DIRS;
  process.env.AIDEA_PPT_FONT_DIRS = explicitFontDir;
  const explicitFontConfig = privateFontConfig(path.join(taskDir, 'private-fontconfig-explicit'));
  if (previousFontDirs === undefined) delete process.env.AIDEA_PPT_FONT_DIRS; else process.env.AIDEA_PPT_FONT_DIRS = previousFontDirs;
  assert.ok(explicitFontConfig.fontDirs.includes(explicitFontDir), 'AIDEA_PPT_FONT_DIRS must be included in the private config');

  const pptx = path.join(taskDir, 'qa-contract.pptx');
  const deck = installCompatibility(new PptxGenJS());
  deck.layout = 'LAYOUT_WIDE';
  deck.author = 'ME2026 QA contract test';
  const slide = deck.addSlide();
  slide.background = { color: 'FFFFFF' };
  slide.addText('QA contract sample', { x: 1, y: 2.4, w: 5, h: 0.65, fontFace: 'Arial', fontSize: 22, color: '000000', margin: 0 });
  await deck.writeFile({ fileName: pptx });
  assert.ok(fs.statSync(pptx).size > 0);

  const previewBase = path.join(taskDir, 'safe-preview-dir');
  fs.mkdirSync(previewBase);
  const sentinel = path.join(previewBase, 'keep.txt');
  fs.writeFileSync(sentinel, 'keep this caller-owned file');
  const ledgerPath = path.join(taskDir, 'no-preview-ledger.json');
  const templatePath = path.join(taskDir, 'review.json');
  const noPreview = run([qa, '--pptx', pptx, '--slides', '1', '--required-text', 'QA contract sample', '--no-preview', '--preview-dir', previewBase, '--ledger', ledgerPath, '--write-review-template', templatePath], 'no-preview');
  assert.equal(noPreview.status, 2, 'skipping render and human review must return partial');
  const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
  assert.equal(ledger.overall, 'partial');
  assert.equal(ledger.categories.render.status, 'not_run');
  assert.equal(ledger.categories.visual.status, 'not_run');
  assert.equal(ledger.categories.content.status, 'not_run');
  assert.ok(['pass', 'fail'].includes(ledger.categories.structure.status));
  assert.ok(['pass', 'fail'].includes(ledger.categories.editability.status));
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'keep this caller-owned file', 'QA must not recursively remove the caller preview directory');
  const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  assert.equal(template.content.status, 'not_run', 'new receipt templates must not self-approve content');
  assert.equal(template.visual.status, 'not_run', 'new receipt templates must not self-approve visuals');
  assert.ok(template.visual.pages.every((page) => !page.rendered_page_sha256 && page.evidence_paths.length === 0));

  const sourceEvidence = path.join(taskDir, 'content-review.md');
  fs.writeFileSync(sourceEvidence, '# Content QA fixture\nThe one-page contract sample is expected to retain its supplied heading.\n');
  const fileHash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const badVisualReceiptPath = path.join(taskDir, 'content-pass-visual-fail.json');
  fs.writeFileSync(badVisualReceiptPath, JSON.stringify({
    schema_version: 1,
    profile: 'new',
    review: { reviewer: 'QA fixture reviewer', reviewed_at: new Date().toISOString() },
    artifact: { path: pptx, sha256: fileHash(pptx) },
    source: null,
    target_slides: [],
    content: { status: 'pass', summary: 'Compared the required heading with the declared fixture.', evidence_paths: [{ path: sourceEvidence, sha256: fileHash(sourceEvidence) }] },
    visual: { status: 'fail', renderer_signature: 'deliberately-stale', pages: [] },
  }, null, 2));
  const receiptQaDir = path.join(taskDir, 'receipt-qa');
  fs.mkdirSync(receiptQaDir);
  const independentReceipt = run([qa, '--pptx', pptx, '--slides', '1', '--required-text', 'QA contract sample', '--preview-dir', receiptQaDir, '--ledger', path.join(receiptQaDir, 'qa.json'), '--review-receipt', badVisualReceiptPath], 'independent-receipt');
  const receiptLedgerPath = path.join(receiptQaDir, 'qa.json');
  assert.ok(fs.existsSync(receiptLedgerPath), 'a full-render QA run must write its evidence ledger');
  const receiptLedger = JSON.parse(fs.readFileSync(receiptLedgerPath, 'utf8'));
  assert.equal(receiptLedger.categories.content.status, 'pass', 'visual receipt failures must not overwrite a valid content review');
  assert.equal(receiptLedger.categories.visual.status, 'fail', 'a stale visual environment binding must fail');
  assert.equal(receiptLedger.categories.render.status, 'pass', `full-page rendering should work in the configured test runtime; stderr is preserved in the ledger: ${JSON.stringify(receiptLedger.rendering?.render_logs)}`);
  assert.equal(independentReceipt.status, 1);
  assert.ok(receiptLedger.rendering.renderer_signature);
  assert.ok(Array.isArray(receiptLedger.rendering.page_images) && receiptLedger.rendering.page_images.length === 1);
  assert.ok(Array.isArray(receiptLedger.rendering.render_logs) && receiptLedger.rendering.render_logs.every((log) => typeof log.raster_stdout === 'string' && typeof log.raster_stderr === 'string'));
  const rendered = receiptLedger.rendering.page_images[0];
  const reviewedPng = path.join(taskDir, 'reviewed-slide.png');
  fs.copyFileSync(rendered.path, reviewedPng);
  const validReceiptPath = path.join(taskDir, 'valid-review.json');
  const makeReceipt = (pageRecords) => ({
    schema_version: 1,
    profile: 'new',
    review: { reviewer: 'QA test fixture only', reviewed_at: new Date().toISOString() },
    artifact: { path: pptx, sha256: fileHash(pptx) },
    source: null,
    target_slides: [],
    content: { status: 'pass', summary: 'Fixture content checked against the QA test heading.', evidence_paths: [{ path: sourceEvidence, sha256: fileHash(sourceEvidence) }] },
    visual: { status: 'pass', renderer_signature: receiptLedger.rendering.renderer_signature, pages: pageRecords },
  });
  const pageRecord = { slide: 1, review_status: 'reviewed', rendered_page_sha256: rendered.sha256, evidence_paths: [{ path: reviewedPng, sha256: fileHash(reviewedPng) }] };
  fs.writeFileSync(validReceiptPath, JSON.stringify(makeReceipt([pageRecord]), null, 2));
  const validReceiptDir = path.join(taskDir, 'valid-receipt-qa'); fs.mkdirSync(validReceiptDir);
  const accepted = run([qa, '--pptx', pptx, '--slides', '1', '--required-text', 'QA contract sample', '--preview-dir', validReceiptDir, '--ledger', path.join(validReceiptDir, 'qa.json'), '--review-receipt', validReceiptPath], 'valid-receipt');
  const acceptedLedger = JSON.parse(fs.readFileSync(path.join(validReceiptDir, 'qa.json'), 'utf8'));
  assert.equal(accepted.status, 0, `valid artifact-bound review evidence should pass: ${JSON.stringify(acceptedLedger.categories)}`);

  const deletedPageReceiptPath = path.join(taskDir, 'deleted-page-review.json');
  fs.writeFileSync(deletedPageReceiptPath, JSON.stringify(makeReceipt([]), null, 2));
  const deletedPageDir = path.join(taskDir, 'deleted-page-qa'); fs.mkdirSync(deletedPageDir);
  const deletedPage = run([qa, '--pptx', pptx, '--slides', '1', '--required-text', 'QA contract sample', '--preview-dir', deletedPageDir, '--ledger', path.join(deletedPageDir, 'qa.json'), '--review-receipt', deletedPageReceiptPath], 'deleted-page');
  const deletedPageLedger = JSON.parse(fs.readFileSync(path.join(deletedPageDir, 'qa.json'), 'utf8'));
  assert.equal(deletedPage.status, 1);
  assert.equal(deletedPageLedger.categories.content.status, 'pass');
  assert.equal(deletedPageLedger.categories.visual.status, 'fail', 'missing slide records must invalidate only visual acceptance');

  const stalePageReceiptPath = path.join(taskDir, 'stale-page-review.json');
  fs.writeFileSync(stalePageReceiptPath, JSON.stringify(makeReceipt([{ ...pageRecord, rendered_page_sha256: 'f'.repeat(64) }]), null, 2));
  const stalePageDir = path.join(taskDir, 'stale-page-qa'); fs.mkdirSync(stalePageDir);
  const stalePage = run([qa, '--pptx', pptx, '--slides', '1', '--required-text', 'QA contract sample', '--preview-dir', stalePageDir, '--ledger', path.join(stalePageDir, 'qa.json'), '--review-receipt', stalePageReceiptPath], 'stale-page');
  const stalePageLedger = JSON.parse(fs.readFileSync(path.join(stalePageDir, 'qa.json'), 'utf8'));
  assert.equal(stalePage.status, 1);
  assert.equal(stalePageLedger.categories.visual.status, 'fail', 'a changed rendered-page hash must invalidate visual acceptance');

  fs.appendFileSync(reviewedPng, Buffer.from('changed after receipt'));
  const staleEvidenceReceiptPath = path.join(taskDir, 'stale-evidence-review.json');
  fs.writeFileSync(staleEvidenceReceiptPath, JSON.stringify(makeReceipt([pageRecord]), null, 2));
  const staleEvidenceDir = path.join(taskDir, 'stale-evidence-qa'); fs.mkdirSync(staleEvidenceDir);
  const staleEvidence = run([qa, '--pptx', pptx, '--slides', '1', '--required-text', 'QA contract sample', '--preview-dir', staleEvidenceDir, '--ledger', path.join(staleEvidenceDir, 'qa.json'), '--review-receipt', staleEvidenceReceiptPath], 'stale-evidence');
  const staleEvidenceLedger = JSON.parse(fs.readFileSync(path.join(staleEvidenceDir, 'qa.json'), 'utf8'));
  assert.equal(staleEvidence.status, 1);
  assert.equal(staleEvidenceLedger.categories.visual.status, 'fail', 'editing an evidence PNG must invalidate its recorded hash');

  const tamperedReceiptPath = path.join(taskDir, 'tampered-artifact-receipt.json');
  const contentOnly = { status: 'pass', summary: 'Bound to this QA fixture content source.', evidence_paths: [{ path: sourceEvidence, sha256: fileHash(sourceEvidence) }] };
  fs.writeFileSync(tamperedReceiptPath, JSON.stringify({
    schema_version: 1, profile: 'new', review: { reviewer: 'QA fixture reviewer', reviewed_at: new Date().toISOString() },
    artifact: { path: pptx, sha256: '0'.repeat(64) }, source: null, target_slides: [],
    content: contentOnly, visual: { status: 'not_run', renderer_signature: '', pages: [] },
  }, null, 2));
  const tamperedLedgerPath = path.join(taskDir, 'tampered-ledger.json');
  const tamperedNoPreview = run([qa, '--pptx', pptx, '--slides', '1', '--no-preview', '--ledger', tamperedLedgerPath, '--review-receipt', tamperedReceiptPath], 'tampered-no-preview');
  assert.equal(tamperedNoPreview.status, 1, 'no-preview must still validate receipt artifact identity');
  const tamperedLedger = JSON.parse(fs.readFileSync(tamperedLedgerPath, 'utf8'));
  assert.equal(tamperedLedger.categories.content.status, 'fail');
  assert.equal(tamperedLedger.categories.render.status, 'not_run');
  const tamperedReceiptOnly = run([qa, '--pptx', pptx, '--slides', '1', '--no-preview', '--ledger', path.join(taskDir, 'tampered-only-ledger.json'), '--review-receipt', tamperedReceiptPath], 'tampered-only-no-preview');
  assert.equal(tamperedReceiptOnly.status, 1, 'the no-preview route must reject a stale bound PPTX hash');

  // Contract-only fixtures prove declared cover backgrounds can be images while
  // an image-only body remains a failure even when the image is allowlisted.
  const whitePng = path.join(taskDir, 'background.png');
  fs.writeFileSync(whitePng, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+nmNsAAAAASUVORK5CYII=', 'base64'));
  const imageOnlyPptx = path.join(taskDir, 'image-only.pptx');
  const imageDeck = installCompatibility(new PptxGenJS()); imageDeck.layout = 'LAYOUT_WIDE';
  const imageSlide = imageDeck.addSlide(); imageSlide.addImage({ path: whitePng, x: 0, y: 0, w: 13.333, h: 7.5 });
  imageSlide.addText('黏贴个人联系方式', { x: 1, y: 2, w: 5, h: 0.5, fontFace: 'Arial', fontSize: 18, color: '000000' });
  await imageDeck.writeFile({ fileName: imageOnlyPptx });
  const decorativeLedgerPath = path.join(taskDir, 'decorative-ledger.json');
  const decorativeImage = run([qa, '--pptx', imageOnlyPptx, '--slides', '1', '--allow-fullslide', '1', '--page-role', '1:cover', '--no-preview', '--ledger', decorativeLedgerPath], 'decorative-image');
  const decorativeLedger = JSON.parse(fs.readFileSync(decorativeLedgerPath, 'utf8'));
  assert.equal(decorativeLedger.categories.editability.status, 'pass', `declared cover background should not be mistaken for body content: ${JSON.stringify(decorativeLedger.categories.editability)}`);
  assert.equal(decorativeImage.status, 2);
  const bodyImageLedgerPath = path.join(taskDir, 'body-image-ledger.json');
  const bodyImage = run([qa, '--pptx', imageOnlyPptx, '--slides', '1', '--allow-fullslide', '1', '--page-role', '1:body', '--no-preview', '--ledger', bodyImageLedgerPath], 'body-image');
  assert.equal(bodyImage.status, 1, 'an allowlisted picture page must still fail when classified as an editable body');
  const bodyImageLedger = JSON.parse(fs.readFileSync(bodyImageLedgerPath, 'utf8'));
  assert.equal(bodyImageLedger.categories.editability.status, 'fail');

  const missingFontPptx = path.join(taskDir, 'missing-font.pptx');
  const missingFontDeck = installCompatibility(new PptxGenJS()); missingFontDeck.layout = 'LAYOUT_WIDE';
  const missingFontSlide = missingFontDeck.addSlide();
  missingFontSlide.addText('QA contract sample', { x: 1, y: 2.4, w: 5, h: 0.65, fontFace: 'ME2026 Font Does Not Exist', fontSize: 22, color: '000000', margin: 0 });
  await missingFontDeck.writeFile({ fileName: missingFontPptx });
  const missingFontDir = path.join(taskDir, 'missing-font-qa'); fs.mkdirSync(missingFontDir);
  const missingFont = run([qa, '--pptx', missingFontPptx, '--slides', '1', '--required-text', 'QA contract sample', '--preview-dir', missingFontDir, '--ledger', path.join(missingFontDir, 'qa.json')], 'missing-font');
  const missingFontLedger = JSON.parse(fs.readFileSync(path.join(missingFontDir, 'qa.json'), 'utf8'));
  assert.equal(missingFont.status, 1);
  assert.equal(missingFontLedger.categories.render.status, 'fail');
  assert.match(JSON.stringify(missingFontLedger.rendering.font_audit), /ME2026 Font Does Not Exist/);
  assert.equal(missingFontLedger.rendering.ok, false, 'a font substitution must block rendering acceptance');

  const rebuildWithoutSource = run([qa, '--pptx', pptx, '--slides', '1', '--profile', 'rebuild'], 'rebuild-without-source');
  assert.equal(rebuildWithoutSource.status, 1, 'rebuild without its source must fail validation');
  const targetedWithoutTarget = run([qa, '--pptx', pptx, '--slides', '1', '--profile', 'targeted-fix', '--source-pptx', pptx], 'targeted-without-target');
  assert.equal(targetedWithoutTarget.status, 1, 'targeted-fix without target slides must fail validation');

  const sourceLayout = path.join(taskDir, 'source-layout.pptx');
  const sourceDeck = installCompatibility(new PptxGenJS()); sourceDeck.layout = 'LAYOUT_WIDE';
  const sourceSlide = sourceDeck.addSlide();
  ['Source title', 'Source subtitle', 'Source body above new header grid'].forEach((text, index) => {
    sourceSlide.addText(text, { x: 1, y: 0.2 + index * 0.5, w: 8, h: 0.3, fontFace: 'Arial', fontSize: 18, color: '000000', margin: 0 });
  });
  await sourceDeck.writeFile({ fileName: sourceLayout });
  for (const profile of ['new', 'rebuild']) {
    const headerLedger = path.join(taskDir, `header-${profile}.json`);
    const result = run([qa, '--pptx', sourceLayout, '--slides', '1', '--profile', profile, '--required-text', 'Source title', '--no-preview', '--ledger', headerLedger, ...(profile === 'rebuild' ? ['--source-pptx', sourceLayout] : [])], `header-${profile}`);
    const report = JSON.parse(fs.readFileSync(headerLedger, 'utf8'));
    assert.equal(report.categories.structure.status, profile === 'new' ? 'fail' : 'pass', 'source-preservation profiles must not impose the new-deck header grid');
    assert.equal(result.status, profile === 'new' ? 1 : 2);
  }

  // Translation profile composes deterministic reconciliation with the same
  // five QA states; a valid mapping alone cannot sign a language review.
  const python = process.env.AIDEA_PPT_PYTHON || 'python3';
  const engine = path.join(skillDir, 'scripts', 'translate_pptx.py');
  const extractionPath = path.join(taskDir, 'translation-extraction.json');
  const extractionResult = spawnSync(python, [engine, 'extract', '--pptx', pptx, '--out', extractionPath], { encoding: 'utf8' });
  assert.equal(extractionResult.status, 0, extractionResult.stderr);
  const extracted = JSON.parse(fs.readFileSync(extractionPath, 'utf8'));
  const mappingPath = path.join(taskDir, 'translation-mapping.json');
  fs.writeFileSync(mappingPath, JSON.stringify({schema_version: 1, source_sha256: extracted.source_sha256, translator: 'QA fixture translator', units: extracted.units.map(unit => ({id: unit.id, source_text: unit.source_text, segments: unit.segments, status: 'preserve', reason: 'This fixture is already English.'}))}, null, 2));
  const translatedPptx = path.join(taskDir, 'translated-fixture.pptx');
  const applyReportPath = path.join(taskDir, 'translation-apply.json');
  const applyResult = spawnSync(python, [engine, 'apply', '--pptx', pptx, '--mapping', mappingPath, '--out', translatedPptx, '--report', applyReportPath], {encoding: 'utf8'});
  assert.equal(applyResult.status, 0, applyResult.stderr);
  const translationArgs = [qa, '--pptx', translatedPptx, '--slides', '1', '--profile', 'translate', '--source-pptx', pptx, '--translation-mapping', mappingPath, '--translation-report', applyReportPath, '--no-preview'];
  const translateLedgerPath = path.join(taskDir, 'translation-qa.json');
  const translateResult = run([...translationArgs, '--ledger', translateLedgerPath], 'translation-partial');
  const translateLedger = JSON.parse(fs.readFileSync(translateLedgerPath, 'utf8'));
  assert.equal(translateResult.status, 2);
  assert.equal(translateLedger.translation.reconciliation.status, 'pass');
  assert.equal(translateLedger.categories.content.status, 'not_run');
  assert.equal(translateLedger.translation.language_review, 'not_run');
  const invalidAdaptationsPath = path.join(taskDir, 'invalid-translation-adaptations.json');
  fs.writeFileSync(invalidAdaptationsPath, JSON.stringify({schema_version: 1, mode: 'translation-post-layout'}));
  const invalidAdaptationsLedgerPath = path.join(taskDir, 'translation-invalid-adaptations-qa.json');
  const invalidAdaptations = run([...translationArgs, '--translation-adaptations', invalidAdaptationsPath, '--ledger', invalidAdaptationsLedgerPath], 'translation-invalid-adaptations');
  assert.equal(invalidAdaptations.status, 1, 'a stale/incomplete adaptation journal must fail the translate profile');
  const invalidAdaptationsLedger = JSON.parse(fs.readFileSync(invalidAdaptationsLedgerPath, 'utf8'));
  assert.equal(invalidAdaptationsLedger.translation.reconciliation.checks.authorized_post_translation_adaptations, 'fail');
  assert.equal(invalidAdaptationsLedger.translation.adaptations.sha256, fileHash(invalidAdaptationsPath));
  const applyReport = JSON.parse(fs.readFileSync(applyReportPath, 'utf8')); applyReport.output_sha256 = '0'.repeat(64);
  fs.writeFileSync(applyReportPath, JSON.stringify(applyReport));
  const staleTranslationLedgerPath = path.join(taskDir, 'translation-stale-qa.json');
  const staleTranslation = run([...translationArgs, '--ledger', staleTranslationLedgerPath], 'translation-stale');
  assert.equal(staleTranslation.status, 1, 'a stale apply report must fail, not merely become partial');
  assert.equal(JSON.parse(fs.readFileSync(staleTranslationLedgerPath, 'utf8')).categories.content.status, 'fail');
  const missingTranslationEvidence = run([qa, '--pptx', translatedPptx, '--slides', '1', '--profile', 'translate', '--source-pptx', pptx, '--no-preview'], 'translation-no-mapping');
  assert.equal(missingTranslationEvidence.status, 1);

  const imageExtractionPath = path.join(taskDir, 'image-translation-extraction.json');
  const imageExtract = spawnSync(python, [engine, 'extract', '--pptx', imageOnlyPptx, '--out', imageExtractionPath], {encoding: 'utf8'});
  assert.equal(imageExtract.status, 0, imageExtract.stderr);
  const imageExtraction = JSON.parse(fs.readFileSync(imageExtractionPath, 'utf8'));
  const mediaPart = imageExtraction.inventory.media_parts[0];
  const imageMappingUnits = imageExtraction.units.map(unit => ({id: unit.id, source_text: unit.source_text, segments: unit.segments.map(text => text === '黏贴个人联系方式' ? 'Add Your Contact Details' : text), status: unit.source_text === '黏贴个人联系方式' ? 'translated' : 'preserve', reason: 'Contract-only fixture'}));
  for (const guard of ['valid', 'missing-translator', 'same-reviewer', 'missing-image', 'duplicate-image', 'unresolved-image', 'stale-image-hash']) {
    const mapPath = path.join(taskDir, `guard-${guard}-map.json`);
    fs.writeFileSync(mapPath, JSON.stringify({schema_version: 1, source_sha256: imageExtraction.source_sha256, ...(guard === 'missing-translator' ? {} : {translator: 'QA translator'}), units: imageMappingUnits}));
    const candidate = path.join(taskDir, `guard-${guard}.pptx`);
    const applyPath = path.join(taskDir, `guard-${guard}-apply.json`);
    const applied = spawnSync(python, [engine, 'apply', '--pptx', imageOnlyPptx, '--mapping', mapPath, '--out', candidate, '--report', applyPath], {encoding: 'utf8'});
    assert.equal(applied.status, 0, applied.stderr);
    const disposition = {part: mediaPart, disposition: guard === 'unresolved-image' ? 'unresolved' : 'no_translation_needed', reason: 'This QA fixture contains an empty white image, not translated content.'};
    const imageItems = guard === 'missing-image' ? [] : guard === 'duplicate-image' ? [disposition, disposition] : [disposition];
    const guardReceipt = {
      schema_version: 1, profile: 'translate', review: {reviewer: 'Synthetic QA fixture reviewer', reviewed_at: new Date().toISOString()},
      artifact: {path: candidate, sha256: fileHash(candidate)}, source: {path: imageOnlyPptx, sha256: fileHash(imageOnlyPptx)},
      source_evidence_paths: [{slide: 1, path: whitePng, sha256: fileHash(whitePng)}],
      content: {status: 'pass', summary: 'Synthetic QA fixture: the sole contact text is translated.', evidence_paths: [{path: sourceEvidence, sha256: fileHash(sourceEvidence)}]},
      visual: {status: 'not_run', pages: []},
      translation: {mapping_sha256: fileHash(mapPath), report_sha256: fileHash(applyPath), language: {status: 'pass', reviewer: guard === 'same-reviewer' ? ' qa TRANSLATOR ' : 'Independent QA fixture reviewer', summary: 'Contract fixture only, not user-deck acceptance.', evidence_paths: [{path: sourceEvidence, sha256: fileHash(sourceEvidence)}]}, image_review: {status: 'pass', source_sha256: guard === 'stale-image-hash' ? '0'.repeat(64) : fileHash(imageOnlyPptx), items: imageItems}},
    };
    const guardReceiptPath = path.join(taskDir, `guard-${guard}-receipt.json`); fs.writeFileSync(guardReceiptPath, JSON.stringify(guardReceipt));
    const guardLedger = path.join(taskDir, `guard-${guard}-qa.json`);
    const guardResult = run([qa, '--pptx', candidate, '--source-pptx', imageOnlyPptx, '--slides', '1', '--profile', 'translate', '--page-role', '1:cover', '--translation-mapping', mapPath, '--translation-report', applyPath, '--review-receipt', guardReceiptPath, '--no-preview', '--ledger', guardLedger], `guard-${guard}`);
    const guardReport = JSON.parse(fs.readFileSync(guardLedger, 'utf8'));
    assert.equal(guardResult.status, guard === 'valid' ? 2 : 1, JSON.stringify(guardReport.categories));
    assert.equal(guardReport.categories.content.status, guard === 'valid' ? 'pass' : 'fail');
    if (guard === 'missing-translator') assert.match(guardReport.categories.content.details.join(' '), /non-empty translator identity/);
    if (guard === 'same-reviewer') assert.match(guardReport.categories.content.details.join(' '), /different from the translator/);
    if (guard === 'missing-image') assert.match(guardReport.categories.content.details.join(' '), /missing 1 source media/);
    if (guard === 'duplicate-image') assert.match(guardReport.categories.content.details.join(' '), /duplicate translation image/);
    if (guard === 'unresolved-image') assert.match(guardReport.categories.content.details.join(' '), /unresolved raster text/);
    if (guard === 'stale-image-hash') assert.match(guardReport.categories.content.details.join(' '), /source hash is missing or stale/);
  }

  console.log(`PASS: QA route and evidence-state contracts (${taskDir})`);
} catch (error) {
  console.error(error);
  console.error(`QA test artifacts preserved at ${taskDir}`);
  process.exitCode = 1;
}

}

main().catch((error) => { console.error(error); process.exitCode = 1; });
