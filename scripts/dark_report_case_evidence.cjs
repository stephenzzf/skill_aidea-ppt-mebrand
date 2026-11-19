// Screenshots are final visible crops. The renderer never reads their source decks.
const sharp = require('sharp');
const { text } = require('./report_primitives.cjs');

const nonempty = value => typeof value === 'string' && value.trim().length > 0;

async function visibleImage(item) {
  if (!item || !nonempty(item.caption) || !nonempty(item.source) ||
      !['flattened-redaction', 'visible-crop'].includes(item.protection)) {
    throw Error('case-evidence requires a caption, source locator and visible-crop or flattened-redaction declaration');
  }
  if (!nonempty(item.png) || !/^[a-zA-Z0-9+/]+={0,2}$/.test(item.png)) {
    throw Error('case-evidence expects inline base64 PNG pixels');
  }
  const bytes = Buffer.from(item.png, 'base64');
  if (!bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    throw Error('case-evidence expects a PNG signature');
  }
  const input = sharp(bytes, { failOn: 'warning' });
  const metadata = await input.metadata();
  if ((metadata.pages || 1) > 1) throw Error('case-evidence requires a single visible frame');
  // Composite transparent pixels onto the slide surface and re-encode. No
  // source-file metadata or payload after IEND belongs in an evidence image.
  const { data, info } = await input.flatten({ background: '#FFFFFF' }).removeAlpha().png()
    .toBuffer({ resolveWithObject: true });
  return { ...item, data: 'image/png;base64,' + data.toString('base64'), width: info.width, height: info.height };
}

function checkTrend(trend) {
  if (!Array.isArray(trend.labels) || !Array.isArray(trend.values) || trend.labels.length < 2 ||
      trend.labels.length !== trend.values.length || !trend.labels.every(nonempty) ||
      !trend.values.every(Number.isFinite) || !nonempty(trend.seriesName)) {
    throw Error('case-evidence trend requires a named series, labeled periods and matching finite numeric values');
  }
}

async function caseEvidence(slide, pptx, page, theme, bodyTop = 1.55) {
  const trend = page.trend;
  if (trend) checkTrend(trend);
  const items = page.evidence;
  if (!Array.isArray(items) || items.length < 1 || items.length > 4) throw Error('case-evidence requires 1–4 evidence images');
  if (!Array.isArray(page.actions) || !page.actions.length || page.actions.length > (trend ? 4 : 3)) throw Error('case-evidence requires actions');
  const pictures = await Promise.all(items.map(visibleImage));
  const scale = (6.86 - bodyTop) / (6.86 - 1.55);
  if (scale < 0.86) throw Error('case-evidence title leaves insufficient space');
  const box = (x, y, w, h) => ({ x, y: bodyTop + (y - 1.55) * scale, w, h: h * scale });
  function label(value, x, y, w, h, fontSize, color = theme.body, bold = false) {
    if (!nonempty(value)) throw Error('case-evidence requires text for the displayed claim, scope and evidence labels');
    const pos = box(x, y, w, h);
    text(slide, value, pos.x, pos.y, pos.w, pos.h, theme, { fontSize, color, bold });
  }
  function panel(x, y, w, h, fill) {
    slide.addShape(pptx.ShapeType.rect, { ...box(x, y, w, h), line: { color: theme.rule, width: 0.55 }, fill: { color: fill } });
  }
  function pic(item, x, y, w, h) {
    const b = box(x, y, w, h);
    const factor = Math.min(b.w / item.width, b.h / item.height);
    const iw = item.width * factor, ih = item.height * factor;
    slide.addImage({ data: item.data, x: b.x + (b.w - iw) / 2, y: b.y + (b.h - ih) / 2, w: iw, h: ih,
      objectName: 'ME_REPORT_CASE_EVIDENCE', altText: item.caption + '｜' + item.source });
  }
  if (trend) {
    label(page.lead, .55, 1.57, 12.20, .45, 14);
    panel(.55, 2.15, 3.68, 1.38, theme.tint);
    label(trend.metric, .71, 2.24, 3.31, .55, 32, theme.violet, true);
    label(trend.metricScope, .72, 2.88, 3.23, .50, 12, theme.ink);
    label(page.actionTitle, .56, 3.82, 3.60, .29, 14, theme.ink, true);
    if (!page.actions.every(nonempty)) throw Error('case-evidence trend actions require text');
    label(page.actions.join('\n'), .56, 4.23, 3.60, 1.20, 14);
    label(page.note, .56, 5.65, 3.58, 1.01, 12);
    label(page.evidenceTitle, 4.46, 2.12, 8.25, .30, 14, theme.ink, true);
    const stride = 8.32 / pictures.length;
    pictures.forEach((item, i) => {
      const x = 4.47 + i * stride, w = stride - .12;
      panel(x, 2.50, w, 1.31, theme.tint);
      pic(item, x + .05, 2.54, w - .10, .80);
      label(item.caption, x + .06, 3.39, w - .12, .31, 11, theme.ink, true);
    });
    label(trend.title, 4.47, 4.01, 8.16, .29, 14, theme.ink, true);
    label(trend.scope, 4.47, 4.35, 8.12, .30, 12);
    slide.addChart(pptx.ChartType.line, [{ name: trend.seriesName, labels: trend.labels, values: trend.values }],
      { ...box(4.48, 4.73, 8.22, 1.99), showLegend: false, showTitle: false, showValue: false,
        catAxisLabelFontFace: theme.cjk, catAxisLabelFontSize: 11, valAxisLabelFontFace: theme.latin,
        valAxisLabelFontSize: 10, valAxisLabelFormatCode: trend.numberFormat || 'General',
        chartColors: [theme.violet], lineSize: 2.4, showMarker: false, catAxisLineShow: false,
        valGridLine: { color: theme.rule, size: .5 }, objectName: trend.title });
    return;
  }
  label(page.lead, .55, 1.56, 4.35, .43, 14, theme.ink, true);
  label(page.goalTitle, .55, 2.04, 4.20, .26, 14, theme.ink, true);
  label(page.goal, .55, 2.36, 4.26, .79, 14);
  label(page.actionTitle, .55, 3.29, 4.20, .28, 14, theme.ink, true);
  const step = 1.87 / page.actions.length;
  page.actions.forEach((action, i) => {
    const y = 3.66 + step * i;
    label(action.title, .55, y, 4.24, .27, 13, theme.violet, true);
    label(action.detail, .55, y + .29, 4.25, step - .32, 12);
  });
  panel(.55, 5.64, 4.24, 1.08, theme.tint);
  label(page.resultTitle, .67, 5.73, 3.99, .26, 13, theme.ink, true);
  label(page.result, .67, 6.04, 3.99, .60, 12);
  label(page.evidenceTitle, 5.12, 1.56, 7.53, .29, 15, theme.ink, true);
  label(page.evidenceScope, 5.12, 1.89, 7.55, .29, 12);
  const featured = pictures[0], secondary = pictures.slice(1);
  const featuredHeight = secondary.length ? 1.81 : 3.22;
  pic(featured, 5.13, 2.24, 7.54, featuredHeight);
  label([featured.caption, featured.detail].filter(Boolean).join('｜'), 5.14, 2.32 + featuredHeight, 7.45, .37, 12, theme.ink, true);
  secondary.forEach((item, i) => {
    const stride = 7.68 / secondary.length, x = 5.14 + stride * i, w = stride - .13;
    panel(x, 4.62, w, 1.75, 'FFFFFF');
    pic(item, x + .06, 4.66, w - .12, 1.00);
    label(item.caption, x + .08, 5.70, w - .16, .27, 11, theme.violet, true);
    if (item.detail) label(item.detail, x + .08, 5.98, w - .16, .35, 11);
  });
  label(page.note, 5.13, 6.47, 7.59, .37, 10);
}

module.exports = { caseEvidence };
