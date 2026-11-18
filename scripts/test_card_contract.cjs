#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const H = require('./brand_ppt_helpers.cjs');
const JSZip = require('jszip');

const EMU_PER_INCH = 914400;
const task = fs.mkdtempSync(path.join(os.tmpdir(), 'me-card-contract-'));

function decodeXml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function textOfShape(xml) {
  return [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
    .map(match => decodeXml(match[1]))
    .join('');
}

function boundsOfShape(xml) {
  const transform = xml.match(/<a:xfrm\b[^>]*>[\s\S]*?<a:off\s+x="([\d-]+)"\s+y="([\d-]+)"\s*\/>[\s\S]*?<a:ext\s+cx="([\d-]+)"\s+cy="([\d-]+)"\s*\/>/);
  assert.ok(transform, `Shape is missing geometry: ${textOfShape(xml)}`);
  const [, x, y, cx, cy] = transform.map(Number);
  return { x: x / EMU_PER_INCH, y: y / EMU_PER_INCH, w: cx / EMU_PER_INCH, h: cy / EMU_PER_INCH };
}

function shapeContaining(shapes, text) {
  const shape = shapes.find(candidate => textOfShape(candidate).includes(text));
  assert.ok(shape, `Missing editable text shape containing: ${text}`);
  return shape;
}

function allShapes(xml) {
  return [...xml.matchAll(/<p:sp\b[\s\S]*?<\/p:sp>/g)].map(match => match[0]);
}

function autofitKind(shape) {
  const bodyProperties = shape.match(/<a:bodyPr\b[^>]*>([\s\S]*?)<\/a:bodyPr>/);
  assert.ok(bodyProperties, `Missing text body properties for: ${textOfShape(shape)}`);
  const body = bodyProperties[1];
  if (/<a:normAutofit\b/.test(body)) return 'shrink';
  if (/<a:spAutoFit\b/.test(body)) return 'resize-shape';
  if (/<a:noAutofit\b/.test(body)) return 'no-autofit-tag';
  return 'fixed';
}

function fontSizes(shape) {
  return [...shape.matchAll(/<a:rPr\b[^>]*\bsz="(\d+)"/g)].map(match => Number(match[1]) / 100);
}

function roundRectAt(shapes, expected) {
  const shape = shapes.find(candidate => {
    if (!/<a:prstGeom\b[^>]*\bprst="roundRect"/.test(candidate)) return false;
    const bounds = boundsOfShape(candidate);
    return Math.abs(bounds.x - expected.x) < 0.01 && Math.abs(bounds.y - expected.y) < 0.01;
  });
  assert.ok(shape, `Missing rounded card at ${expected.x}, ${expected.y}`);
  return boundsOfShape(shape);
}

(async () => {
  const pptx = H.createPresentation({ title: 'ME2026 card contract' });
  const slide = pptx.addSlide();

  // Preserve existing default behavior, while allowing callers to explicitly
  // suppress shrink even when they inherited a helper configuration using it.
  H.addText(slide, 'Legacy default remains shrink', 0.5, 0.4, 5.6, 0.45, { size: 18 });
  H.addText(slide, 'Explicit shrink request is overridden', 0.5, 0.95, 5.6, 0.45, {
    size: 18,
    fit: 'shrink',
    autoShrink: false,
  });
  H.addText(slide, 'CJK English fixed-size heading', 0.5, 1.5, 5.6, 0.45, {
    size: 22,
    autoShrink: false,
  });

  await H.prepareME2026IconCache(['growth', 'automation', 'conversion', 'strategy', 'Target'], [H.C.blue]);
  H.addME2026IconTitleCard(slide, pptx, {
    x: 1,
    y: 2.15,
    w: 5.2,
    h: 2.8,
    icon: 'growth',
    title: '长标题 Long English title',
    titleSize: 24,
    body: '第一行：保持中文原文\nSecond line: preserve English copy',
    bodySize: 20,
    bodyY: 1.02,
    bodyH: 1.42,
    bodyBottomPad: 0.18,
    autoShrink: false,
  });
  H.addME2026StackedIconRow(slide, pptx, {
    x: 7,
    y: 2.15,
    w: 5.2,
    h: 1.42,
    icon: 'automation',
    title: '流程标题 Process title',
    body: '流程说明第一行\nProcess explanation second line',
    titleSize: 22,
    titleH: 0.32,
    titleY: 0.2,
    bodySize: 20,
    bodyH: 0.54,
    autoShrink: false,
  });
  H.addME2026LabelTextRow(slide, pptx, {
    x: 1,
    y: 5.35,
    rowH: 0.78,
    label: '策略 Strategy',
    labelW: 2.0,
    labelSize: 20,
    body: '完整说明 Full explanation remains at its chosen font size',
    bodyW: 9.4,
    bodyH: 0.72,
    bodySize: 18,
    autoShrink: false,
  });
  H.addME2026IconTitleCard(slide, pptx, {
    x: 7,
    y: 4.0,
    w: 5.2,
    h: 2.3,
    icon: 'strategy',
    title: '带项目符号的策略卡',
    titleSize: 22,
    bulletY: 0.95,
    bulletGap: 0.45,
    bulletSize: 20,
    bullets: ['第一条内容 First bullet item', '第二条内容 Second bullet item'],
    autoShrink: false,
  });
  H.iconTextRow(slide, pptx, 'Target', 1, 6.35, 11, {
    title: '目标',
    titleW: 1.0,
    titleSize: 20,
    body: '说明文字 Description remains editable and fixed-size',
    bodyH: 0.58,
    bodySize: 18,
    autoShrink: false,
  });

  const titleSlide = pptx.addSlide();
  H.addME2026WhiteBase(titleSlide, pptx,
    'ME2026 长标题：客户服务如何从广告入口继续延伸', 2,
    {
      titleSize: 28,
      subtitle: '方案结构与品牌触点协同',
      subtitleSize: 20,
      autoShrink: false,
    });

  const buffer = await pptx.write({ outputType: 'nodebuffer' });
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('ppt/slides/slide1.xml').async('string');
  const shapes = allShapes(xml);
  const titleXml = await zip.file('ppt/slides/slide2.xml').async('string');
  const titleShapes = allShapes(titleXml);

  const legacy = shapeContaining(shapes, 'Legacy default remains shrink');
  assert.equal(autofitKind(legacy), 'shrink', 'Existing default must retain shrink-to-fit');
  for (const text of [
    'Explicit shrink request is overridden',
    'CJK English fixed-size heading',
    '长标题 Long English title',
    '第一行：保持中文原文',
    'Second line: preserve English copy',
    '流程标题 Process title',
    '流程说明第一行',
    'Process explanation second line',
    '完整说明 Full explanation remains at its chosen font size',
    '说明文字 Description remains editable and fixed-size',
    '第一条内容 First bullet item',
    '第二条内容 Second bullet item',
  ]) {
    const shape = shapeContaining(shapes, text);
    assert.equal(autofitKind(shape), 'fixed', `autoShrink:false must emit fixed-size text for: ${text}`);
    assert.ok(fontSizes(shape).length > 0, `Missing explicit font size for: ${text}`);
  }

  const pageTitle = shapeContaining(titleShapes, 'ME2026 长标题：客户服务如何从广告入口继续延伸');
  const pageSubtitle = shapeContaining(titleShapes, '方案结构与品牌触点协同');
  assert.equal(autofitKind(pageTitle), 'fixed', 'ME2026 page title must not shrink');
  assert.equal(autofitKind(pageSubtitle), 'fixed', 'ME2026 page subtitle must not shrink');
  assert.ok(fontSizes(pageTitle).every(size => size === 28), 'ME2026 page title must retain 28pt');
  assert.ok(fontSizes(pageSubtitle).every(size => size === 20), 'ME2026 page subtitle must retain 20pt');

  const cardTitle = shapeContaining(shapes, '长标题 Long English title');
  const cardBody = shapeContaining(shapes, '第一行：保持中文原文');
  assert.ok(fontSizes(cardTitle).every(size => size === 24), 'Card title font size must remain 24pt');
  assert.ok(fontSizes(cardBody).every(size => size === 20), 'Card body font size must remain 20pt');
  const cardBounds = roundRectAt(shapes, { x: 1, y: 2.15 });
  const titleBounds = boundsOfShape(cardTitle);
  const bodyBounds = boundsOfShape(cardBody);
  assert.ok(titleBounds.x >= cardBounds.x && titleBounds.x + titleBounds.w <= cardBounds.x + cardBounds.w - 0.2, 'Card title must stay inside the card with right padding');
  assert.ok(bodyBounds.x >= cardBounds.x + 0.2 && bodyBounds.x + bodyBounds.w <= cardBounds.x + cardBounds.w - 0.2, 'Card body must stay inside the card with horizontal padding');
  assert.ok(bodyBounds.y + bodyBounds.h <= cardBounds.y + cardBounds.h - 0.17, 'Card body must keep visible bottom padding');

  const stackedTitle = shapeContaining(shapes, '流程标题 Process title');
  const stackedBody = shapeContaining(shapes, '流程说明第一行');
  const stackedTitleBounds = boundsOfShape(stackedTitle);
  const stackedBodyBounds = boundsOfShape(stackedBody);
  assert.ok(stackedBodyBounds.y >= stackedTitleBounds.y + stackedTitleBounds.h, 'Stacked row body must start below its title');
  assert.ok(stackedBodyBounds.y + stackedBodyBounds.h <= 3.57, 'Stacked row copy must remain inside its card bottom');

  console.log(`PASS: fixed-size override, legacy shrink compatibility, white-base title/subtitle and icon-card bullet passthrough, CJK/English text retention, card geometry and spacing. Evidence: ${task}`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
