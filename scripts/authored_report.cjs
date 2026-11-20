// A source-locked standard ME2026 deck can share copy and assets while giving
// the reader and the speaker different arrangements of editable objects.
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createPresentation, addME2026Cover, addME2026WhiteBase } = require('./brand_ppt_helpers.cjs');
const { renderCodeVisualBytes } = require('./render_code_visual.cjs');

function resolveCopy(value, copy) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(item => resolveCopy(item, copy));
  if (Object.hasOwn(value, 'copy')) {
    const source = copy[value.copy - 1];
    if (!Number.isInteger(value.copy) || typeof source !== 'string') throw Error('Unknown source paragraph: ' + value.copy);
    const [from, to] = value.slice || [0, source.length];
    if (![from, to].every(Number.isInteger) || from < 0 || to < from || to > source.length) {
      throw Error('Text range exceeds source paragraph ' + value.copy);
    }
    let content = source.slice(from, to);
    for (const offset of [...(value.breaks || [])].reverse()) {
      if (!Number.isInteger(offset) || offset < 0 || offset > to - from) throw Error('Invalid layout break');
      content = content.slice(0, offset) + '\n' + content.slice(offset);
    }
    return content;
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveCopy(item, copy)]));
}

async function imageData(asset, directory) {
  if (!asset || Boolean(asset.spec) === Boolean(asset.file)) throw Error('Choose one diagram spec or approved PNG.');
  if (asset.spec) return (await renderCodeVisualBytes(JSON.stringify(asset.spec))).png;
  const file = await fs.realpath(path.resolve(directory, asset.file));
  const relative = path.relative(await fs.realpath(directory), file);
  if (relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw Error('Asset outside the Brief directory.');
  const data = await fs.readFile(file);
  if (!data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) ||
      createHash('sha256').update(data).digest('hex') !== asset.sha256) {
    throw Error('Asset must match its approved PNG and SHA-256: ' + relative);
  }
  return data;
}

async function generate(deck, out, use = 'report', briefDir = '.') {
  if (!['report', 'talk'].includes(use) || !Array.isArray(deck.slides) || !deck.slides.length) {
    throw Error('An authored deck requires slides and a report or talk use.');
  }
  const pptx = createPresentation({ title: deck.title, author: 'Meet Experience' });
  const images = new Map();
  for (const page of deck.slides) {
    if (!Array.isArray(page[use]) || !page[use].length) throw Error('Missing ' + use + ' layout.');
    const slide = pptx.addSlide();
    for (const item of page[use]) {
      const o = resolveCopy(item, deck.copy || []);
      switch (o.type) {
        case 'cover': addME2026Cover(slide, pptx, o.options); break;
        case 'body': addME2026WhiteBase(slide, pptx, o.title, o.page, o.options); break;
        case 'text': slide.addText(o.value, o.options); break;
        case 'shape': slide.addShape(o.shape, o.options); break;
        case 'table': slide.addTable(o.rows, o.options); break;
        case 'chart': slide.addChart(o.chart, o.series, o.options); break;
        case 'picture': {
          if (!images.has(o.asset)) images.set(o.asset, await imageData(deck.assets?.[o.asset], briefDir));
          slide.addImage({ ...o.options, data: 'image/png;base64,' + images.get(o.asset).toString('base64') });
          break;
        }
        default: throw Error('Unsupported authored object: ' + o.type);
      }
    }
    if (page[use + 'Notes']) slide.addNotes(page[use + 'Notes']);
  }
  await fs.mkdir(path.dirname(path.resolve(out)), { recursive: true });
  await pptx.writeFile({ fileName: out, compression: true });
}

module.exports = { generate };
