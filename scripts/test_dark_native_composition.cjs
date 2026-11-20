const assert = require('node:assert/strict');
const test = require('node:test');
const JSZip = require('jszip');
const { createPresentation } = require('./brand_ppt_helpers.cjs');
const { renderNativeComposition } = require('./dark_native_composition.cjs');
const theme = {ink:'2E1F6B',body:'4D4A66',blue:'2F7BEF',tint:'F4F1FB',rule:'DFDCE8',cjk:'等线',latin:'Poppins'};

test('native review composition preserves editable charts, grid and copy', async () => {
  const pptx = createPresentation(), slide = pptx.addSlide();
  renderNativeComposition(slide,pptx,{nodes:[
    {kind:'text',x:1,y:1,w:8,h:.5,text:'实际值',size:14},
    {kind:'bars',x:1,y:2,w:5,h:3,labels:['甲','乙'],values:[.6,.42],series:'样本',maximum:.8,format:'0%'},
    {kind:'table',x:6,y:2,w:5,h:1.5,widths:[2,3],heights:[.75,.75],rows:[['组别','值'],['A','60%']],size:14},
  ]},theme);
  const zip = await JSZip.loadAsync(await pptx.write({outputType:'nodebuffer'}));
  const slideXml = await zip.file('ppt/slides/slide1.xml').async('string');
  assert.match(slideXml,/<a:t>实际值<\/a:t>/); assert.match(slideXml,/<a:tbl>/);
  const chartXml = await zip.file('ppt/charts/chart1.xml').async('string');
  assert.match(chartXml,/<c:v>0.42<\/c:v>/);
  assert.ok(zip.file(/^ppt\/embeddings\/.*\.xlsx$/).length);
});

test('unsupported objects, unavailable image pixels and off-slide geometry fail early', () => {
  const pptx=createPresentation(), slide=pptx.addSlide();
  for (const node of [{kind:'object'}, {kind:'image',alt:'证据',png:'abc'}, {kind:'text',x:20,text:'超出',size:14}]) {
    assert.throws(() => renderNativeComposition(slide,pptx,{nodes:[{x:1,y:1,w:1,h:1,...node}]},theme));
  }
});

test('signed native bars keep chronological categories away from the negative bars', async () => {
  const pptx = createPresentation();
  const node = {kind:'bars', x:1, y:1, w:6, h:3, labels:['Period A','Period B'],
    values:[-.25,.5], series:'Relative change', scale:'symmetric', order:'top-down', format:'0%'};
  renderNativeComposition(pptx.addSlide(), pptx, {nodes:[node]}, theme);
  const zip = await JSZip.loadAsync(await pptx.write({outputType:'nodebuffer'}));
  const [chart] = zip.file(/^ppt\/charts\/chart\d+\.xml$/);
  const xml = await chart.async('string');
  for (const value of ['<c:min val="-0.7"/>', '<c:max val="0.7"/>', '<c:tickLblPos val="low"/>',
    '<c:orientation val="maxMin"/>','<c:v>-0.25</c:v>']) assert.ok(xml.includes(value), value);
  assert.throws(() => renderNativeComposition(pptx.addSlide(), pptx,
    {nodes:[{...node, maximum:1}]}, theme), /symmetric/);
});
