// Native, themeable components shared by authored ME report and talk pages.
function text(slide, value, x, y, w, h, theme, options = {}) {
  // PptxGenJS propagates a newline inside one formatted run onto its last
  // fragment too. Mark only the actual paragraph boundary before serialization.
  const lines = String(value).split(/\r\n|[\r\n]/);
  const runs = lines.flatMap((line, lineIndex) => {
    const parts = line.split(/([A-Za-z0-9][A-Za-z0-9 %./+&-]*)/g).filter(Boolean);
    if (!parts.length) parts.push('');
    return parts.map((part, index) => ({
      text: part,
      options: {
        fontFace: /^[A-Za-z0-9]/.test(part) ? theme.latin : theme.cjk,
        breakLine: lineIndex < lines.length - 1 && index === parts.length - 1,
      },
    }));
  });
  slide.addText(runs, { x, y, w, h, fontSize: 15, color: theme.body, margin: 0,
    valign: 'mid', align: 'left', breakLine: false, lang: 'zh-CN', ...options });
}

function table(slide, rows, box, theme, cellStyle, { focusRow, focusColumn, links = [] } = {}) {
  const cells = rows.map((row, i) => row.map((value, j) => {
    const header = i === 0;
    const selectedRow = !header && i - 1 === focusRow;
    const selectedColumn = j === focusColumn;
    const accent = selectedColumn && (header || selectedRow);
    const shade = selectedRow || selectedColumn;
    const url = links.find(link => link.row === i && link.column === j)?.url;
    const options = cellStyle ? cellStyle(i, j) : {
        bold: header || (selectedRow && (j === 0 || selectedColumn)),
        color: accent ? 'FFFFFF' : header || shade ? theme.ink : theme.body,
        fill: { color: accent ? theme.ink : header || shade ? theme.tint : 'FFFFFF' },
      };
    return { text: url ? [{ text: String(value), options: { hyperlink: { url } } }] : String(value), options };
  }));
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
function symmetricAxis(values, alignTicks = false) {
  let limit = values.reduce((largest, value) => Math.max(largest, Math.abs(value)), 0) * 1.4 || 1;
  if (!alignTicks) return { valAxisMinVal: -limit, valAxisMaxVal: limit, catAxisLabelPos: 'low' };
  // Explicit intervals keep the central tick at zero in both Impress and PowerPoint.
  const target = limit / 3;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const step = [1, 2, 5, 10].find(unit => unit * magnitude >= target) * magnitude;
  limit = Number((Math.ceil(limit / step) * step).toPrecision(12));
  return { valAxisMinVal: -limit, valAxisMaxVal: limit, valAxisMajorUnit: step, catAxisLabelPos: 'low' };
}

module.exports = { symmetricAxis, text, table, chart };
