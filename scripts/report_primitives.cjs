// Native, themeable components shared by authored ME report and talk pages.
function text(slide, value, x, y, w, h, theme, options = {}) {
  const runs = String(value).split(/([A-Za-z0-9][A-Za-z0-9 %./+&-]*)/g).filter(Boolean)
    .map(part => ({ text: part, options: { fontFace: /^[A-Za-z0-9]/.test(part) ? theme.latin : theme.cjk } }));
  slide.addText(runs, { x, y, w, h, fontSize: 15, color: theme.body, margin: 0,
    valign: 'mid', align: 'left', breakLine: false, lang: 'zh-CN', ...options });
}

function table(slide, rows, box, theme) {
  const cells = rows.map((row, i) => row.map(value => ({
    text: String(value), options: { bold: i === 0, color: i === 0 ? theme.ink : theme.body,
      fill: { color: i === 0 ? theme.tint : 'FFFFFF' } },
  })));
  slide.addTable(cells, { fontFace: theme.cjk, fontSize: 14,
    rowH: 0.42, margin: 0.08, border: { type: 'solid', pt: 0.6, color: theme.rule }, ...box, autoPage: false });
}

function chart(slide, pptx, page, box, theme) {
  slide.addChart(pptx.ChartType.bar, [{ name: page.chartTitle, labels: page.labels, values: page.values }],
    { ...box, barDir: 'col', catAxisLabelFontFace: theme.cjk, catAxisLabelFontSize: 13,
      valAxisLabelFontFace: theme.latin, valAxisLabelFontSize: 11, valAxisMinVal: page.values.every(value => value >= 0) ? 0 : undefined,
      chartColors: [theme.blue], showLegend: false, showValue: true, showTitle: false,
      dataLabelFormatCode: page.numberFormat || (page.values.every(Number.isInteger) ? '0' : 'General'), dataLabelPosition: 'outEnd', dataLabelColor: theme.ink, dataLabelFontFace: theme.latin,
      dataLabelFontBold: true, dataLabelFontSize: 16, showCatName: false,
      valGridLine: { color: theme.rule, size: 0.5 } });
}
module.exports = { text, table, chart };
