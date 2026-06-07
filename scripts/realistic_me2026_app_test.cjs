#!/usr/bin/env node
const {
  C,
  ME2026,
  createPresentation,
  assertPalette,
  addText,
  card,
  numberedCircle,
  prepareIconCache,
  iconCircle,
  bullet,
  addME2026Cover,
  addME2026Index,
  addME2026WhiteBase,
  addME2026ThankYou,
  addJourneySolutionMatrix,
  addApiCapabilityFlow,
} = require("./brand_ppt_helpers.cjs");

function arg(name, fallback) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

function addOverview(slide, pptx) {
  const items = [
    ["MessageCircle", "规模化触达新用户", "CTWA 广告、落地页点击即聊、APP 跳转 WhatsApp，沉淀可复访用户池。"],
    ["Bot", "从兴趣到互动留存", "欢迎语、福利钩子、自动化消息与标签人群，承接广告后的高意向用户。"],
    ["ChartColumnIncreasing", "推动转化与 LTV", "模板消息、群发任务、用户行为触发与精细化报告，形成增长闭环。"],
  ];
  items.forEach(([icon, title, body], i) => {
    const x = 0.78 + i * 4.12;
    card(slide, pptx, x, 1.55, 3.55, 2.42, { fill: i === 1 ? "F6FBFF" : C.white, line: ME2026.secondarySky, shadowOpacity: 0.05 });
    iconCircle(slide, pptx, icon, x + 0.28, 1.85, 0.72, ME2026.primaryBlue, "EAF4FF");
    addText(slide, title, x + 1.1, 2.0, 2.05, 0.3, { size: 16, bold: true, color: ME2026.primaryBlue, margin: 0 });
    addText(slide, body, x + 0.32, 2.72, 2.9, 0.78, { size: 12, color: C.text, margin: 0, fit: "shrink" });
  });
  card(slide, pptx, 0.95, 4.72, 11.25, 0.96, { fill: ME2026.primaryBlue, line: ME2026.primaryBlue, shadow: false, radius: 0.08 });
  addText(slide, "唤起 -> 承接 -> 自动化消息 -> 标签分层 -> 再营销 -> 数据反哺广告优化", 1.2, 5.06, 10.7, 0.22, {
    size: 18,
    bold: true,
    color: C.white,
    align: "center",
    margin: 0,
    fit: "shrink",
  });
}

function addCaseSlide(slide, pptx) {
  const cols = [
    ["客户背景", ["APP 面向海外多区域增长", "广告触点多但用户留资分散", "需要可运营、可召回的私域池"]],
    ["核心痛点", ["注册后流失难追踪", "人工客服承接成本高", "复购和长期留存缺少触发机制"]],
    ["解决方案", ["CTWA 广告承接", "Meetbot 自动化首轮接待", "标签分层与行为触发模板"]],
    ["服务效果", ["缩短高意向用户响应时间", "提升触达稳定性", "沉淀可持续复访用户资产"]],
  ];
  cols.forEach(([title, bullets], i) => {
    const x = 0.72 + i * 3.08;
    card(slide, pptx, x, 1.6, 2.58, 4.6, { fill: i % 2 ? "F6FBFF" : C.white, line: "D5D8F5", shadowOpacity: 0.04 });
    numberedCircle(slide, pptx, i + 1, x + 0.18, 1.83, 0.38, i < 2 ? ME2026.primaryBlue : ME2026.secondaryPurple, 12);
    addText(slide, title, x + 0.68, 1.91, 1.55, 0.2, { size: 14, bold: true, color: C.ink, margin: 0 });
    bullets.forEach((b, j) => bullet(slide, pptx, b, x + 0.32, 2.55 + j * 0.48, 2.08, i < 2 ? ME2026.primaryBlue : ME2026.secondaryPurple, 10));
  });
  card(slide, pptx, 0.92, 6.45, 11.45, 0.38, { fill: ME2026.secondarySky, line: ME2026.secondarySky, shadow: false, radius: 0.04 });
  addText(slide, "模拟案例用于验证模板可编辑性和高密度业务页排版，不代表真实客户指标。", 1.1, 6.55, 11.0, 0.14, { size: 10, bold: true, color: C.white, align: "center", margin: 0 });
}

function addPricingSlide(slide, pptx) {
  const plans = [
    ["轻量启动", "适合快速验证", ["2 个客服账号", "基础模板自动化", "入门运营指导"], ME2026.secondarySky],
    ["专业增长", "适合多场景运营", ["多账号管理", "联系人分层", "数据分析报告"], ME2026.primaryBlue],
    ["定制方案", "适合系统集成", ["API 和 Webhooks", "CRM 数据互通", "客户经理支持"], ME2026.secondaryPurple],
  ];
  plans.forEach(([name, desc, features, color], i) => {
    const x = 1.0 + i * 4.05;
    card(slide, pptx, x, 1.55, 3.25, 4.65, { fill: C.white, line: color, shadowOpacity: 0.05 });
    slide.addShape(pptx.ShapeType.rect, { x, y: 1.55, w: 3.25, h: 0.74, fill: { color }, line: { color } });
    addText(slide, name, x + 0.22, 1.78, 2.8, 0.2, { size: 18, bold: true, color: C.white, align: "center", margin: 0 });
    addText(slide, desc, x + 0.32, 2.55, 2.6, 0.24, { size: 13, bold: true, color, align: "center", margin: 0 });
    features.forEach((f, j) => bullet(slide, pptx, f, x + 0.42, 3.18 + j * 0.48, 2.35, color, 11));
    card(slide, pptx, x + 0.42, 5.38, 2.4, 0.42, { fill: color, line: color, shadow: false, radius: 0.06 });
    addText(slide, "按业务需求报价", x + 0.55, 5.53, 2.15, 0.12, { size: 11, bold: true, color: C.white, align: "center", margin: 0 });
  });
}

function addThankYou(slide, pptx) {
  addME2026ThankYou(slide, pptx, { pageNum: 8 });
}

async function main() {
  assertPalette();
  const out = arg("--out", "/tmp/aidea-sop-ppt-mebrand-realistic-me2026-app.pptx");
  const pptx = createPresentation({ title: "ME 2026 APP Realistic Simulation" });
  await prepareIconCache(
    ["Brain", "Search", "Handshake", "BadgeDollarSign", "MessageCircle", "Bot", "ChartColumnIncreasing"],
    [ME2026.primaryBlue, ME2026.secondaryPurple, ME2026.tertiaryLavender, C.white]
  );

  addME2026Cover(pptx.addSlide(), pptx, {
    title: "WhatsApp驱动\n出海APP用户私域增长",
    subtitle: "真实模拟测试：模板资产、色系、正文组件和页脚回归",
  });
  addME2026Index(pptx.addSlide(), pptx, [
    ["01", "方案概览"],
    ["02", "用户旅程与核心解决方案"],
    ["03", "WhatsApp API 能力流程"],
    ["04", "服务案例与价格"],
  ], { pageNum: 2 });
  {
    const s = pptx.addSlide();
    addME2026WhiteBase(s, pptx, "泛APP行业WhatsApp解决方案概览", 3);
    addOverview(s, pptx);
  }
  {
    const s = pptx.addSlide();
    addME2026WhiteBase(s, pptx, "基于WhatsApp的私域增长方案", 4);
    addJourneySolutionMatrix(s, pptx);
  }
  {
    const s = pptx.addSlide();
    addME2026WhiteBase(s, pptx, "WhatsApp API：灵活定制企业场景", 5);
    addApiCapabilityFlow(s, pptx);
  }
  {
    const s = pptx.addSlide();
    addME2026WhiteBase(s, pptx, "服务案例：出海APP私域增长模拟案例", 6);
    addCaseSlide(s, pptx);
  }
  {
    const s = pptx.addSlide();
    addME2026WhiteBase(s, pptx, "服务价格：从轻量启动到定制集成", 7);
    addPricingSlide(s, pptx);
  }
  addThankYou(pptx.addSlide(), pptx);

  await pptx.writeFile({ fileName: out });
  console.log(out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
