#!/usr/bin/env node
const {
  C,
  ME2026,
  createPresentation,
  assertPalette,
  addText,
  card,
  prepareME2026IconCache,
  addME2026Cover,
  addME2026Index,
  addME2026WhiteBase,
  addME2026ThankYou,
  addME2026ConsultingTimeline,
  addME2026ConsultingIconGrid,
  addME2026ConsultingProcessRows,
} = require("./brand_ppt_helpers.cjs");

function arg(name, fallback) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

function addSourceBoundary(slide, text) {
  addText(slide, text, 0.9, 6.58, 11.2, 0.18, {
    size: 8,
    color: C.textMuted,
    margin: 0,
    align: "center",
    fit: "shrink",
  });
}

function addIconGridPage(slide, pptx) {
  addText(slide, "稀疏图标矩阵：先判断，再展开", 0.9, 1.08, 5.8, 0.28, {
    size: 15,
    bold: true,
    color: ME2026.primaryBlue,
    margin: 0,
  });
  addME2026ConsultingIconGrid(slide, pptx, {
    y: 1.55,
    items: [
      { icon: "consult-target", title: "目标定义", body: "明确业务目标、成功指标和约束边界。", color: ME2026.primaryBlue },
      { icon: "consult-search", title: "问题诊断", body: "用可验证证据定位链路断点。", color: ME2026.tertiaryDeepTeal },
      { icon: "consult-grid", title: "结构拆解", body: "建立市场、渠道、旅程和组织视角。", color: ME2026.primarySteel },
      { icon: "consult-dashboard", title: "数据看板", body: "把过程、结果和异常信号放在同一观察面。", color: ME2026.primaryBlue },
      { icon: "consult-gear", title: "机制设计", body: "沉淀节奏、规则、角色和复盘动作。", color: ME2026.secondaryPurple },
      { icon: "consult-verified", title: "落地核验", body: "通过样本、日志、SLA 和材料闭环确认结果。", color: ME2026.tertiaryDeepTeal },
    ],
  });
  card(slide, pptx, 1.05, 5.58, 11.1, 0.62, {
    fill: "F7FAFF",
    line: "DCE5F4",
    shadow: false,
    radius: 0.04,
  });
  addText(slide, "设计规则：图标使用提取资产，标题和说明保持可编辑；所有颜色映射到 ME2026 蓝 / 紫 / 青色系。", 1.28, 5.78, 10.65, 0.22, {
    size: 11,
    bold: true,
    color: C.text,
    margin: 0,
    fit: "shrink",
  });
}

function addProcessPage(slide, pptx) {
  addText(slide, "流程页：咨询节奏 + 交付检查点", 0.9, 1.08, 5.8, 0.28, {
    size: 15,
    bold: true,
    color: ME2026.primaryBlue,
    margin: 0,
  });
  addME2026ConsultingProcessRows(slide, pptx, {
    y: 1.56,
    rows: [
      { icon: "consult-calendar", title: "阶段排期", body: "把调研、方案、验证和复盘切成明确窗口，减少跨团队等待。", color: ME2026.tertiaryLavender },
      { icon: "consult-org", title: "角色协同", body: "明确业务、产品、投放、数据和客服的责任边界与交付物。", color: ME2026.primarySteel },
      { icon: "consult-line-chart", title: "指标牵引", body: "围绕触达、互动、转化、留存四类指标建立统一复盘语言。", color: ME2026.primaryBlue },
      { icon: "consult-shield", title: "风险控制", body: "把合规、授权、数据安全和素材版权前置到方案设计阶段。", color: ME2026.tertiaryDeepTeal },
    ],
  });
  card(slide, pptx, 1.0, 6.08, 11.35, 0.42, {
    fill: ME2026.primaryBlue,
    line: ME2026.primaryBlue,
    shadow: false,
    radius: 0.04,
  });
  addText(slide, "输出形态：排期表、责任矩阵、指标口径、风险清单和复盘材料均作为可编辑对象沉淀。", 1.2, 6.2, 10.95, 0.18, {
    size: 10,
    bold: true,
    color: C.white,
    align: "center",
    margin: 0,
    fit: "shrink",
  });
}

async function main() {
  assertPalette();
  const out = arg("--out", "/tmp/me2026-deloitte-white-style-test.pptx");
  const pptx = createPresentation({ title: "ME2026 White Consulting Style Test" });
  await prepareME2026IconCache([
    "consult-target",
    "consult-search",
    "consult-grid",
    "consult-dashboard",
    "consult-gear",
    "consult-verified",
    "consult-calendar",
    "consult-org",
    "consult-line-chart",
    "consult-shield",
  ]);

  addME2026Cover(pptx.addSlide(), pptx, {
    title: "ME2026 白底咨询\n布局组件测试",
    subtitle: "白底时间轴、图标矩阵、流程行与统一色系回归",
  });
  addME2026Index(pptx.addSlide(), pptx, [
    ["01", "白底咨询时间轴"],
    ["02", "稀疏图标矩阵"],
    ["03", "流程与结构页"],
    ["04", "模板资产与尾页"],
  ], { pageNum: 2 });
  addME2026ConsultingTimeline(pptx.addSlide(), pptx, {
    pageNum: 3,
    titleLines: ["时间轴", "标注日期"],
    events: [
      { x: 1.38, day: "26", text: "问题定义，确认目标\n拆解核心假设", above: true, color: ME2026.tertiaryDeepTeal, lineH: 1.62 },
      { x: 3.82, day: "04", text: "完成资料盘点\n识别关键缺口", above: true, color: ME2026.tertiaryDeepTeal, lineH: 2.18 },
      { x: 4.48, day: "15", text: "输出初版诊断\n形成共识材料", above: false, color: ME2026.tertiaryDeepTeal, lineH: 2.18 },
      { x: 5.05, day: "22", text: "验证重点场景\n沉淀测试记录", above: true, color: ME2026.tertiaryDeepTeal, lineH: 1.62 },
      { x: 7.72, day: "16", text: "方案结构定稿\n明确交付边界", above: true, color: ME2026.primaryBlue, lineH: 1.62 },
      { x: 8.22, day: "13", text: "补充风险清单\n完成复核动作", above: false, color: ME2026.primaryBlue, lineH: 2.18 },
      { x: 9.08, day: "23", text: "形成管理摘要\n准备评审材料", above: true, color: ME2026.primaryBlue, lineH: 2.18 },
      { x: 11.0, day: "5", text: "完成复盘归档\n进入执行阶段", above: true, color: ME2026.tertiaryDeepTeal, lineH: 1.62 },
    ],
  });
  {
    const s = pptx.addSlide();
    addME2026WhiteBase(s, pptx, "白底图标矩阵：用稀疏排版组织复杂判断", 4);
    addIconGridPage(s, pptx);
  }
  {
    const s = pptx.addSlide();
    addME2026WhiteBase(s, pptx, "流程与结构页：统一行中心线和交付检查点", 5);
    addProcessPage(s, pptx);
    addSourceBoundary(s, "公开安全测试页：未使用第三方 Logo、官网截图或黑底样式；正文和标签均保持可编辑。");
  }
  addME2026ThankYou(pptx.addSlide(), pptx, { pageNum: 6 });

  await pptx.writeFile({ fileName: out });
  console.log(out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
