#!/usr/bin/env node
const assert = require("node:assert/strict");
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { addME2026Index } = require("./brand_ppt_helpers.cjs");
const { exitCodeFromSpawnResult } = require("./generate_me2026_deck.cjs");

function createSlideRecorder() {
  const slide = {
    texts: [],
    shapes: [],
    images: [],
    addText(text, options) {
      this.texts.push({ text: String(text), ...options });
    },
    addShape(type, options) {
      this.shapes.push({ type, ...options });
    },
    addImage(options) {
      this.images.push(options);
    },
  };
  const pptx = {
    ShapeType: new Proxy(Object.create(null), { get: (_target, property) => String(property) }),
  };
  return { slide, pptx };
}

function renderIndexRows(items, options) {
  const recorder = createSlideRecorder();
  if (options === undefined) addME2026Index(recorder.slide, recorder.pptx, items);
  else addME2026Index(recorder.slide, recorder.pptx, items, options);

  const numbers = recorder.slide.texts.filter((item) => item.x === 5.9 && item.w === 0.82);
  const labels = recorder.slide.texts.filter((item) => item.x === 6.95 && item.w === 5.8);
  const rows = numbers.map((number, index) => ({ number: number.text, label: labels[index]?.text, y: labels[index]?.y }));
  return { ...recorder, rows };
}

function testDefaultIndexContract() {
  const expected = [
    { number: "01", label: "MeetSocial介绍" },
    { number: "02", label: "泛APP行业WhatsApp解决方案" },
    { number: "03", label: "服务案例" },
    { number: "04", label: "服务价格" },
  ];
  assert.deepEqual(renderIndexRows(undefined).rows.map(({ number, label }) => ({ number, label })), expected);
  assert.deepEqual(renderIndexRows([]).rows.map(({ number, label }) => ({ number, label })), expected);
}

function testStringAndTupleRows() {
  const strings = ["核心结论", "公开证据链", "AI能力地图", "应用场景与尽调建议"];
  assert.deepEqual(
    renderIndexRows(strings).rows.map(({ number, label }) => ({ number, label })),
    strings.map((label, index) => ({ number: String(index + 1).padStart(2, "0"), label }))
  );

  const tuples = [[1, "产品定位"], ["A2", "能力与边界"]];
  assert.deepEqual(
    renderIndexRows(tuples, { pageNum: 2 }).rows.map(({ number, label }) => ({ number, label })),
    [{ number: "1", label: "产品定位" }, { number: "A2", label: "能力与边界" }]
  );
}

function testMalformedRowsFailBeforeDrawing() {
  const malformedInputs = [
    { pageNum: 2, rows: [["01", "错误重载"]] },
    ["有效标签", ["02", "混合格式"]],
    [["01", "" ]],
    [["01", "多余元素", "非法"]],
    null,
  ];

  for (const items of malformedInputs) {
    const recorder = createSlideRecorder();
    assert.throws(() => addME2026Index(recorder.slide, recorder.pptx, items), TypeError);
    assert.equal(recorder.slide.shapes.length, 0, "invalid rows must fail before mutating the slide");
  }

  const recorder = createSlideRecorder();
  assert.throws(() => addME2026Index(recorder.slide, recorder.pptx, [["01", "标题"]], []), TypeError);
  assert.equal(recorder.slide.shapes.length, 0, "invalid options must fail before mutating the slide");
}

function testSixRowsFitAboveFooter() {
  const labels = ["定位与目标", "架构流程", "方案对比", "短剧功能", "营销视频", "决策总结"];
  const result = renderIndexRows(labels);
  assert.equal(result.rows.length, 6);
  assert.deepEqual(result.rows.map(({ label }) => label), labels);

  const finalLabel = result.slide.texts.find((item) => item.x === 6.95 && item.text === labels.at(-1));
  const pageNumber = result.slide.texts.find((item) => item.x === 12.62 && item.text === "2");
  assert.ok(finalLabel, "the sixth row must be present");
  assert.ok(pageNumber, "the index footer page number must be present");
  assert.ok(finalLabel.y + finalLabel.h <= pageNumber.y - 0.17, "the final label must clear the footer");

  assert.throws(
    () => renderIndexRows(labels, { rowGap: 1.18 }),
    RangeError,
    "an explicitly oversized rowGap must fail instead of clipping rows",
  );
  assert.throws(
    () => renderIndexRows(Array.from({ length: 7 }, (_, index) => `目录${index + 1}`)),
    RangeError,
    "directories longer than six rows must be split across pages",
  );

  const oversized = createSlideRecorder();
  assert.throws(
    () => addME2026Index(oversized.slide, oversized.pptx, Array.from({ length: 7 }, (_, index) => `目录${index + 1}`)),
    /split longer directories across pages/,
  );
  assert.equal(oversized.slide.shapes.length, 0, "oversized indexes must fail before mutating the slide");
}


const ROOT = path.resolve(__dirname, "..");
const REQUIRED_SCENARIO_INDEXES = [
  {
    name: "video-localization",
    labels: [
      "产品定位与目标",
      "架构流程与模式配置",
      "方案对比与火山云工作流",
      "短剧功能模块",
      "营销视频与 Agent 能力",
      "0429 决策总结",
    ],
    count: 16,
  },
  {
    name: "ai-capability",
    labels: ["核心结论", "公开证据链", "AI能力地图", "应用场景与尽调建议"],
    count: 10,
  },
  {
    name: "component-catalog",
    labels: ["设计 Tokens", "卡片与行组件", "标准内容模块", "Contact Us 尾页"],
    count: 6,
  },
];

const PPTX_INDEX_READER = String.raw`
import json, sys, zipfile
from xml.etree import ElementTree as ET
pptx = sys.argv[1]
expected = json.loads(sys.argv[2])
ns = {'p':'http://schemas.openxmlformats.org/presentationml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
with zipfile.ZipFile(pptx) as z:
    pres=ET.fromstring(z.read('ppt/presentation.xml'))
    size=pres.find('p:sldSz',ns)
    width,height=int(size.attrib['cx']),int(size.attrib['cy'])
    slide=ET.fromstring(z.read('ppt/slides/slide2.xml'))
    shapes=[]
    for sp in slide.findall('.//p:sp',ns):
        text=''.join(t.text or '' for t in sp.findall('.//a:t',ns)).strip()
        xfrm=sp.find('./p:spPr/a:xfrm',ns)
        if not text or xfrm is None: continue
        off=xfrm.find('a:off',ns); ext=xfrm.find('a:ext',ns)
        if off is None or ext is None: continue
        shapes.append({'text':text,'x':int(off.attrib.get('x',0)),'y':int(off.attrib.get('y',0)),'w':int(ext.attrib.get('cx',0)),'h':int(ext.attrib.get('cy',0))})
    matches=[]
    for label in expected:
        rows=[item for item in shapes if item['text']==label]
        matches.append({'label':label,'count':len(rows),'row':rows[0] if len(rows)==1 else None})
    footer=[item for item in shapes if item['text']=='2']
    print(json.dumps({'slide_width':width,'slide_height':height,'matches':matches,'footer':footer,'shape_texts':[item['text'] for item in shapes]},ensure_ascii=False))
`;

function inspectGeneratedIndex(pptxPath, expectedLabels, scenarioName) {
  const result = spawnSync("python3", ["-c", PPTX_INDEX_READER, pptxPath, JSON.stringify(expectedLabels)], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  assert.equal(result.status, 0, `${scenarioName}: OOXML inspection failed: ${result.stderr || result.error || result.status}`);
  const report = JSON.parse(result.stdout);
  assert.equal(report.matches.length, expectedLabels.length, `${scenarioName}: index row count changed`);
  assert.deepEqual(report.shape_texts.filter((text) => expectedLabels.includes(text)).length, expectedLabels.length, `${scenarioName}: duplicate directory labels detected`);
  assert.deepEqual(report.matches.map((item) => item.label), expectedLabels, `${scenarioName}: index row order changed`);
  for (const match of report.matches) {
    assert.equal(match.count, 1, `${scenarioName}: expected exactly one directory row for '${match.label}'`);
    const { x, y, w, h } = match.row;
    assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0, `${scenarioName}: '${match.label}' has invalid geometry`);
    assert.ok(x + w <= report.slide_width, `${scenarioName}: '${match.label}' exceeds slide width`);
    assert.ok(y + h <= report.slide_height, `${scenarioName}: '${match.label}' exceeds slide height`);
  }
  assert.equal(report.footer.length, 1, `${scenarioName}: index page number must occur once`);
  const lastRow = report.matches.at(-1).row;
  assert.ok(lastRow.y + lastRow.h <= report.footer[0].y, `${scenarioName}: last row overlaps the footer`);
  assert.deepEqual(
    report.matches.map((item) => item.row.y),
    [...report.matches.map((item) => item.row.y)].sort((a, b) => a - b),
    `${scenarioName}: directory rows are not in vertical reading order`,
  );
}

function testRealScenarioIndexPptx() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "me2026-real-index-"));
  try {
    for (const scenario of REQUIRED_SCENARIO_INDEXES) {
      const pptxPath = path.join(tempDir, `${scenario.name}.pptx`);
      const run = spawnSync(process.execPath, [
        path.join(ROOT, "scripts", "generate_me2026_deck.cjs"),
        "--scenario", scenario.name,
        "--out", pptxPath,
      ], {
        cwd: ROOT,
        encoding: "utf8",
        timeout: 120_000,
        maxBuffer: 8 * 1024 * 1024,
        env: { ...process.env },
      });
      assert.equal(run.status, 0, `${scenario.name} generation failed: ${run.stderr || run.error || run.status}`);
      assert.ok(fs.statSync(pptxPath).size > 0, `${scenario.name} did not produce a PPTX`);
      const slideCount = spawnSync("python3", ["-c", "import sys,zipfile; print(sum(1 for name in zipfile.ZipFile(sys.argv[1]).namelist() if name.startswith('ppt/slides/slide') and name.endswith('.xml') and '/_rels/' not in name))", pptxPath], { encoding: "utf8" });
      assert.equal(slideCount.status, 0, `${scenario.name}: could not read generated page count`);
      assert.equal(Number(slideCount.stdout.trim()), scenario.count, `${scenario.name}: slide count changed`);
      inspectGeneratedIndex(pptxPath, scenario.labels, scenario.name);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function testRouterExitStatus() {
  assert.equal(exitCodeFromSpawnResult({ status: 0, signal: null }), 0);
  assert.equal(exitCodeFromSpawnResult({ status: 3, signal: null }), 3);
  assert.equal(exitCodeFromSpawnResult({ status: null, signal: "SIGTERM" }), 128 + os.constants.signals.SIGTERM);
  assert.equal(exitCodeFromSpawnResult({ status: null, signal: "SIGINT" }), 128 + os.constants.signals.SIGINT);
  assert.equal(exitCodeFromSpawnResult({ status: null, signal: "NOT_A_SIGNAL" }), 1);
  assert.equal(exitCodeFromSpawnResult({ status: null, signal: null }), 1);
  assert.equal(exitCodeFromSpawnResult({ status: 0, signal: null, error: new Error("spawn failed") }), 1);
}

testDefaultIndexContract();
testStringAndTupleRows();
testMalformedRowsFailBeforeDrawing();
testSixRowsFitAboveFooter();
testRouterExitStatus();
testRealScenarioIndexPptx();
console.log("PASS: ME2026 index row and generator exit contracts");
