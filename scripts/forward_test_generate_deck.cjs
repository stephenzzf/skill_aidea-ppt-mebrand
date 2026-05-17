#!/usr/bin/env node
const {
  C,
  createPresentation,
  assertPalette,
  addText,
  card,
  brandStripe,
  footer,
  numberedCircle,
  prepareIconCache,
  iconCircle,
  pill,
  bullet,
} = require("./brand_ppt_helpers.cjs");

function arg(name, fallback) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

function addBrandTitle(slide, pptx, main, sub, page) {
  slide.background = { color: C.white };
  brandStripe(slide, pptx);
  addText(slide, main, 0.72, 0.42, 9.8, 0.42, { size: 23, bold: true, color: C.ink });
  addText(slide, sub, 0.74, 0.94, 10.5, 0.24, { size: 12.6, bold: true, color: C.blue });
  footer(slide, page);
}

function addBusinessReviewContent(pptx, page, title, icon, points, accent = C.blue) {
  const s = pptx.addSlide();
  addBrandTitle(s, pptx, title, "用统一品牌组件表达业务进展、方法沉淀和下一步计划。", page);
  card(s, pptx, 0.62, 1.55, 12.1, 4.75, { fill: C.white, line: C.divider });
  iconCircle(s, pptx, icon, 0.98, 1.95, 0.95, accent);
  addText(s, "核心结论", 2.18, 2.02, 2.2, 0.28, { size: 17, bold: true, color: accent });
  points.forEach((p, i) => bullet(s, pptx, p, 2.2, 2.65 + i * 0.48, 8.6, accent, 12));
  pill(s, pptx, "Source Audit → Claim Spine → QA Ledger", 2.18, 5.45, 4.4, { color: accent, fill: C.blueBgSoft });
}

function addSolutionContent(pptx, page, title, icon, note, accent = C.blue) {
  const s = pptx.addSlide();
  addBrandTitle(s, pptx, title, note, page);
  const steps = ["诊断", "方案", "实施", "优化"];
  steps.forEach((step, i) => {
    const x = 0.75 + i * 3.05;
    card(s, pptx, x, 1.8, 2.45, 3.4, { fill: i % 2 ? C.blueBgSoft : C.white, line: C.divider });
    numberedCircle(s, pptx, i + 1, x + 0.28, 2.1, 0.48, accent, 15);
    iconCircle(s, pptx, icon, x + 0.86, 2.0, 0.72, accent);
    addText(s, step, x + 0.4, 3.0, 1.6, 0.24, { size: 15, bold: true, color: accent, align: "center" });
    addText(s, "围绕业务场景沉淀可复制 SOP、数据闭环与 AI 能力。", x + 0.28, 3.55, 1.85, 0.72, { size: 10.5, color: C.text });
  });
}

async function buildReview5(out) {
  const pptx = createPresentation({ title: "ME Brand Business Review Forward Test" });
  await prepareIconCache(["Sparkles", "ChartColumnIncreasing", "Users", "Workflow", "BrainCircuit"], [C.blue, C.purple, C.teal, C.orange, C.white]);
  const cover = pptx.addSlide();
  cover.background = { color: C.blue };
  addText(cover, "觅跃科技", 0.8, 1.15, 3.5, 0.45, { size: 28, bold: true, color: C.white });
  addText(cover, "5 页业务回顾前向测试", 0.8, 3.0, 6.0, 0.48, { size: 25, bold: true, color: C.white });
  footer(cover, 1, { label: "觅跃科技  |  飞书深诺", color: C.white });
  addBusinessReviewContent(pptx, 2, "当前成果：业务增长与能力沉淀", "ChartColumnIncreasing", ["完成业务定位重塑", "形成标准交付方法", "沉淀 AI 产品化机会"], C.blue);
  addBusinessReviewContent(pptx, 3, "组织升级：复合团队与协作机制", "Users", ["明确职责边界", "建立前线授权机制", "提升跨职能协同效率"], C.purple);
  addBusinessReviewContent(pptx, 4, "SOP 沉淀：从非标项目到可复制交付", "Workflow", ["标准化诊断路径", "模板化交付资产", "可复用复盘机制"], C.teal);
  addBusinessReviewContent(pptx, 5, "下一阶段：AI Agent 与产品化", "BrainCircuit", ["围绕高频场景建设 Agent", "把经验转成模块化产品", "用数据闭环优化交付"], C.orange);
  await pptx.writeFile({ fileName: out });
}

async function buildSolution8(out) {
  const pptx = createPresentation({ title: "ME Brand Solution Forward Test" });
  await prepareIconCache(["Ship", "Target", "Workflow", "BrainCircuit"], [C.blue, C.purple, C.teal, C.orange, C.white]);
  const cover = pptx.addSlide();
  cover.background = { color: C.blue };
  addText(cover, "出海营销数字技术服务", 0.78, 2.15, 6.5, 0.55, { size: 28, bold: true, color: C.white });
  addText(cover, "Meet Experience Tech Consulting Service", 0.82, 2.85, 6.2, 0.28, { size: 14, bold: true, color: C.white });
  footer(cover, 1, { label: "觅跃科技  |  飞书深诺", color: C.white });
  const slides = [
    ["执行摘要：为什么现在需要技术服务", "Target", "用业务问题牵引技术、数据和 AI 能力组合。"],
    ["业务痛点：增长进入复杂运营阶段", "Target", "从单点投放走向跨渠道、跨系统、跨团队协同。"],
    ["ME 能力：咨询、交付、数据与 AI", "Workflow", "用可复用 SOP 管理从诊断到优化的全过程。"],
    ["方案架构：数据流与 Agent 能力闭环", "BrainCircuit", "用数据和自动化把经验沉淀为可复制能力。"],
    ["行业场景：跨境电商增长运营", "Ship", "围绕人群、内容、触达、转化和复购建立闭环。"],
    ["交付路径：从评估到产品化", "Workflow", "阶段化交付，降低非标服务的不确定性。"],
    ["预期成果：效率、质量和规模化", "BrainCircuit", "用指标体系验证业务价值和可持续增长。"],
  ];
  slides.forEach(([title, icon, note], i) => addSolutionContent(pptx, i + 2, title, icon, note, [C.blue, C.purple, C.teal, C.orange][i % 4]));
  await pptx.writeFile({ fileName: out });
}

async function main() {
  assertPalette();
  const scenario = arg("--scenario", "review5");
  const out = arg("--out", `/tmp/aidea-sop-ppt-mebrand-${scenario}.pptx`);
  if (scenario === "review5") await buildReview5(out);
  else if (scenario === "solution8") await buildSolution8(out);
  else throw new Error(`Unknown scenario: ${scenario}`);
  console.log(out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
