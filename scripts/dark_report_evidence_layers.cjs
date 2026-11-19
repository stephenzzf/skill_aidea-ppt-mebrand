// Results and limits stay editable. Only the distinction between observed and
// unavailable layers is drawn, with the same plate width for every measure.
const { text } = require('./report_primitives.cjs');
const { lineCount } = require('./dark_report_table.cjs');

const LEFT = 0.55;
const LAYER_W = 7.42;
const GAP = 0.12;
const SIDE_X = 8.23;
const SIDE_W = 4.55;
const COLORS = { observed: '452789', unavailable: '5D5771' };

function statusPlateSvg(statuses, width, height) {
  const scale = 192;
  const w = width * scale;
  const h = height * scale;
  const gap = GAP * scale;
  const row = (h - gap * (statuses.length - 1)) / statuses.length;
  const plates = statuses.map((status, i) => {
    const y = i * (row + gap);
    const missing = status === 'unavailable';
    const fill = missing ? '#FFFFFF' : '#F2EFFB';
    const outline = missing ? 'stroke="#A69CB7" stroke-width="2" stroke-dasharray="10 7"' : 'stroke="none"';
    const rail = missing ? '' : `<rect x="1" y="${y + 1}" width="10" height="${row - 2}" fill="#5C0BE0"/>`;
    return `<rect x="1" y="${y + 1}" width="${w - 2}" height="${row - 2}" fill="${fill}" ${outline}/>${rail}`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w)}" height="${Math.round(h)}" viewBox="0 0 ${w} ${h}">${plates.join('')}</svg>`;
}

function put(slide, theme, field, value, x, y, w, h, size, color, bold = false) {
  if (typeof value !== 'string' || !value.trim()) throw Error('evidence-layers requires text for ' + field);
  if (lineCount(value, w, size) * size * 1.15 / 72 > h + 0.025)
    throw Error('evidence-layers text does not fit ' + field + '. Shorten or split this entry.');
  text(slide, value, x, y, w, h, theme, { fontSize: size, color, bold, objectName: field });
}

async function evidenceLayers(slide, page, theme, top) {
  const { layers, context, contextHeading, note } = page;
  if (!Array.isArray(layers) || layers.length < 2 || layers.length > 4) throw Error('evidence-layers requires 2–4 layers');
  if (layers.some(layer => !Object.hasOwn(COLORS, layer?.status))) throw Error('Unknown evidence-layers status');
  if (!Array.isArray(context) || context.length < 1 || context.length > 3) throw Error('evidence-layers requires 1–3 context entries');
  const height = (note ? 6.33 : 6.80) - top;
  const row = (height - GAP * (layers.length - 1)) / layers.length;
  const png = await require('sharp')(Buffer.from(statusPlateSvg(layers.map(l => l.status), LAYER_W, height))).png().toBuffer();
  slide.addImage({ data: 'image/png;base64,' + png.toString('base64'), x: LEFT, y: top, w: LAYER_W, h: height,
    objectName: 'ME_REPORT_EVIDENCE_PLATES', altText: '等宽证据层。实色边标示已有观测，虚线边标示资料缺失。' });
  layers.forEach((layer, i) => {
    const y = top + i * (row + GAP);
    put(slide, theme, 'layer-label-' + i, layer.label, LEFT + 0.22, y + 0.10, LAYER_W - 0.44, 0.30, 14, COLORS[layer.status], true);
    const resultSize = layers.length === 4 ? 19 : 24;
    put(slide, theme, 'layer-result-' + i, layer.result, LEFT + 0.22, y + 0.42, LAYER_W - 0.44, 0.43, resultSize, theme.ink, true);
    const detailY = layers.length === 4 ? 0.84 : 0.93;
    put(slide, theme, 'layer-detail-' + i, layer.detail, LEFT + 0.22, y + detailY, LAYER_W - 0.44, row - detailY - 0.04, 14, theme.body);
  });
  slide.addShape('rect', { x: SIDE_X, y: top, w: SIDE_W, h: height, line: { transparency: 100 }, fill: { color: 'F7F6FA' } });
  slide.addShape('rect', { x: SIDE_X, y: top, w: SIDE_W, h: 0.52, line: { transparency: 100 }, fill: { color: theme.ink } });
  put(slide, theme, 'context-heading', contextHeading, SIDE_X + 0.20, top + 0.06, SIDE_W - 0.40, 0.40, 16, 'FFFFFF', true);
  const entry = (height - 0.64) / context.length;
  context.forEach((item, i) => {
    const y = top + 0.64 + i * entry;
    if (i) slide.addShape('line', { x: SIDE_X + 0.20, y, w: SIDE_W - 0.40, h: 0, line: { color: theme.rule, width: 0.8 } });
    put(slide, theme, 'context-label-' + i, item?.label, SIDE_X + 0.20, y + 0.08, SIDE_W - 0.40, 0.33, 15, theme.ink, true);
    put(slide, theme, 'context-detail-' + i, item.detail, SIDE_X + 0.20, y + 0.42, SIDE_W - 0.40, entry - 0.52, 14, theme.body);
  });
  if (note) put(slide, theme, 'evidence-note', note, LEFT, 6.48, 12.22, 0.38, 12, theme.muted);
}

module.exports = { evidenceLayers };
