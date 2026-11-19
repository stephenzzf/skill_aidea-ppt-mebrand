// Controlled icon vocabulary and fixed text sizes for independently readable briefings.
const { ME2026_ICON_LIBRARY, prepareIconCache, addME2026IconBadge } = require('./brand_ppt_helpers.cjs');
const { lineCount } = require('./dark_report_table.cjs');
const { text } = require('./report_primitives.cjs');

const LEFT = 0.55;
const WIDTH = 12.23;
const BOTTOM = 6.82;
const GAP = 0.16;
const INK = '452789';

function heightFor(value, width, size) {
  return Math.max(0.27, lineCount(value, width, size) * size * 1.24 / 72 + 0.07);
}

function label(slide, theme, value, x, y, w, h, size, options = {}) {
  if (heightFor(value, w, size) > h + 0.015)
    throw Error('icon-briefing text does not fit: ' + value + '. Use rows or split the entry.');
  text(slide, value, x, y, w, h, theme, { fontSize: size, ...options });
}

function badge(slide, pptx, item, x, y, diameter = 0.63) {
  addME2026IconBadge(slide, pptx, item.icon, x, y, diameter, {
    tone: 'purple', color: INK, fill: 'F0EBFB', appearance: 'circle', glyphScale: 0.64,
    strokeWidth: 2.25, label: item.title,
  });
}

function columns(slide, pptx, theme, items, top, bottom) {
  const width = (WIDTH - (items.length - 1) * GAP) / items.length;
  const inner = width - 0.46;
  const available = bottom - top;
  // Try a more prominent comparison first. Dense notes retain the established smaller sizes.
  for (const [titleSize, bodySize, diameter] of [[22, 18, 0.78], [19, 16, 0.63]]) {
    const titleH = Math.max(...items.map(item => heightFor(item.title, inner, titleSize)));
    const bodyH = Math.max(...items.map(item => heightFor(item.detail, inner, bodySize)));
    const titleOffset = 0.23 + diameter + 0.18;
    const bodyOffset = titleOffset + titleH + 0.13;
    const height = bodyOffset + bodyH + 0.23;
    if (height > available) continue;
    const y = top + (available - height) / 2;
    items.forEach((item, i) => {
      const x = LEFT + i * (width + GAP);
      slide.addShape('rect', { x, y, w: width, h: height, line: { color: theme.rule, width: 0.7 }, fill: { color: 'FFFFFF' } });
      badge(slide, pptx, item, x + 0.23 + diameter / 2, y + 0.23 + diameter / 2, diameter);
      label(slide, theme, item.title, x + 0.23, y + titleOffset, inner, titleH, titleSize, { color: theme.ink, bold: true });
      label(slide, theme, item.detail, x + 0.23, y + bodyOffset, inner, bodyH, bodySize, { valign: 'top' });
    });
    return;
  }
  throw Error('icon-briefing text does not fit in columns. Use rows or split the entry.');
}

function row(slide, pptx, theme, item, y, h, index) {
  slide.addShape('rect', { x: LEFT, y, w: WIDTH, h, line: { transparency: 100 },
    fill: { color: index % 2 === 0 ? 'F6F4FA' : 'FBFAFD' } });
  badge(slide, pptx, item, LEFT + 0.55, y + h / 2);
  label(slide, theme, item.title, LEFT + 1.01, y + 0.07, 3.09, h - 0.14, 17, { color: theme.ink, bold: true });
  label(slide, theme, item.detail, LEFT + 4.35, y + 0.07, WIDTH - 4.60, h - 0.14, 16);
}

async function iconBriefing(slide, pptx, page, theme, bodyTop) {
  const { items, layout = 'rows', lead, note } = page;
  if (!['rows', 'columns'].includes(layout)) throw Error('icon-briefing layout must be rows or columns.');
  if (!Array.isArray(items) || items.length < 2 || items.length > 4)
    throw Error('icon-briefing requires two to four items.');
  for (const item of items) {
    if (typeof item?.icon !== 'string' || !Object.hasOwn(ME2026_ICON_LIBRARY, item.icon))
      throw Error('Unknown semantic icon: ' + item?.icon);
    for (const field of ['title', 'detail']) {
      if (typeof item[field] !== 'string' || !item[field].trim())
        throw Error('icon-briefing requires nonempty ' + field);
    }
  }
  for (const value of [lead, note]) {
    if (value != null && (typeof value !== 'string' || !value.trim()))
      throw Error('icon-briefing lead and note must contain text when supplied.');
  }
  // Registry picture assets already have pixels; the other entries are Lucide glyphs.
  const glyphs = items.map(item => ME2026_ICON_LIBRARY[item.icon].icon).filter(Boolean);
  if (glyphs.length) await prepareIconCache(glyphs, [INK], 2.25);

  const leadH = lead ? heightFor(lead, WIDTH, 17) : 0;
  const noteH = note ? heightFor(note, WIDTH - 0.40, 14) + 0.16 : 0;
  const top = bodyTop + (lead ? leadH + GAP : 0);
  const bottom = BOTTOM - (note ? noteH + GAP : 0);
  if (lead) label(slide, theme, lead, LEFT, bodyTop, WIDTH, leadH, 17, { color: theme.ink, bold: true });
  if (layout === 'columns') {
    columns(slide, pptx, theme, items, top, bottom);
  } else {
    const h = (bottom - top - (items.length - 1) * GAP) / items.length;
    if (h < 0.75) throw Error('icon-briefing rows do not fit; shorten the lead or note.');
    items.forEach((item, i) => row(slide, pptx, theme, item, top + i * (h + GAP), h, i));
  }
  if (note) {
    slide.addShape('rect', { x: LEFT, y: BOTTOM - noteH, w: WIDTH, h: noteH,
      line: { transparency: 100 }, fill: { color: 'EEECF6' } });
    label(slide, theme, note, LEFT + 0.20, BOTTOM - noteH + 0.08, WIDTH - 0.40, noteH - 0.16, 14, { color: theme.ink });
  }
}

module.exports = { iconBriefing };
