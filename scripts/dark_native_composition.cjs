// Explicitly positioned, editable objects for an approved reading order.
const path = require('node:path');
const { text, table, symmetricAxis } = require('./report_primitives.cjs');
const { ME2026_ASSETS: assets, SLIDE_W, SLIDE_H, addME2026Footer } = require('./brand_ppt_helpers.cjs');

function renderNativeComposition(slide, pptx, page, theme) {
  if (!Array.isArray(page.nodes)) throw Error('native-composition requires a list of nodes');
  for (const n of page.nodes) {
    const { x, y, w, h } = n;
    if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0 || x < 0 || y < 0 ||
        x + w > SLIDE_W + .005 || y + h > SLIDE_H + .005) throw Error('Native object outside slide bounds');
    const box = { x, y, w, h };
    if (n.kind === 'text') {
      text(slide, n.text, x, y, w, h, theme, { fontSize: n.size, bold: !!n.bold,
        color: n.color || theme.body, align: n.align || 'left', valign: n.valign || 'mid' });
    } else if (n.kind === 'rect') {
      slide.addShape(pptx.ShapeType.rect, { ...box, fill: { color: n.fill },
        line: n.line ? { color: n.line, width: .6 } : { transparency: 100 } });
    } else if (n.kind === 'image') {
      if (!n.alt || typeof n.png !== 'string' || !n.png.startsWith('iVBORw0KGgo')) {
        throw Error('A native image needs final visible PNG pixels and an accessible description');
      }
      slide.addImage({ ...box, data: 'image/png;base64,' + n.png, altText: n.alt, objectName: n.alt });
    } else if (n.kind === 'bars') {
      if (!Array.isArray(n.labels) || !n.labels.length || !Array.isArray(n.values) ||
          n.labels.length !== n.values.length || !n.values.every(Number.isFinite) || !n.series) {
        throw Error('Bar chart requires a named series with matching labels and values');
      }
      if (n.scale !== undefined && (n.scale !== 'symmetric' || n.maximum !== undefined)) {
        throw Error('Use symmetric scale alone or supply a maximum for the default scale.');
      }
      if (n.order !== undefined && n.order !== 'top-down') throw Error('Unsupported bar category order.');
      slide.addChart(pptx.ChartType.bar, [{name:n.series, labels:n.labels, values:n.values}], {
        ...box, barDir:'bar', barGrouping:'clustered', showLegend:false, showTitle:false, showValue:true,
        ...(n.scale === 'symmetric' ? symmetricAxis(n.values) : { valAxisMaxVal:n.maximum }),
        ...(n.order === 'top-down' ? { catAxisOrientation:'maxMin' } : {}),
        dataLabelFormatCode:n.format || 'General', valAxisLabelFormatCode:n.format || 'General',
        chartColors:[theme.blue], catAxisLabelFontFace:theme.cjk, catAxisLabelFontSize:12,
        dataLabelPosition:'outEnd', showCatName:false, valGridLine:{color:theme.rule, size:.5}
      });
    } else if (n.kind === 'table') {
      if (!Array.isArray(n.widths) || !n.widths.length || !Array.isArray(n.heights) ||
          [...n.widths, ...n.heights].some(v => !Number.isFinite(v) || v <= 0) ||
          !Array.isArray(n.rows) || !n.rows.length || n.rows.some(row => !Array.isArray(row) || row.length !== n.widths.length) ||
          n.heights.length !== n.rows.length) throw Error('Native table dimensions do not match the supplied rows');
      table(slide, n.rows, { ...box, colW: n.widths, rowH: n.heights, fontSize: n.size }, theme,
        (r, c) => ({ fontFace: /^[ -~]+$/.test(String(n.rows[r][c])) ? theme.latin : theme.cjk,
          bold: !r || !c || (n.highlightLast && r === n.rows.length - 1), color: r ? theme.body : 'FFFFFF',
          fill: { color: !r ? theme.ink : !c || (n.highlightLast && r === n.rows.length - 1) ? theme.tint : 'FFFFFF' } }));
    } else throw Error('Unknown native composition node: ' + n.kind);
  }
}

function renderBrandedBookend(slide, pptx, page, deck, theme) {
  const dir = path.join(path.dirname(assets.coverBg), 'dark-report');
  slide.addImage({ path: path.join(dir,'section.png'), x:0,y:0,w:SLIDE_W,h:SLIDE_H,objectName:'ME_REPORT_BRAND_BACKGROUND' });
  slide.addImage({ path: path.join(dir,'section-steps.png'), x:9.55,y:.5,w:3.2,h:2.69,altText:'品牌几何图形' });
  renderNativeComposition(slide,pptx,page,theme);
  slide.addShape(pptx.ShapeType.rect,{x:.43,y:7.015,w:3.26,h:.39,fill:{color:'FFFFFF'},line:{transparency:100}});
  const emu = 914400;
  addME2026Footer(slide,pptx,null,{brandVariant:'legacy',centerY:6609513/emu,meX:539113/emu,
    meW:1278980/emu,meH:105953/emu,dividerX:1937872/emu,dividerH:135129/emu,dividerColor:'A6A6A6',dividerWidth:.5,
    groupX:1994094/emu,groupW:1221586/emu,groupH:159134/emu});
}

module.exports = { renderNativeComposition, renderBrandedBookend };
