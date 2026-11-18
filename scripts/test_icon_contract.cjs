#!/usr/bin/env node
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const H = require('./brand_ppt_helpers.cjs');
const JSZip = require('jszip');
const sharp = require('sharp');

const taskDir = fs.mkdtempSync(path.join(os.tmpdir(), 'me2026-icon-contract-'));
const logoPath = H.ME2026_ASSETS.meetExperienceBilingualLogo;
const reverseLogoPath = H.ME2026_ASSETS.meetExperienceBilingualReverseLogo;
const glassBackgroundPath = H.ME2026_ASSETS.coverGlassBg;

function shapeBlocks(xml, tag) {
  return [...xml.matchAll(new RegExp(`<p:${tag}\\b[\\s\\S]*?<\\/p:${tag}>`, 'g'))].map((match) => match[0]);
}

function namedPicture(xml, name) {
  const picture = shapeBlocks(xml, 'pic').find((block) => block.includes(`name="${name}"`));
  assert.ok(picture, `Missing picture object ${name}`);
  return picture;
}

function namedShape(xml, tag, name) {
  const shape = shapeBlocks(xml, tag).find((block) => block.includes(`name="${name}"`));
  assert.ok(shape, `Missing ${tag} object ${name}`);
  return shape;
}

function shapeText(xmlBlock) {
  return [...xmlBlock.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
    .map((match) => match[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#xA0;|\u00a0/gi, ' '))
    .join('');
}

function namedTextShape(xml, expectedText) {
  const shape = shapeBlocks(xml, 'sp').find((block) => shapeText(block).includes(expectedText));
  assert.ok(shape, `Missing text shape containing '${expectedText}'`);
  return shape;
}

function bounds(xmlBlock) {
  const match = xmlBlock.match(/<a:xfrm\b[^>]*>[\s\S]*?<a:off x="(\d+)" y="(\d+)"\s*\/>[\s\S]*?<a:ext cx="(\d+)" cy="(\d+)"\s*\/>/);
  assert.ok(match, 'Missing DrawingML transform');
  return { x: Number(match[1]), y: Number(match[2]), w: Number(match[3]), h: Number(match[4]) };
}

function assertBoundsInches(xmlBlock, expected, label, tolerance = 0.002) {
  const actual = bounds(xmlBlock);
  for (const key of ['x', 'y', 'w', 'h']) {
    assert.ok(Math.abs(actual[key] / 914400 - expected[key]) <= tolerance, `${label} ${key} should be ${expected[key]}in, received ${actual[key] / 914400}in`);
  }
}

function relationshipTarget(relXml, rId) {
  const rel = [...relXml.matchAll(/<Relationship\b([^>]*)\/>/g)]
    .map((match) => match[1])
    .find((attrs) => new RegExp(`\\bId="${rId}"`).test(attrs));
  assert.ok(rel, `Missing relationship ${rId}`);
  const target = rel.match(/\bTarget="([^"]+)"/);
  assert.ok(target, `Missing target for ${rId}`);
  return `ppt/${target[1].replace(/^\.\.\//, '')}`;
}

async function mediaForPicture(zip, slideNumber, picture) {
  const relId = picture.match(/<a:blip\b[^>]*r:embed="([^"]+)"/);
  assert.ok(relId, 'Picture has no embedded media relationship');
  const rels = await zip.file(`ppt/slides/_rels/slide${slideNumber}.xml.rels`).async('string');
  const target = relationshipTarget(rels, relId[1]);
  const file = zip.file(target);
  assert.ok(file, `Missing embedded media ${target}`);
  return { target, data: await file.async('nodebuffer') };
}

async function dominantOpaqueColor(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const counts = new Map();
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] < 250) continue;
    const color = [data[i], data[i + 1], data[i + 2]].map((part) => part.toString(16).padStart(2, '0')).join('').toUpperCase();
    counts.set(color, (counts.get(color) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function relativeLuminance(hex) {
  const channels = hex.match(/.{2}/g).map((part) => parseInt(part, 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(a, b) {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

(async () => {
  assert.equal(H.ME2026_LOGO_ASPECT, 3838 / 1068);
  assert.equal(H.resolveME2026Icon('data').icon, 'Database');
  assert.equal(H.resolveME2026Icon('review').icon, 'ClipboardCheck');
  assert.equal(H.resolveME2026Icon('publish').icon, 'Send');
  for (const tone of Object.values(H.ME2026_ICON_TONES)) {
    assert.ok(contrastRatio(tone.color, tone.fill) >= 4.5, `${tone.color} on ${tone.fill} must meet 4.5:1 contrast`);
  }

  const pngMeta = await sharp(logoPath).metadata();
  assert.equal(pngMeta.width, 3838);
  assert.equal(pngMeta.height, 1068);
  assert.equal(pngMeta.hasAlpha, true, 'The source logo must retain real transparency');
  const alphaStats = await sharp(logoPath).extractChannel('alpha').stats();
  assert.equal(alphaStats.channels[0].min, 0);
  assert.ok(alphaStats.channels[0].max > 0, 'The source logo must contain visible pixels on a transparent canvas');
  const reversePngMeta = await sharp(reverseLogoPath).metadata();
  assert.equal(reversePngMeta.width, 3838);
  assert.equal(reversePngMeta.height, 1068);
  assert.equal(reversePngMeta.hasAlpha, true, 'The cover reverse logo must retain real transparency');
  const reverseAlphaStats = await sharp(reverseLogoPath).extractChannel('alpha').stats();
  assert.equal(reverseAlphaStats.channels[0].min, 0);
  assert.ok(reverseAlphaStats.channels[0].max > 0, 'The cover reverse logo must contain visible pixels on a transparent canvas');
  const glassBackgroundMeta = await sharp(glassBackgroundPath).metadata();
  assert.equal(glassBackgroundMeta.width, 8000);
  assert.equal(glassBackgroundMeta.height, 4500);

  await H.prepareME2026IconCache(['data', 'review', 'publish', 'strategy', 'growth', 'media']);
  await H.prepareME2026IconCache(['strategy'], ['ED1C24'], { strokeWidth: 2.25 });
  await H.prepareIconCache(['TrendingUp'], [H.ME2026.primaryBlue], 2.0);
  await H.prepareIconCache(['TrendingUp'], [H.ME2026.primaryBlue], 3.0);
  const pptx = H.createPresentation({ title: 'ME2026 icon and brand contract' });
  const coverOptionCapture = { texts: [], addImage() {}, addShape() {}, addText(text, options) { this.texts.push({ text, ...options }); } };
  H.addME2026Cover(coverOptionCapture, pptx, {
    title: '自定义封面标题', titleX: 1.2, titleY: 2.1, titleW: 6.2, titleH: 1.2, titleSize: 42, titleColor: '123456',
    subtitle: '自定义副标题', subtitleX: 1.3, subtitleY: 3.4, subtitleW: 5.4, subtitleH: 0.3, subtitleSize: 17, subtitleColor: '654321',
  });
  const overrideTitle = coverOptionCapture.texts.find((item) => item.text === '自定义封面标题');
  assert.deepEqual(
    { x: overrideTitle.x, y: overrideTitle.y, w: overrideTitle.w, h: overrideTitle.h, size: overrideTitle.fontSize, color: overrideTitle.color },
    { x: 1.2, y: 2.1, w: 6.2, h: 1.2, size: 42, color: '123456' },
    'Cover title geometry, size and color options must pass through unchanged',
  );
  const overrideSubtitle = coverOptionCapture.texts.find((item) => item.text === '自定义副标题');
  assert.deepEqual(
    { x: overrideSubtitle.x, y: overrideSubtitle.y, w: overrideSubtitle.w, h: overrideSubtitle.h, size: overrideSubtitle.fontSize, color: overrideSubtitle.color },
    { x: 1.3, y: 3.4, w: 5.4, h: 0.3, size: 17, color: '654321' },
    'Cover subtitle geometry, size and color options must pass through unchanged',
  );
  const aliasCapture = { images: [], shapes: [], addImage(options) { this.images.push(options); }, addShape(type, options) { this.shapes.push({ type, ...options }); } };
  H.addME2026Footer(aliasCapture, pptx, undefined, { msX: 3.2, msW: 0.9, msH: 0.12 });
  const aliasGroup = aliasCapture.images.find((image) => image.objectName === 'ME2026_FOOTER_GROUP_LOGO');
  assert.deepEqual(
    { x: aliasGroup.x, y: aliasGroup.y, w: aliasGroup.w, h: aliasGroup.h },
    { x: 3.2, y: 7.16, w: 0.9, h: 0.12 },
    'Legacy msX/msW/msH footer options must remain supported',
  );

  const cover = pptx.addSlide();
  H.addME2026Cover(cover, pptx, { title: '图标与品牌组件合同', subtitle: '玻璃背景下的副标题' });

  const index = pptx.addSlide();
  H.addME2026Index(index, pptx, ['能力规划', '测试验证']);

  const variants = pptx.addSlide();
  H.addME2026IconBadge(variants, pptx, 'data', 1.0, 1.0, 0.8, {
    appearance: 'bare', tone: 'blue', glyphScale: 0.94, strokeWidth: 2.25,
  });
  H.addME2026IconBadge(variants, pptx, 'review', 2.2, 1.0, 0.8, {
    appearance: 'circle', tone: 'purple', glyphScale: 0.76, strokeWidth: 2.25,
  });
  H.addME2026IconBadge(variants, pptx, 'publish', 3.4, 1.0, 0.8, {
    appearance: 'rounded-square', tone: 'blue', glyphScale: 0.76, strokeWidth: 2.25,
  });
  H.addME2026IconBadge(variants, pptx, 'strategy', 4.6, 1.0, 0.8, {
    appearance: 'rounded-square', tone: 'purple', color: 'ED1C24', fill: 'FFFF00', glyphScale: 0.76, strokeWidth: 2.25,
  });
  // Legacy badge signature remains valid and still creates the default circle.
  H.addME2026IconBadge(variants, pptx, 'growth', 5.8, 1.0, 0.8);

  const weights = pptx.addSlide();
  H.addIcon(weights, 'TrendingUp', 1.0, 1.0, 0.8, 0.8, H.ME2026.primaryBlue, 2.0, { semanticKey: 'growth-weight-2' });
  H.addIcon(weights, 'TrendingUp', 2.0, 1.0, 0.8, 0.8, H.ME2026.primaryBlue, 3.0, { semanticKey: 'growth-weight-3' });

  const components = pptx.addSlide();
  H.addME2026IconTitleCard(components, pptx, {
    x: 0.8, y: 1.2, w: 4.2, h: 1.8, icon: 'media', title: '紫色能力卡', body: '标题和徽章使用同一紫色色调。',
    iconTone: 'purple', iconAppearance: 'circle', iconScale: 0.76, iconStrokeWidth: 2.25,
  });
  H.addME2026StackedIconRow(components, pptx, {
    x: 0.8, y: 3.4, w: 6.3, h: 1.0, icon: 'data', title: '蓝色数据行', body: '紧凑组件使用裸图标。',
    iconTone: 'blue', iconAppearance: 'bare', iconScale: 0.94, iconStrokeWidth: 2.25,
  });

  const footer = pptx.addSlide();
  H.addME2026Footer(footer, pptx, 12);

  const closing = pptx.addSlide();
  H.addME2026ThankYou(closing, pptx, { title: 'THANK YOU' });

  const output = path.join(taskDir, 'icon-contract.pptx');
  await pptx.writeFile({ fileName: output });
  const zip = await JSZip.loadAsync(fs.readFileSync(output));
  const slideXml = async (number) => zip.file(`ppt/slides/slide${number}.xml`).async('string');

  const variantXml = await slideXml(3);
  for (const [key, label] of [['data', '数据'], ['review', '复核'], ['publish', '发布'], ['strategy', '策略'], ['growth', '增长']]) {
    const picture = namedPicture(variantXml, `ME2026_ICON:${key}`);
    assert.ok(picture.includes(`descr="${label}"`), `Icon ${key} should use a human-readable alt label`);
  }
  const variantPictures = shapeBlocks(variantXml, 'pic');
  const bare = variantPictures.find((block) => block.includes('name="ME2026_ICON:data"'));
  const circle = variantPictures.find((block) => block.includes('name="ME2026_ICON:review"'));
  const square = variantPictures.find((block) => block.includes('name="ME2026_ICON:publish"'));
  assert.ok(Math.abs(bounds(bare).w / 914400 - 0.8 * 0.94) < 0.002, 'Bare icon should use the requested visible scale');
  assert.ok(Math.abs(bounds(circle).w / 914400 - 0.8 * 0.76) < 0.002, 'Circle glyph should use the requested scale');
  assert.ok(Math.abs(bounds(square).w / 914400 - 0.8 * 0.76) < 0.002, 'Rounded-square glyph should use the requested scale');
  // The exported DrawingML must preserve the public center-coordinate contract.
  const squareGlyphSize = 0.8 * 0.76;
  assertBoundsInches(square, {
    x: 3.4 - squareGlyphSize / 2, y: 1.0 - squareGlyphSize / 2,
    w: squareGlyphSize, h: squareGlyphSize,
  }, 'Centered rounded-square glyph');
  const variantShapes = shapeBlocks(variantXml, 'sp');
  assert.ok(variantShapes.some((block) => /<a:prstGeom prst="ellipse"/.test(block) && block.includes('name="ME2026_ICON_CONTAINER"')));
  assert.ok(variantShapes.some((block) => /<a:prstGeom prst="roundRect"/.test(block) && block.includes('name="ME2026_ICON_CONTAINER"')));
  const squareContainer = variantShapes.find((block) =>
    block.includes('name="ME2026_ICON_CONTAINER"') &&
    Math.abs(bounds(block).x / 914400 - 3.0) < 0.002);
  assert.ok(squareContainer, 'Expected badge centered at (3.4, 1.0)');
  assertBoundsInches(squareContainer, { x: 3.0, y: 0.6, w: 0.8, h: 0.8 }, 'Centered badge container');
  const overrideContainer = variantShapes.find((block) => block.includes('<a:srgbClr val="FFFF00"'));
  assert.ok(overrideContainer, 'Explicit fill must override the tone background');

  const overridePicture = namedPicture(variantXml, 'ME2026_ICON:strategy');
  const overrideMedia = await mediaForPicture(zip, 3, overridePicture);
  assert.equal(await dominantOpaqueColor(overrideMedia.data), 'ED1C24', 'Explicit glyph color must override the tone color');
  const reviewPicture = namedPicture(variantXml, 'ME2026_ICON:review');
  const reviewMedia = await mediaForPicture(zip, 3, reviewPicture);
  assert.equal(await dominantOpaqueColor(reviewMedia.data), H.ME2026_ICON_TONES.purple.color);
  const dataPicture = namedPicture(variantXml, 'ME2026_ICON:data');
  const dataMedia = await mediaForPicture(zip, 3, dataPicture);
  assert.equal(await dominantOpaqueColor(dataMedia.data), H.ME2026_ICON_TONES.blue.color);

  const weightXml = await slideXml(4);
  const thin = await mediaForPicture(zip, 4, namedPicture(weightXml, 'ME2026_ICON:growth-weight-2'));
  const heavy = await mediaForPicture(zip, 4, namedPicture(weightXml, 'ME2026_ICON:growth-weight-3'));
  assert.notEqual(crypto.createHash('sha256').update(thin.data).digest('hex'), crypto.createHash('sha256').update(heavy.data).digest('hex'), 'Stroke width must participate in icon cache identity');

  const sourceLogoHash = crypto.createHash('sha256').update(fs.readFileSync(logoPath)).digest('hex');
  const reverseLogoHash = crypto.createHash('sha256').update(fs.readFileSync(reverseLogoPath)).digest('hex');
  const glassBackgroundHash = crypto.createHash('sha256').update(fs.readFileSync(glassBackgroundPath)).digest('hex');
  assert.notEqual(sourceLogoHash, reverseLogoHash, 'The retained reverse logo must remain a distinct source asset');
  const logoMarkers = [];
  for (const [number, expectedHash] of [[1, sourceLogoHash], [2, sourceLogoHash], [7, sourceLogoHash]]) {
    const xml = await slideXml(number);
    const logo = namedPicture(xml, 'ME2026_BRAND_LOGO');
    const media = await mediaForPicture(zip, number, logo);
    const embeddedHash = crypto.createHash('sha256').update(media.data).digest('hex');
    assert.equal(embeddedHash, expectedHash, `Slide ${number} must embed its designated bilingual logo without re-encoding`);
    const size = bounds(logo);
    assert.ok(Math.abs(size.w / size.h - H.ME2026_LOGO_ASPECT) < 0.002, `Slide ${number} logo must preserve its original aspect ratio`);
    logoMarkers.push(logo);
  }
  assert.equal(logoMarkers.length, 3);
  const coverXml = await slideXml(1);
  assert.ok(!shapeBlocks(coverXml, 'sp').some((block) => block.includes('name="ME2026_BRAND_LOGO_PANEL"')), 'Cover logo must use the transparent source without a white panel');
  assert.ok(!shapeBlocks(coverXml, 'sp').some((block) => block.includes('name="ME2026_COVER_OVERLAY"')), 'The default glass cover must not have the old blue overlay');
  const coverBackground = namedPicture(coverXml, 'ME2026_GLASS_BACKGROUND');
  assertBoundsInches(coverBackground, { x: 0, y: 0, w: 13.333, h: 7.5 }, 'Cover glass background');
  const coverBackgroundMedia = await mediaForPicture(zip, 1, coverBackground);
  assert.equal(crypto.createHash('sha256').update(coverBackgroundMedia.data).digest('hex'), glassBackgroundHash, 'Cover must embed the full extracted glass background unchanged');
  assertBoundsInches(namedPicture(coverXml, 'ME2026_BRAND_LOGO'), {
    x: 0.8, y: 0.75, w: 2.3, h: 2.3 / H.ME2026_LOGO_ASPECT,
  }, 'Cover bilingual logo');
  assert.ok(namedTextShape(coverXml, '图标与品牌组件合同').includes('<a:srgbClr val="5C0BE0"'), 'Cover title must default to deep purple');
  assert.ok(namedTextShape(coverXml, '玻璃背景下的副标题').includes(`<a:srgbClr val="${H.C.ink}"`), 'Cover subtitle must default to INK');
  const indexXml = await slideXml(2);
  assert.ok(shapeBlocks(indexXml, 'pic').some((block) => block.includes('name="ME2026_BRAND_LOGO"')), 'Index must explicitly use the bilingual logo');

  const footerXml = await slideXml(6);
  assert.ok(!shapeBlocks(footerXml, 'pic').some((block) => block.includes('name="ME2026_BRAND_LOGO"')), 'Body footer must retain the original two-logo treatment');
  const footerMe = namedPicture(footerXml, 'ME2026_FOOTER_ME_LOGO');
  const footerGroup = namedPicture(footerXml, 'ME2026_FOOTER_GROUP_LOGO');
  const footerDivider = namedShape(footerXml, 'sp', 'ME2026_FOOTER_DIVIDER');
  assertBoundsInches(footerMe, { x: 0.62, y: 7.17, w: 1.15, h: 0.1 }, 'ME footer logo');
  assertBoundsInches(footerDivider, { x: 1.92, y: 7.125, w: 0, h: 0.19 }, 'Footer divider');
  assert.ok(footerDivider.includes('<a:ln w="10160">'), 'Legacy divider width must remain 0.8pt');
  assert.ok(footerDivider.includes('<a:srgbClr val="BFBFBF"'), 'Legacy divider color must remain BFBFBF');
  assertBoundsInches(footerGroup, { x: 2.02, y: 7.15, w: 1.1, h: 0.14 }, 'Group footer logo');
  const footerMeAsset = crypto.createHash('sha256').update(fs.readFileSync(H.ME2026_ASSETS.meetExperienceFooterLogo)).digest('hex');
  const footerGroupAsset = crypto.createHash('sha256').update(fs.readFileSync(H.ME2026_ASSETS.meetsocialFooterLogo)).digest('hex');
  for (const [picture, expectedHash, label] of [[footerMe, footerMeAsset, 'ME footer logo'], [footerGroup, footerGroupAsset, 'Group footer logo']]) {
    const media = await mediaForPicture(zip, 6, picture);
    assert.equal(crypto.createHash('sha256').update(media.data).digest('hex'), expectedHash, `${label} must preserve its original source asset`);
  }
  const closingXml = await slideXml(7);
  assert.ok(!shapeBlocks(closingXml, 'sp').some((block) => block.includes('name="ME2026_THANKYOU_LEFT_OVERLAY"')), 'The closing page must not add the old blue overlay by default');
  const closingBackground = namedPicture(closingXml, 'ME2026_GLASS_BACKGROUND');
  assertBoundsInches(closingBackground, { x: 0, y: 0, w: 13.333, h: 7.5 }, 'Closing glass background');
  const closingBackgroundMedia = await mediaForPicture(zip, 7, closingBackground);
  assert.equal(crypto.createHash('sha256').update(closingBackgroundMedia.data).digest('hex'), glassBackgroundHash, 'Closing must use the same extracted glass background unchanged');
  assertBoundsInches(namedPicture(closingXml, 'ME2026_BRAND_LOGO'), {
    x: 0.8, y: 0.75, w: 2.1, h: 2.1 / H.ME2026_LOGO_ASPECT,
  }, 'Closing bilingual logo');
  assert.ok(namedTextShape(closingXml, 'THANK YOU').includes('<a:srgbClr val="5C0BE0"'), 'Closing title must remain editable and default to deep purple');
  assert.ok(namedTextShape(closingXml, '全球成功，从这里开始').includes(`<a:srgbClr val="${H.C.ink}"`), 'Closing tagline must remain editable and default to INK');
  assert.ok(closingXml.includes('Contact Us.'), 'Closing Contact Us heading must be preserved');
  const closingPlainText = shapeBlocks(closingXml, 'sp').map(shapeText).join('').replace(/\s+/g, '');
  for (const text of ['联系我们', '美国', '新加坡', '日本', '印度', '迪拜', '上海', '北京', '深圳', '广州', '成都', 'MEETEXPERIENCE', '官方公众号', '联系解决方案', '黏贴个人联系方式']) {
    assert.ok(closingPlainText.includes(text), `Closing page content must be preserved: ${text}`);
  }
  const closingPanel = namedShape(closingXml, 'sp', 'ME2026_CLOSING_CONTACT_PANEL');
  assertBoundsInches(closingPanel, { x: 7.52, y: 0.82, w: 5.42, h: 6.02 }, 'Closing contact panel');
  assert.ok(closingPanel.includes('<a:srgbClr val="FFFFFF"><a:alpha val="88000"'), 'Closing contact panel must use a softly transparent white fill');
  const closingQr = namedPicture(closingXml, 'ME2026_CLOSING_OFFICIAL_QR');
  const qrAssetHash = crypto.createHash('sha256').update(fs.readFileSync(H.ME2026_ASSETS.thankYouOfficialQr)).digest('hex');
  const closingQrMedia = await mediaForPicture(zip, 7, closingQr);
  assert.equal(crypto.createHash('sha256').update(closingQrMedia.data).digest('hex'), qrAssetHash, 'Closing official QR asset must be preserved unchanged');
  assertBoundsInches(namedShape(closingXml, 'sp', 'ME2026_CLOSING_CONTACT_BOX'), { x: 10.42, y: 4, w: 1.95, h: 1.95 }, 'Closing contact placeholder box');
  namedTextShape(closingXml, '黏贴个人联系方式');
  const sourceLogoBasenames = [
    'meetsocial-group-logo.png', 'meet-experience-cover-logo.png', 'thank-you-meetsocial-logo.png',
  ];
  const mediaHashes = await Promise.all(Object.keys(zip.files).filter((name) => /^ppt\/media\//.test(name) && !zip.files[name].dir).map(async (name) => crypto.createHash('sha256').update(await zip.file(name).async('nodebuffer')).digest('hex')));
  for (const basename of sourceLogoBasenames) {
    const asset = path.join(path.dirname(logoPath), basename);
    if (!fs.existsSync(asset)) continue;
    const legacyHash = crypto.createHash('sha256').update(fs.readFileSync(asset)).digest('hex');
    assert.ok(!mediaHashes.includes(legacyHash), `Retired duplicate logo ${basename} should not be embedded by the new master components`);
  }

  console.log(JSON.stringify({
    result: 'PASS',
    pptxGenerated: true,
    temporaryOutputRemoved: true,
    slides: 7,
    iconVariants: ['bare', 'circle', 'rounded-square'],
    iconMarkers: variantPictures.map((block) => block.match(/name="([^"]+)"/)?.[1]).filter(Boolean),
    toneContrast: Object.fromEntries(Object.entries(H.ME2026_ICON_TONES).map(([name, tone]) => [name, contrastRatio(tone.color, tone.fill)])),
    logo: { width: pngMeta.width, height: pngMeta.height, aspect: H.ME2026_LOGO_ASPECT, placements: { cover: 'color', index: 'color', closing: 'color', bodyFooterLogos: 2 }, retainedReverseAsset: true },
    glassBackground: { width: glassBackgroundMeta.width, height: glassBackgroundMeta.height, coverAndClosing: true },
    strokeWidths: [2.0, 3.0],
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  fs.rmSync(taskDir, { recursive: true, force: true });
});
