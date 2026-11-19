// A reproducible drawing provides the geometry. Its labels and direction markers
// are independent PowerPoint objects so the reader can revise them after export.
const fs = require('node:fs');
const { text } = require('./report_primitives.cjs');

function addCodeDiagram(slide, page, { theme, bodyTop }) {
  const { visual, labels, connectors = [] } = page;
  if (!visual?.alt?.trim() || !visual.source || !fs.statSync(visual.source).isFile()) {
    throw new Error('coded-diagram requires alt text and the original drawing source file');
  }
  if (!Array.isArray(labels) || !labels.length) throw new Error('coded-diagram requires editable labels');

  const bottom = page.note ? 6.48 : 6.86;
  function inside(x, y) {
    return Number.isFinite(x) && Number.isFinite(y) && x >= 0.54 && x <= 12.80 && y >= bodyTop - 0.001 && y <= bottom + 0.001;
  }
  function checkBox({ x, y, w, h }) {
    if (!(w > 0 && h > 0 && inside(x, y) && inside(x + w, y + h))) {
      throw new Error('coded-diagram geometry exceeds the slide body or its note area');
    }
    return { x, y, w, h };
  }
  const bitmap = fs.readFileSync(visual.file);
  if (bitmap.length < 24 || !bitmap.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    throw new Error('coded-diagram expects a rendered PNG');
  }
  const box = checkBox(visual);
  const sourceAspect = bitmap.readUInt32BE(16) / bitmap.readUInt32BE(20);
  if (Math.abs(sourceAspect / (box.w / box.h) - 1) > 0.025) {
    throw new Error('coded-diagram PNG and placement aspect ratios differ; realign the overlay');
  }
  slide.addImage({ ...box, data: 'image/png;base64,' + bitmap.toString('base64'),
    objectName: 'ME_REPORT_CODE_DIAGRAM', altText: visual.alt });
  for (const { x1, y1, x2, y2, color = theme.violet, width = 1.5, head, tail, dash } of connectors) {
    if (!inside(x1, y1) || !inside(x2, y2) || (x1 === x2 && y1 === y2)) {
      throw new Error('coded-diagram connector endpoints must be distinct and inside the body');
    }
    slide.addShape('line', { x: Math.min(x1, x2), y: Math.min(y1, y2),
      w: Math.abs(x2-x1), h: Math.abs(y2-y1), flipH: x2 < x1, flipV: y2 < y1,
      line: { color, width, dashType: dash, beginArrowType: head ? 'triangle' : undefined,
        endArrowType: tail ? 'triangle' : undefined } });
  }
  for (const item of labels) {
    if (typeof item.text !== 'string' || !item.text.trim()) throw new Error('coded-diagram label is empty');
    const { x,y,w,h } = checkBox(item);
    text(slide, item.text, x,y,w,h, theme, { fontSize: item.size ?? 15, color: item.color ?? theme.body,
      align: item.align ?? 'left', bold: !!item.bold, objectName: item.text });
  }
  if (page.note) text(slide, page.note, 0.55, 6.51, 12.23, 0.30, theme, { fontSize: 12, color: theme.muted });
}
module.exports = { addCodeDiagram };
