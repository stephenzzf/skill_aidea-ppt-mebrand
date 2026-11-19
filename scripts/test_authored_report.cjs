const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const JSZip = require('jszip');
const { generate } = require('./authored_report.cjs');

test('report and talk draw different native objects from the same source copy', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'me-shared-copy-'));
  try {
    const geo = { x: 1, y: 1, w: 8, h: 1 };
    const brief = { copy: ['同比', '约10%'], slides: [{
      report: [{ type: 'table', rows: [[{ text: { copy: 1 } }, { text: { copy: 2 } }]], options: geo }],
      talk: [{ type: 'text', value: [{ text: { copy: 2, slice: [0, 1] } },
        { text: { copy: 2, slice: [1, 4] }, options: { bold: true } }], options: geo }],
      talkNotes: '指向增幅及其约数标志。',
    }] };
    for (const use of ['report', 'talk']) {
      const file = path.join(dir, use + '.pptx');
      await generate(brief, file, use, dir);
      const zip = await JSZip.loadAsync(await fs.readFile(file));
      const xml = await zip.file('ppt/slides/slide1.xml').async('text');
      if (use === 'report') {
        assert.match(xml, /<a:tbl>/);
        assert.match(xml, /<a:t>约10%<\/a:t>/);
      } else {
        assert.doesNotMatch(xml, /<a:tbl>/);
        assert.match(xml, /<a:t>10%<\/a:t>/);
        assert.match(await zip.file('ppt/notesSlides/notesSlide1.xml').async('text'), /指向增幅/);
      }
    }
    brief.slides[0].talk[0].value[1].text.slice[1] = 9;
    await assert.rejects(generate(brief, path.join(dir, 'invalid.pptx'), 'talk', dir), /exceeds source paragraph/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
