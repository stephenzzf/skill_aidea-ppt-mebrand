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
    const swatchTextColor = [ME2026.secondarySky, ME2026.secondaryCyan, ME2026.tertiaryAmber].includes(color) ? C.ink : C.white;
    addText(slide, label, x + 0.12, y + 0.17, 1.15, 0.16, { size: 9, bold: true, color: swatchTextColor, margin: 0 });
    addText(slide, color, x + 1.2, y + 0.17, 1.0, 0.16, { size: 9, bold: true, color: swatchTextColor, align: "right", margin: 0 });
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
    iconTone: "blue",
    iconAppearance: "circle",
    iconScale: 0.76,
    iconStrokeWidth: 2.25,
  });
  addME2026IconTitleCard(slide, pptx, {
    icon: "diligence",
    title: "Containment",
    body: "正文不能贴近或越过父框边界；如果内容过长，应增高、拆行或拆页。",
    x: 6.95,
    y: 1.62,
    w: 5.45,
    h: 1.28,
    color: ME2026.secondaryPurple,
    iconTone: "purple",
    iconAppearance: "rounded-square",
    iconScale: 0.76,
    iconStrokeWidth: 2.25,
    fill: "F8F3FF",
  });
  addME2026StackedIconRow(slide, pptx, {
    icon: "growth",
    title: "StackedIconRow",
    body: "适合紧凑行，不要把完整卡片压缩到 1 英寸以下。",
    x: 0.9,
    y: 3.35,
    w: 11.5,
    h: 0.9,
    color: ME2026.primaryBlue,
    iconTone: "blue",
    iconAppearance: "bare",
    iconScale: 0.94,
    iconStrokeWidth: 2.25,
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
  addText(slide, "图标示例：蓝色圆形 / 紫色圆角方形 / 裸图标；表格后至少保留 0.30 英寸，再放流程卡或约束说明。", 1.12, 5.78, 10.95, 0.22, {
    size: 10,
    color: C.text,
    align: "center",
    margin: 0,
    fit: "shrink",
  });
}

function addStandardComponentsPage(slide, pptx) {
  addME2026WhiteBase(slide, pptx, "组件样例：标准 ME2026 内容模块", 5, {
    subtitle: "标题、说明、证据和流程按 ME2026 常用原生组件组合",
  });
  const cards = [
    { icon: "strategy", title: "先给结论", body: "用标题说明判断，\n再选择证据对象。", x: 0.9, y: 1.65, color: ME2026.primaryBlue, iconTone: "blue" },
    { icon: "comparison", title: "并列对照", body: "统一比较维度，\n说明差异与适用边界。", x: 6.95, y: 1.65, color: ME2026.secondaryPurple, iconTone: "purple" },
    { icon: "diligence", title: "保留证据", body: "区分数据与假设，\n结论不超出证据。", x: 0.9, y: 4.0, color: ME2026.primaryBlue, iconTone: "blue" },
    { icon: "growth", title: "说明行动", body: "明确角色和顺序，\n约定可检查的下一步。", x: 6.95, y: 4.0, color: ME2026.primaryBlue, iconTone: "blue" },
  ];
  for (const item of cards) {
    addME2026IconTitleCard(slide, pptx, {
      ...item, w: 5.45, h: 2.05, iconD: 0.64, iconAppearance: "circle", iconScale: 0.76, iconStrokeWidth: 2.25,
      headerCenterOffset: 0.53, titleH: 0.50, titleSize: 24,
      bodyY: 1.02, bodyH: 0.78, bodyBottomPad: 0.25,
      bodySize: 20, autoShrink: false,
      fill: item.color === ME2026.secondaryPurple ? "F6F0FF" : "F1F6FF",
      line: "D9E5F7", shadow: false,
    });
  }
  addNote(slide, "演讲样例：24pt 卡片标题 / 20pt 正文 / autoShrink:false。\n根据内容关系选择布局；图表、表格与流程保持原生可编辑。");
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
    "标准内容模块",
    "Contact Us 尾页",
  ]);
  addTokenPage(pptx.addSlide(), pptx);
  addCardsPage(pptx.addSlide(), pptx);
  addStandardComponentsPage(pptx.addSlide(), pptx);
  addME2026ThankYou(pptx.addSlide(), pptx, { pageNum: 6 });

  await pptx.writeFile({ fileName: out });
  console.log(out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
