const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const JSZip = require('jszip');
const { generate } = require('./dark_report.cjs');
const { quadrant, registerPages } = require('./dark_report_analytical.cjs');

const header = { kicker: '服务运营', section: '运营', title: '维修网络覆盖复盘' };
const issueRows = Array.from({ length: 24 }, (_, i) => [
  'R' + String(i + 1).padStart(2, '0'),
  '网点排班',
  '现场巡检记录已逐班核对。',
  '内部抽样',
]);
const register = {
  ...header,
  role: 'source-register',
  mode: 'paginate',
  headers: ['记录', '主题', '证据', '边界'],
  rows: issueRows,
  columnWidths: [1, 2, 4, 2],
  lead: '根据订单记录核对服务范围。',
  note: '巡检样本只覆盖登记网点。',
};

test('register pagination keeps full rows in order and repeats the table header', () => {
  const pages = registerPages(register, 1.55);
  assert.ok(pages.length > 1);
  assert.deepEqual(
    pages.flatMap((p) => p.table.slice(1)),
    issueRows,
  );
  pages.forEach((p, i) => {
    assert.deepEqual(p.table[0], register.headers);
    assert.ok(p.kicker.endsWith(`${i + 1}/${pages.length}`));
  });
  assert.throws(
    () => registerPages({ ...register, rows: [['R99', '质量', '遍'.repeat(6000), '现场']] }, 1.55),
    /row exceeds/,
  );
});

test('normal PPTX entry writes matrix, staircase, scoped numeric chart and complete locked register', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'me-analytical-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const roles = [
    {
      ...header,
      role: 'quadrant',
      xAxis: '到达难度',
      highlight: { x: 'low', y: 'high' },
      yAxis: '订单量',
      cells: [
        { x: 'high', y: 'low', title: '暂缓', detail: '先观察新订单' },
        { x: 'low', y: 'high', title: '增配', detail: '加密巡检班次' },
        { x: 'low', y: 'low', title: '保留', detail: '维持日常覆盖' },
        { x: 'high', y: 'high', title: '设站', detail: '评估服务半径' },
      ],
    },
    {
      ...header,
      role: 'maturity',
      levels: [
        { level: '一', title: '登记', detail: '手工登记工单' },
        { level: '二', title: '分派', detail: '按地址分派' },
        { level: '三', title: '回访', detail: '闭环记录' },
      ],
    },
    {
      ...header,
      role: 'evidence-chart',
      chartTitle: '准时率',
      labels: ['南区', '北区'],
      values: [0.71, 0.82],
      numberFormat: '0%',
      approximation: '口头访谈称近七成。',
      chartSource: '来源：两区派工记录。',
      comparisonTitle: '另一次满意度抽访',
      comparison: [{ value: '九成左右', label: '总体评价满意' }],
      comparisonSource: '来源：独立匿名抽访。',
    },
    {
      ...register,
      mode: 'locked',
      indexHeaders: ['查阅范围', '核验状态'],
      indexRows: [['R01–R24', '抽样完成']],
      indexColumnWidths: [1, 2],
    },
  ];
  const file = path.join(dir, 'operations.pptx');
  await generate({ title: '服务运营', navigation: ['运营'], slides: roles }, file);
  const zip = await JSZip.loadAsync(await fs.readFile(file));
  const get = (name) => zip.file(name).async('string');
  const slideXml = await Promise.all(roles.map((_, i) => get(`ppt/slides/slide${i + 1}.xml`)));
  slideXml.forEach((xml) => assert.match(xml, /ME_REPORT_TITLE/));
  assert.match(slideXml[0], /到达难度/);
  assert.match(slideXml[1], /闭环记录/);
  assert.match(slideXml[2], /近七成/);
  const chart = await get('ppt/charts/chart1.xml');
  const cache = chart.match(/<c:numCache>[\s\S]*?<\/c:numCache>/)[0];
  assert.deepEqual(
    [...cache.matchAll(/<c:v>(.*?)<\/c:v>/g)].map((m) => Number(m[1])),
    [0.71, 0.82],
  );
  assert.equal(zip.file(/ppt\/embeddings\/.*\.xlsx$/).length, 1);
  assert.match(slideXml[3], /<a:tbl>/);
  const notes = await get('ppt/notesSlides/notesSlide4.xml');
  for (const [id] of issueRows) assert.ok(notes.includes(id), id);
  assert.ok(!slideXml[3].includes('R18'));
});

test('public CLI resolves code-diagram media beside the brief from another working directory', async (t) => {
  const { execFileSync } = require('node:child_process');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'me-diagram-brief-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const assetDir = path.join(dir, 'media');
  await fs.mkdir(assetDir);
  // An actual PNG and source file; layout labels remain separate from this image.
  await fs.writeFile(
    path.join(assetDir, 'geometry.png'),
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAIMO0Bp4LHjQAAAABJRU5ErkJggg==',
      'base64',
    ),
  );
  await fs.writeFile(
    path.join(assetDir, 'source.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1"/></svg>',
  );
  const brief = {
    title: '工单判定',
    slides: [
      {
        ...header,
        role: 'coded-diagram',
        visual: { file: 'media/geometry.png', source: 'media/source.svg', alt: '服务区域', x: 1, y: 2, w: 1, h: 1 },
        labels: [{ text: '巡检', x: 1.03, y: 2.03, w: 0.91, h: 0.4 }],
      },
    ],
  };
  const file = path.join(dir, 'deck.pptx');
  await fs.writeFile(path.join(dir, 'brief.json'), JSON.stringify(brief));
  execFileSync(
    process.execPath,
    [
      path.join(__dirname, 'generate_me2026_deck.cjs'),
      '--style',
      'dark-report',
      '--input',
      path.join(dir, 'brief.json'),
      '--out',
      file,
    ],
    { cwd: os.tmpdir() },
  );
  const zip = await JSZip.loadAsync(await fs.readFile(file));
  assert.match(await zip.file('ppt/slides/slide1.xml').async('string'), /巡检/);
});

test('matrix emphasis can move to a lower-risk option or be turned off', () => {
  const page = {
    xAxis: '成本',
    yAxis: '风险',
    cells: ['low', 'high'].flatMap((y) =>
      ['low', 'high'].map((x) => ({ x, y, title: x + '/' + y, detail: '检查条件' })),
    ),
  };
  function emphasis(highlight) {
    const titles = [];
    const slide = {
      addShape() {},
      addText(runs, opts) {
        if (opts.color === 'FFFFFF' && opts.bold) titles.push(runs.map((run) => run.text).join(''));
      },
    };
    quadrant(slide, { ...page, highlight }, { cjk: '等线', latin: 'Poppins', body: '202020', rule: 'EEEEEE' }, 1.55);
    return titles;
  }
  assert.deepEqual(emphasis(undefined), ['high/high']);
  assert.deepEqual(emphasis({ x: 'low', y: 'low' }), ['low/low']);
  assert.deepEqual(emphasis(null), []);
  assert.throws(() => emphasis({ x: 'medium', y: 'low' }), /highlight/);
});
