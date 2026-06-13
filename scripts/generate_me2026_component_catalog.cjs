#!/usr/bin/env node
const {
  C,
  ME2026,
  ME2026_TOKENS,
  createPresentation,
  addText,
  card,
  prepareME2026IconCache,
  addME2026Cover,
  addME2026Index,
  addME2026WhiteBase,
  addME2026ThankYou,
  addME2026IconTitleCard,
  addME2026StackedIconRow,
  addME2026LabelTextRow,
  addME2026ConsultingTimeline,
  addME2026ConsultingIconGrid,
  addME2026ConsultingProcessRows,
} = require("./brand_ppt_helpers.cjs");

function arg(name, fallback) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

function addNote(slide, text) {
  addText(slide, text, 0.86, 6.55, 11.2, 0.24, {
    size: 8,
    color: C.textMuted,
    margin: 0,
    fit: "shrink",
  });
}

function addTokenPage(slide, pptx) {
  addME2026WhiteBase(slide, pptx, "ME2026 Tokens：颜色、字号、间距和组件边界", 3, {
    subtitle: "用于减少脚本 magic numbers，并统一生成与 QA 标准",
  });
  const swatches = [
    ["Primary", ME2026.primaryBlue],
    ["Dark Blue", ME2026.primaryDarkBlue],
    ["Purple", ME2026.secondaryPurple],
    ["Sky", ME2026.secondarySky],
    ["Cyan", ME2026.secondaryCyan],
    ["Teal", ME2026.tertiaryDeepTeal],
    ["Amber", ME2026.tertiaryAmber],
    ["Warm Gray", ME2026.tertiaryWarmGray],
  ];
  swatches.forEach(([label, color], idx) => {
    const x = 0.86 + (idx % 4) * 3.05;
    const y = 1.72 + Math.floor(idx / 4) * 1.05;
    slide.addShape(pptx.ShapeType.roundRect, {
      x,
      y,
      w: 2.45,
      h: 0.64,
      rectRadius: 0.08,
      fill: { color },
      line: { color },
    });
    addText(slide, label, x + 0.12, y + 0.17, 1.15, 0.16, { size: 9, bold: true, color: C.white, margin: 0 });
    addText(slide, color, x + 1.2, y + 0.17, 1.0, 0.16, { size: 9, bold: true, color: C.white, align: "right", margin: 0 });
  });
  const rows = [
    ["Header safe zone", `${ME2026_TOKENS.layout.contentTopY}"`],
    ["Table follow-up gap", `${ME2026_TOKENS.layout.tableAfterGap}"`],
    ["Card padding", `${ME2026_TOKENS.layout.cardPad}"`],
    ["Minimum body box", `${ME2026_TOKENS.layout.minTextBoxH}"`],
  ];
  rows.forEach(([label, value], idx) => {
    addME2026LabelTextRow(slide, pptx, {
      label,
      body: value,
      x: 1.0,
      y: 4.0 + idx * 0.48,
      labelW: 3.0,
      bodyW: 2.4,
      color: idx % 2 ? ME2026.secondaryPurple : ME2026.primaryBlue,
    });
  });
  addNote(slide, "组件脚本应优先读取 ME2026_TOKENS / ME2026_LAYOUT；新增魔法坐标需要有明确理由。");
}

function addCardsPage(slide, pptx) {
  addME2026WhiteBase(slide, pptx, "组件样例：卡片、行组件和标签说明", 4, {
    subtitle: "用于正式 PPT、长 PRD、竞品分析和红框修复后的复用",
  });
  addME2026IconTitleCard(slide, pptx, {
    icon: "strategy",
    title: "IconTitleCard",
    body: "适合 1.0 英寸以上的横向卡片；图标和标题共享中心线，正文使用独立安全区。",
    x: 0.9,
    y: 1.62,
    w: 5.45,
    h: 1.28,
    color: ME2026.primaryBlue,
  });
  addME2026IconTitleCard(slide, pptx, {
    icon: "diligence",
    title: "Containment",
    body: "正文不能贴近或越过父框边界；如果内容过长，应增高、拆行或拆页。",
    x: 6.95,
    y: 1.62,
    w: 5.45,
    h: 1.28,
    color: ME2026.tertiaryDeepTeal,
    fill: "EEF9FB",
  });
  addME2026StackedIconRow(slide, pptx, {
    icon: "growth",
    title: "StackedIconRow",
    body: "适合紧凑行，不要把完整卡片压缩到 1 英寸以下。",
    x: 0.9,
    y: 3.35,
    w: 11.5,
    h: 0.9,
    color: ME2026.secondaryPurple,
  });
  addME2026LabelTextRow(slide, pptx, {
    label: "LabelTextRow",
    body: "适合“建议补充材料 / 约束条件 / 结论”等短标签 + 长说明，标签和正文必须共享中心线。",
    x: 0.9,
    y: 4.7,
    labelW: 2.3,
    bodyW: 8.9,
    color: ME2026.primaryBlue,
  });
  card(slide, pptx, 0.9, 5.68, 11.5, 0.46, { fill: "F6FBFF", line: "D5D8F5", shadow: false, radius: 0.08 });
  addText(slide, "Table + follow-up modules: table bottom 后至少保留 0.30 英寸间距，再放流程卡、结论条或约束说明。", 1.12, 5.78, 10.95, 0.22, {
    size: 10,
    color: C.text,
    align: "center",
    margin: 0,
    fit: "shrink",
  });
}

function addConsultingPage(slide, pptx) {
  addME2026WhiteBase(slide, pptx, "组件样例：白底咨询布局", 5, {
    subtitle: "只吸收白底布局语法与图标几何，颜色仍归一到 ME2026",
  });
  addME2026ConsultingIconGrid(slide, pptx, {
    x: 0.8,
    y: 1.55,
    cols: 4,
    colW: 2.55,
    rowH: 1.35,
    gapX: 0.28,
    titleSize: 12,
    bodySize: 9,
    items: [
      { icon: "consult-target", title: "目标定义", body: "明确业务目标、受众和成功标准。" },
      { icon: "consult-search", title: "证据核验", body: "公开资料、用户材料和假设边界分开。" },
      { icon: "consult-dashboard", title: "结构呈现", body: "用少量模块承载判断，不堆砌卡片。" },
      { icon: "consult-shield", title: "风险检查", body: "交付前跑结构、布局和视觉 QA。" },
    ],
  });
  addME2026ConsultingProcessRows(slide, pptx, {
    x: 0.86,
    y: 3.9,
    w: 11.25,
    rowH: 0.7,
    gap: 0.14,
    titleSize: 12,
    bodySize: 9,
    rows: [
      { icon: "strategy", title: "Intake", body: "确认目的、受众、来源和限制。" },
      { icon: "comparison", title: "Content Gate", body: "确认页数、claim 和 proof object。" },
      { icon: "diligence", title: "QA", body: "结构检查、风险扫描和预览复核。" },
    ],
  });
}

async function main() {
  const out = arg("--out", "/tmp/me2026-component-catalog.pptx");
  const pptx = createPresentation({ title: "ME2026 Component Catalog" });
  await prepareME2026IconCache();

  addME2026Cover(pptx.addSlide(), pptx, {
    title: "ME2026 Component Catalog",
    subtitle: "组件目录与设计 Token 样例",
  });
  addME2026Index(pptx.addSlide(), pptx, [
    "设计 Tokens",
    "卡片与行组件",
    "白底咨询组件",
    "Contact Us 尾页",
  ]);
  addTokenPage(pptx.addSlide(), pptx);
  addCardsPage(pptx.addSlide(), pptx);
  addConsultingPage(pptx.addSlide(), pptx);
  addME2026ThankYou(pptx.addSlide(), pptx, { pageNum: 6 });

  await pptx.writeFile({ fileName: out });
  console.log(out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
