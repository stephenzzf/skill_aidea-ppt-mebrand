const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { promisify } = require('node:util');
const JSZip = require('jszip');
const { generate } = require('./dark_report.cjs');

const header = { kicker: '运营复盘', section: '运营', title: '维修网络试点' };
const stages = {
  ...header, role: 'stage-responsibilities', stageHeading: '处理顺序',
  stages: [
    { number: '甲', title: '登记', detail: '记录时间与区域。' },
    { number: '乙', title: '处置', detail: '派出值班维修员。' },
    { number: '丙', title: '验收', detail: '核对签收结果。' },
  ],
  responsibilityHeading: '值班分工', headers: ['角色', '职责'],
  responsibilities: [{ role: '站长', duty: '审核工单。' }, { role: '记录员', duty: '复核时间。' }],
  note: '按当班名册核实。', notes: '使用工单抽查。',
};
const index = {
  ...header, role: 'case-index', lead: '按门店查阅试点记录。', headers: ['站点', '任务', '适用边界', '档案号'],
  cases: [
    { subject: '南站', task: '巡检', evidence: '仅有两周记录。', locator: '卷二' },
    { subject: '北站', task: '检修', evidence: '一项仍待复核。', locator: '卷二' },
  ],
  note: '同卷各站单列。', notes: '打开原始排班记录。',
};
const selection = {
  ...header, role: 'candidate-selection', lead: '核对候选与优先试点。',
  pool: { count: 6, label: '个候选站', exampleHeading: '已知站名', examples: ['东站', '南站'], disclosure: '其余站名未披露。' },
  shortlist: { count: 1, label: '个优先站', items: [{ title: '南站', reason: '轮班记录完整。' }] },
  evidence: '仅完成初筛。', note: '来源为当班记录。', notes: '尚待审批。',
};
const deck = { title: '维修试点', navigation: ['运营'], slides: [stages, index, selection] };

async function tempDir(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'me-decision-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}

function textRuns(xml) {
  return Array.from(xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g), match => match[1]).join('');
}

function nativeTable(xml) {
  const tables = [...xml.matchAll(/<a:tbl>([\s\S]*?)<\/a:tbl>/g)];
  assert.equal(tables.length, 1);
  return Array.from(tables[0][1].matchAll(/<a:tr\b[^>]*>([\s\S]*?)<\/a:tr>/g), row =>
    Array.from(row[1].matchAll(/<a:tc\b[^>]*>([\s\S]*?)<\/a:tc>/g), cell => textRuns(cell[1])));
}

test('a standalone brief through the public CLI creates native stages, case rows and candidate labels', async t => {
  const dir = await tempDir(t);
  const file = path.join(dir, 'operations.pptx');
  await fs.writeFile(path.join(dir, 'brief.json'), JSON.stringify(deck));
  await promisify(execFile)(process.execPath, [
    path.join(__dirname, 'generate_me2026_deck.cjs'), '--style', 'dark-report',
    '--use', 'report', '--input', 'brief.json', '--out', file,
  ], { cwd: dir });
  const zip = await JSZip.loadAsync(await fs.readFile(file));
  assert.equal(zip.file(/^ppt\/slides\/slide\d+\.xml$/).length, 3);
  const pages = await Promise.all([1, 2, 3].map(n => zip.file('ppt/slides/slide' + n + '.xml').async('string')));
  assert.deepEqual(nativeTable(pages[0]), [['角色', '职责'], ['站长', '审核工单。'], ['记录员', '复核时间。']]);
  assert.deepEqual(nativeTable(pages[1]), [['站点', '任务', '适用边界', '档案号'],
    ['南站', '巡检', '仅有两周记录。', '卷二'], ['北站', '检修', '一项仍待复核。', '卷二']]);
  for (const [i, page] of deck.slides.entries()) {
    assert.ok(textRuns(pages[i]).includes(page.note));
    const notes = await zip.file('ppt/notesSlides/notesSlide' + (i + 1) + '.xml').async('string');
    assert.ok(textRuns(notes).includes(page.notes));
  }
  const stageText = textRuns(pages[0]);
  assert.match(stageText, /甲\s*登记.*记录时间与区域。.*乙\s*处置.*派出值班维修员。.*丙\s*验收.*核对签收结果。/);
  const candidateText = textRuns(pages[2]);
  for (const label of ['6 个候选站', '东站、南站', '其余站名未披露。', '1 个优先站', '轮班记录完整。', '仅完成初筛。']) {
    assert.ok(candidateText.includes(label), label);
  }
});

test('incomplete responsibilities, case evidence and contradictory or undisclosed candidate counts fail before export', async t => {
  const file = path.join(await tempDir(t), 'invalid.pptx');
  const invalid = [
    { ...stages, responsibilities: [{ role: '站长' }] },
    { ...index, cases: [{ ...index.cases[0], evidence: '' }] },
    { ...selection, shortlist: { ...selection.shortlist, count: 2 } },
    { ...selection, pool: { ...selection.pool, count: 1 } },
    { ...selection, pool: { ...selection.pool, disclosure: '' } },
  ];
  for (const page of invalid) {
    await assert.rejects(generate({ ...deck, slides: [page] }, file), error => {
      assert.doesNotMatch(error.message, /Unknown dark-report layout/);
      return true;
    });
    await assert.rejects(fs.stat(file), { code: 'ENOENT' });
  }
});
