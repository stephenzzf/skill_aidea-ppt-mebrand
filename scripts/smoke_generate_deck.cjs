#!/usr/bin/env node
const path = require("path");
const {
  C,
  ME2026,
  createPresentation,
  assertPalette,
  addText,
  card,
  brandStripe,
  topTitleCompact,
  footer,
  numberedCircle,
  prepareIconCache,
  iconCircle,
  iconTextRow,
  pill,
  bullet,
  addME2026Cover,
  addME2026Index,
  addME2026WhiteBase,
  addJourneySolutionMatrix,
  addApiCapabilityFlow,
} = require("./brand_ppt_helpers.cjs");

function arg(name, fallback) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

async function buildMe2026AppSmoke(out) {
  const pptx = createPresentation({ title: "ME 2026 APP Template Smoke" });
  await prepareIconCache(["Brain", "Search", "Handshake", "BadgeDollarSign"], [ME2026.primaryBlue, ME2026.tertiaryLavender, C.white]);

  {
    const s = pptx.addSlide();
    addME2026Cover(s, pptx, {
      title: "WhatsApp驱动\n出海APP用户私域增长",
      titleSize: 48,
    });
  }

  {
    const s = pptx.addSlide();
    addME2026Index(s, pptx, [
      ["01", "MeetSocial介绍"],
      ["02", "泛APP行业WhatsApp解决方案"],
      ["03", "服务案例"],
      ["04", "服务价格"],
    ], { pageNum: 2 });
  }

  {
    const s = pptx.addSlide();
    addME2026WhiteBase(s, pptx, "基于WhatsApp的私域增长方案", 3);
    addJourneySolutionMatrix(s, pptx);
  }

  {
    const s = pptx.addSlide();
    addME2026WhiteBase(s, pptx, "WhatsApp API：灵活定制企业场景", 4);
    addApiCapabilityFlow(s, pptx);
  }

  await pptx.writeFile({ fileName: out });
}

async function main() {
  assertPalette();
  const out = arg("--out", "/tmp/aidea-sop-ppt-mebrand-smoke.pptx");
  const scenario = arg("--scenario", "default");
  if (scenario === "me2026-app") {
    await buildMe2026AppSmoke(out);
    console.log(out);
    return;
  }

  const pptx = createPresentation({ title: "Aidea SOP PPT ME Brand Smoke" });
  await prepareIconCache(
    ["Sparkles", "Target", "ChartColumnIncreasing", "Users", "BrainCircuit", "Workflow", "Ship", "ShieldCheck"],
    [C.blue, C.purple, C.teal, C.orange, C.white]
  );

  {
    const s = pptx.addSlide();
    s.background = { color: C.blue };
    addText(s, "觅跃科技", 0.8, 1.25, 3.5, 0.45, { size: 28, bold: true, color: C.white });
    addText(s, "MEET EXPERIENCE", 0.82, 1.72, 3.6, 0.25, { size: 14, bold: true, color: C.white });
    addText(s, "Aidea SOP 品牌 PPT 生成样例", 0.8, 3.0, 6.8, 0.55, { size: 26, bold: true, color: C.white });
    addText(s, "Editable PPTX / ME Brand System / QA Ready", 0.84, 3.62, 5.8, 0.25, { size: 13, color: C.white });
    footer(s, 1, { label: "觅跃科技  |  飞书深诺", color: C.white });
  }

  {
    const s = pptx.addSlide();
    s.background = { color: C.white };
    topTitleCompact(s, pptx, "白底模板：从 SOP 到可复制交付", "用统一模板沉淀可复用方案、图标模块与 QA 规则。", 2);
    const items = [
      ["Target", "定位清晰", "每页先写结论型标题，再选择证明对象。"],
      ["Workflow", "交付标准", "页脚、卡片、图标、编号圆统一使用 helper。"],
      ["BrainCircuit", "AI 产品化", "保留可编辑文本，用透明 PNG 图标保证预览稳定。"],
    ];
    items.forEach(([icon, title, body], i) => {
      const x = 0.65 + i * 4.05;
      card(s, pptx, x, 2.45, 3.55, 2.65, { fill: C.white, line: C.divider });
      iconCircle(s, pptx, icon, x + 0.28, 2.72, 0.72, C.blue);
      addText(s, title, x + 1.22, 2.87, 1.7, 0.25, { size: 15, bold: true, color: C.ink });
      addText(s, body, x + 0.34, 3.55, 2.8, 0.62, { size: 12, color: C.text });
      pill(s, pptx, ["Source Audit", "Claim Spine", "QA Ledger"][i], x + 0.34, 4.46, 2.6, { color: C.blue });
    });
    footer(s, 2);
  }

  {
    const s = pptx.addSlide();
    s.background = { color: C.white };
    topTitleCompact(s, pptx, "管理矩阵：四个验证维度", "编号圆、文字层级、项目符号和图标行用于回归测试。", 3);
    const cards = [
      [1, "结构验证", C.purple, C.purpleBg, ["页数与 16:9", "文本可提取", "无整页背景图"]],
      [2, "品牌验证", C.blue, C.blueBg, ["色板合规", "页脚一致", "字号可读"]],
      [3, "视觉验证", C.teal, C.tealBg, ["图标非占位", "编号圆居中", "无重叠溢出"]],
      [4, "交付验证", C.orange, C.orangeBg, ["QA ledger", "限制说明", "最终 PPTX"]],
    ];
    cards.forEach(([n, title, color, fill, bullets], i) => {
      const x = i % 2 === 0 ? 0.45 : 6.9;
      const y = i < 2 ? 2.45 : 4.78;
      card(s, pptx, x, y, 5.95, 1.96, { fill, line: color, shadowOpacity: 0.05 });
      numberedCircle(s, pptx, n, x + 0.28, y + 0.22, 0.56, color, 18);
      iconTextRow(s, pptx, "ShieldCheck", x + 0.28, y + 0.5, 4.6, { title, titleW: 2.8, titleSize: 17, color, fill, iconD: 0.56 });
      bullets.forEach((b, j) => bullet(s, pptx, b, x + 0.88, y + 0.82 + j * 0.32, 4.5, color, 11));
      addText(s, "用结构化检查降低返工风险", x + 1.35, y + 1.64, 3.2, 0.18, { size: 12, bold: true, color, align: "center" });
    });
    footer(s, 3);
  }

  await pptx.writeFile({ fileName: out });
  console.log(out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
