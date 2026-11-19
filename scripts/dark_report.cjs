const fs = require('node:fs/promises');
const path = require('node:path');
const JSZip = require('jszip');
const { createPresentation, ME2026_ASSETS: assets, ME2026_LOGO_ASPECT,
  addME2026ThankYou, SLIDE_W: W, SLIDE_H: H } = require('./brand_ppt_helpers.cjs');
const primitives = require('./report_primitives.cjs');

const theme = Object.freeze({ ink: '2E1F6B', body: '4D4A66', muted: '706B86', violet: '5C0BE0',
  blue: '2F7BEF', cyan: '0A9BEB', tint: 'F4F1FB', rule: 'DFDCE8', cjk: '等线', latin: 'Poppins' });
const art = name => path.join(path.dirname(assets.coverBg), 'dark-report', name);
const stageColors = [theme.cyan, theme.blue, '4A3EE6', theme.violet];
const left = 0.55;
const contentW = W - 2 * left;

function shape(s, type, x, y, w, h, color, options = {}) {
  s.addShape(type, { x, y, w, h, fill: { color }, line: { transparency: 100 }, ...options });
}
function rect(s, x, y, w, h, fill, options) { shape(s, 'rect', x, y, w, h, fill, options); }
function panel(s, x, y, w, h) {
  rect(s, x, y, w, h, 'FFFFFF', { line: { color: theme.rule, width: 0.7 } });
}
function label(s, value, x, y, w, h, size = 15, color = theme.body, bold = false, options = {}) {
  primitives.text(s, value, x, y, w, h, theme, { fontSize: size, color, bold, ...options });
}
function gradient(s, x, y, w, h, direction = 'horizontal') {
  rect(s, x, y, w, h, '6110E2', { objectName: 'ME_REPORT_GRADIENT_' + direction });
}
// PptxGenJS currently exports solid shape fills. Replace only the explicitly named
// rectangle's fill, after the standard package compatibility boundary has run.
async function writeReport(pptx, out) {
  const zip = await JSZip.loadAsync(await pptx.write({ outputType: 'nodebuffer', compression: true }));
  for (const file of zip.file(/^ppt\/slides\/slide\d+\.xml$/)) {
    const xml = await file.async('string');
    const withFooterCrop = xml.replace(/<p:pic>[\s\S]*?<\/p:pic>/g, pic => {
      if (!pic.includes('name="ME_REPORT_FOOTER_LOGO"')) return pic;
      return pic.replace('<a:stretch>', '<a:srcRect l="17983" t="32568" r="24874" b="39944"/><a:stretch>');
    });
    const changed = withFooterCrop.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, sp => {
      const marker = sp.match(/name="ME_REPORT_GRADIENT_(horizontal|diagonal)"/);
      if (!marker) return sp;
      const angle = marker[1] === 'horizontal' ? 0 : 2700000;
      const grad = '<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:srgbClr val="6110E2"/></a:gs><a:gs pos="100000"><a:srgbClr val="2F7BEF"/></a:gs></a:gsLst><a:lin ang="' + angle + '" scaled="1"/></a:gradFill>';
      return sp.replace(/<a:solidFill>[\s\S]*?<\/a:solidFill>/, grad);
    });
    if (xml !== changed) zip.file(file.name, changed);
  }
  await fs.mkdir(path.dirname(path.resolve(out)), { recursive: true });
  await fs.writeFile(out, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
}

function bookend(s, pptx, p, deck) {
  if (p.role === 'closing') {
    addME2026ThankYou(s, pptx, { title: p.title, tagline: p.subtitle, contactPlaceholderText: p.contact,
      backgroundImage: art('closing.jpg'), backgroundWidth: 6.16, backgroundAlt: '品牌几何纹理',
      leftOverlay: true, leftW: 6.16, overlayColor: '4A3EE6', leftOverlayTransparency: 29,
      closingLogo: assets.meetExperienceBilingualReverseLogo, titleColor: 'FFFFFF', taglineColor: 'FFFFFF',
      taglineAlign: 'center', taglineX: 0.55, taglineW: 5.05, contactPanelTransparency: 100 });
    return;
  }
  const section = p.role === 'section';
  s.addImage({ path: art(section ? 'section.png' : 'cover.jpg'), x: 0, y: 0, w: W, h: H,
    objectName: 'ME_REPORT_BRAND_BACKGROUND' });
  if (section) {
    s.addImage({ path: assets.meetExperienceBilingualReverseLogo, x: 0.41, y: 0.26, w: 1.17, h: 1.17 / ME2026_LOGO_ASPECT });
    s.addImage({ path: art('section-steps.png'), x: 9.55, y: 0.5, w: 3.2, h: 2.69 });
    label(s, p.number, 0.48, 2.72, 3.78, 1.65, 110, 'FFFFFF', false, { align: 'center' });
    label(s, p.title, 4.86, 3.14, 7.74, 0.82, 44, 'FFFFFF', true);
    label(s, p.subtitle, 4.88, 4.15, 7.46, 0.56, 22, 'E4DAFF');
    label(s, p.summary, 4.88, 4.96, 7.54, 0.85, 15, 'FFFFFF');
  } else {
    rect(s, 0, 0, W, H, '27105A', { fill: { color: '27105A', transparency: 70 } });
    s.addImage({ path: art('group-reverse.png'), x: 0.52, y: 1.30, w: 3.50, h: 1.28 });
    s.addImage({ path: assets.meetExperienceCoverLogo, x: 3.78, y: 1.72, w: 3.17, h: 0.32 });
    label(s, p.title, 0.98, 2.62, 10.6, 1.95, 43, 'FFFFFF', true);
    label(s, p.subtitle, 1.02, 5.74, 7.9, 0.43, 18, 'FFFFFF');
    if (deck.disclosure) label(s, deck.disclosure, 1.03, 6.37, 7.9, 0.34, 12, 'FFFFFF');
  }
}
// Preserve the 24pt first-line anchor. Reserve extra vertical space only
// when the source title wraps. A small width reserve allows word-boundary wraps.
function titleHeight(title) {
  const widthPt = 12.23 * 72 - 14.4 - 24;
  const lines = title.split(/\r?\n/).reduce((count, line) => {
    const units = [...line].reduce((sum, ch) => sum + (/^[ -~]$/.test(ch) ? 0.65 : 1), 0);
    return count + Math.max(1, Math.ceil(units * 24 / widthPt));
  }, 0);
  return Math.max(0.82, 0.10 + lines * 0.43);
}

function shiftedBody(slide, dy) {
  if (dy < 0.001) return slide;
  const body = Object.create(slide);
  for (const method of ['addText', 'addShape', 'addChart', 'addTable']) {
    body[method] = (...args) => {
      const opts = args[args.length - 1];
      const y = opts.y + dy;
      if (y + (opts.h || 0) > 6.86) throw new Error('长标题后的正文超出页脚安全区，请改用可重排的表格版式或分页。');
      args[args.length - 1] = { ...opts, y };
      return slide[method](...args);
    };
  }
  body.addNotes = slide.addNotes.bind(slide);
  return body;
}

function base(s, pptx, p, deck) {
  s.background = { color: 'FFFFFF' };
  // Source layout body placeholders use the OOXML default 0.1"/0.05"
  // horizontal/vertical text insets and top alignment.
  const heading = { margin: [7.2, 7.2, 3.6, 3.6], valign: 'top', lineSpacingMultiple: 0.9 };
  label(s, p.kicker, left, 0.36, 7.20, 0.34, 12, theme.violet, true,
    { ...heading, objectName: 'ME_REPORT_KICKER' });
  const appendix = ['overview', 'detail'].includes(p.role);
  const nav = appendix ? [] : deck.navigation || [];
  const stride = Math.min(0.79, 4.74 / Math.max(1, nav.length));
  nav.forEach((name, i) => {
    const x = 8.05 + i * stride;
    const active = name === p.section;
    if (active) shape(s, 'roundRect', x, 0.38, stride - 0.03, 0.28, theme.violet, { radius: 0.14 });
    label(s, name, x, 0.38, stride - 0.03, 0.28, 10, active ? 'FFFFFF' : theme.muted, active,
      { align: 'center', objectName: 'ME_REPORT_NAV_' + (active ? 'ACTIVE_' : '') + i });
  });
  const height = titleHeight(p.title);
  label(s, p.title, left, 0.70, 12.23, height, 24, theme.ink, true,
    { ...heading, objectName: 'ME_REPORT_TITLE' });
  s.addImage({ path: art('footer-original.png'), x: 363909 / 914400, y: 6313546 / 914400,
    w: 1162594 / 914400, h: 314585 / 914400, objectName: 'ME_REPORT_FOOTER_LOGO',
    altText: '觅跃科技 Meet Experience' });
  if (deck.disclosure) label(s, deck.disclosure, 1.95, 6.93, 9.90, 0.32, 10, theme.muted, false,
    { objectName: 'ME_REPORT_FOOTER_NOTE' });
  return 0.73 + height;
}
function trend(s, pptx, p, use) {
  const talk = use === 'talk';
  gradient(s, left, 1.76, 4.03, 4.34, 'diagonal');
  label(s, p.label, 0.81, 2.02, 3.50, 0.58, 17, 'FFFFFF', true);
  label(s, p.metric, 0.80, 2.72, 3.12, 1.53, talk ? 95 : 77, 'FFFFFF', true);
  label(s, p.unit, 0.88, 4.50, 3.22, 0.51, 21, 'E4DAFF');
  label(s, p.chartTitle, 4.96, 1.82, 7.48, 0.45, talk ? 22 : 17, theme.ink, true);
  primitives.chart(s, pptx, p, { x: 4.85, y: 2.4, w: 7.7, h: 3.70 }, theme);
  label(s, p.note, left, 6.36, contentW, 0.38, 13);
  if (talk) s.addNotes([p.talkNote || p.chartTitle, p.note].filter(Boolean).join('\n'));
}
function stages(s, p) {
  const width = contentW / p.items.length;
  p.items.forEach(([title, action, detail], i) => {
    const x = left + i * width;
    shape(s, 'chevron', x, 1.97, width - 0.03, 0.80, stageColors[i % 4]);
    label(s, title, x + 0.19, 2.07, width - 0.44, 0.54, 20, 'FFFFFF', true, { align: 'center' });
    rect(s, x, 3.0, width - 0.10, 2.56, theme.tint);
    label(s, action, x + 0.17, 3.23, width - 0.45, 0.56, 18, theme.ink, true);
    label(s, detail, x + 0.17, 4.10, width - 0.45, 1.05, 16);
  });
}
function groupedRows(s, p) {
  const height = 4.62 / p.items.length;
  p.items.forEach(([group, ...members], i) => {
    const y = 1.83 + i * height;
    rect(s, left, y, 2.34, height - 0.17, stageColors[(i + 1) % 4]);
    label(s, group, left + 0.12, y + 0.05, 2.10, height - 0.27, 19, 'FFFFFF', true, { align: 'center' });
    const memberWidth = (contentW - 2.50) / members.length;
    members.forEach((member, j) => {
      const x = left + 2.50 + j * memberWidth;
      panel(s, x, y, memberWidth - 0.10, height - 0.17);
      const mark = typeof member === 'object' ? member.mark : null;
      if (mark) {
        shape(s, 'ellipse', x + 0.23, y + (height - 0.69) / 2, 0.52, 0.52, theme.tint);
        label(s, mark, x + 0.23, y + (height - 0.69) / 2, 0.52, 0.52, 18, theme.violet, true, { align: 'center' });
      }
      const indent = mark ? 0.90 : 0.20;
      label(s, typeof member === 'string' ? member : member.label, x + indent, y + 0.12, memberWidth - indent - 0.24, height - 0.41, 18, theme.ink, true);
    });
  });
  if (p.note) label(s, p.note, left, 6.48, contentW, 0.28, 11, theme.muted);
}
function capabilities(s, p) {
  const height = 4.72 / p.items.length;
  p.items.forEach(([level, ...skills], i) => {
    // A progressively wider foundation keeps support relationships legible.
    const inset = (p.items.length - i - 1) * 0.46;
    const x = left + inset, y = 1.79 + i * height;
    const w = contentW - 2 * inset;
    panel(s, x, y, w, height - 0.30);
    rect(s, x, y, 2.42, height - 0.30, stageColors[3 - i % 3]);
    label(s, level, x + 0.10, y + 0.08, 2.22, height - 0.46, 19, 'FFFFFF', true, { align: 'center' });
    const step = (w - 2.58) / skills.length;
    skills.forEach((name, j) => {
      label(s, name, x + 2.50 + j * step, y + 0.10, step, height - 0.50, 18, theme.ink, true, { align: 'center' });
    });
    if (i > 0) shape(s, 'upArrow', W / 2 - 0.12, y - 0.28, 0.24, 0.26, theme.violet);
  });
}

function strategy(s, p) {
  const pillars = p.role === 'pillars';
  const top = pillars ? 2.50 : 1.85;
  if (pillars) {
    gradient(s, left, 1.62, contentW, 0.63);
    label(s, p.banner, left + 0.2, 1.64, contentW - 0.40, 0.57, 19, 'FFFFFF', true);
  }
  const width = (contentW + 0.16) / p.items.length;
  p.items.forEach(([title, metric, body, status], i) => {
    const x = left + i * width;
    panel(s, x, top, width - 0.16, 3.36);
    rect(s, x, top, width - 0.16, 0.60, stageColors[(i + 1) % 4]);
    label(s, title, x + 0.16, top + 0.03, width - 0.5, 0.52, 19, 'FFFFFF', true);
    label(s, metric, x + 0.18, top + 0.85, width - 0.52, 0.68, 21, theme.ink, true);
    label(s, body, x + 0.18, top + 1.64, width - 0.52, 0.78, 16);
    if (pillars) shape(s, 'roundRect', x + 0.18, top + 2.60, 1.5, 0.44, theme.tint);
    label(s, status, x + 0.18, top + 2.56, pillars ? 1.5 : width - 0.52, 0.51, 15, theme.violet, pillars, { align: pillars ? 'center' : 'left' });
  });
  rect(s, left, 6.02, contentW, 0.65, theme.tint);
  label(s, p.note, left + 0.16, 6.08, contentW - 0.32, 0.52, 15, theme.ink);
}
function appendix(s, p) {
  if (p.role === 'overview') {
    gradient(s, left, 1.70, contentW, 0.70);
    label(s, p.definition, left + 0.19, 1.74, contentW - 0.38, 0.60, 17, 'FFFFFF', true);
    label(s, '执行流程', left, 2.80, 4.75, 0.44, 17, theme.ink, true);
    const stepW = 5.06 / p.steps.length;
    p.steps.forEach((v, i) => {
      const x = left + i * stepW;
      shape(s, 'chevron', x, 3.41, stepW - 0.03, 0.66, stageColors[i % 4]);
      label(s, v, x + 0.08, 3.44, stepW - 0.19, 0.57, 18, 'FFFFFF', true, { align: 'center' });
    });
    label(s, p.label, 5.84, 2.81, 2.96, 0.43, 16, theme.ink, true);
    label(s, p.metric, 5.87, 3.34, 2.75, 1.04, 53, theme.blue, true);
    label(s, p.unit, 5.91, 4.52, 2.72, 0.45, 15);
    label(s, '价格说明', 8.91, 2.81, 3.83, 0.43, 17, theme.ink, true);
    primitives.table(s, p.table, { x: 8.91, y: 3.43, w: 3.82 }, theme);
    label(s, p.note, left, 5.82, contentW, 0.57, 14);
    return;
  }
  p.items.forEach(([num, title, detail], i) => {
    const x = left + (i % 2) * 6.24, y = 1.68 + Math.floor(i / 2) * 2.41;
    label(s, num, x, y, 0.80, 0.54, 22, theme.violet, true);
    label(s, title, x + 0.82, y, 5.15, 0.54, 17, theme.ink, true);
    rect(s, x, y + 0.63, 5.98, 0.022, theme.rule);
    label(s, detail, x, y + 0.77, 5.92, p.table && i === 3 ? 0.45 : 0.92, 15, theme.body);
    if (p.table && i === 3) primitives.table(s, p.table, { x, y: y + 1.31, w: 5.97 }, theme);
  });
}

async function generate(deck, out, use = 'report') {
  if (!['report', 'talk'].includes(use)) throw new Error('--use must be report or talk');
  if (!Array.isArray(deck.slides) || !deck.slides.length) throw new Error('Input must contain a nonempty slides array');
  const pptx = createPresentation({ title: deck.title, author: 'Meet Experience' });
  pptx.theme = { headFontFace: theme.cjk, bodyFontFace: theme.cjk, lang: 'zh-CN' };
  for (const p of deck.slides) {
    const s = pptx.addSlide();
    if (['cover', 'section', 'closing'].includes(p.role)) bookend(s, pptx, p, deck);
    else {
      const bodyTop = base(s, pptx, p, deck);
      const body = shiftedBody(s, bodyTop - 1.55);
      switch (p.role) {
        case 'trend': trend(body, pptx, p, use); break;
        case 'table': require('./dark_report_table.cjs').reportTable(s, p, theme, bodyTop); break;
        case 'stages': stages(body, p); break;
        case 'ecosystem': groupedRows(body, p); break;
        case 'capabilities': capabilities(body, p); break;
        case 'pillars': case 'paths': strategy(body, p); break;
        case 'overview': case 'detail': appendix(body, p); break;
        default: throw new Error('Unknown dark-report layout: ' + p.role);
      }
    }
    if (p.notes && !(p.role === 'trend' && use === 'talk')) s.addNotes(p.notes);
  }
  await writeReport(pptx, out);
}

if (require.main === module) {
  const { values } = require('node:util').parseArgs({ options: {
    input: { type: 'string', default: path.join(__dirname, 'dark_report_sample.json') },
    use: { type: 'string', default: 'report' }, out: { type: 'string', default: '/tmp/me-dark-report.pptx' },
  } });
  fs.readFile(values.input, 'utf8').then(raw => generate(JSON.parse(raw), values.out, values.use))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { generate, theme };
