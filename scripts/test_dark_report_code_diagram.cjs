const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const sharp = require('sharp');
const { createPresentation } = require('./brand_ppt_helpers.cjs');
const JSZip = require('jszip');
const { addCodeDiagram } = require('./dark_report_code_diagram.cjs');

test('a coded visual exports its drawing, label and directional line separately', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'me-coded-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const source = path.join(dir,'routes.svg'), file = path.join(dir,'routes.png');
  fs.writeFileSync(source,'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><circle cx="50" cy="50" r="20"/></svg>');
  await sharp(source).png().toFile(file);
  const page = { visual:{ source, file, alt:'Shared return route', x:1,y:2,w:6,h:3 },
    labels:[{ text:'Return to review',x:2,y:3,w:2,h:.5 }],
    connectors:[{x1:4,y1:4,x2:2,y2:4,tail:true}] };
  const pptx = createPresentation(), slide = pptx.addSlide();
  const ctx = { theme:{ body:'121212', violet:'443388', latin:'Poppins', cjk:'等线' }, bodyTop:1.55 };
  addCodeDiagram(slide, page, ctx);
  const zip = await JSZip.loadAsync(await pptx.write({outputType:'nodebuffer'}));
  const xml = await zip.file('ppt/slides/slide1.xml').async('string');
  assert.match(xml, /<p:pic>/); assert.match(xml, /<a:t>Return to review<\/a:t>/);
  assert.match(xml, /tailEnd type="triangle"/); assert.match(xml, /flipH="1"/);
  assert.throws(() => addCodeDiagram(slide,{...page,visual:{...page.visual,h:1}},ctx),/aspect/);
  assert.throws(() => addCodeDiagram(slide,{...page,labels:[{...page.labels[0],y:7}]},ctx),/body/);
});
