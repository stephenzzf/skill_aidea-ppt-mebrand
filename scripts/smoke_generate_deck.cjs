#!/usr/bin/env node
const path = require("path");
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

async function main() {
  assertPalette();
  const out = arg("--out", "/tmp/aidea-sop-ppt-mebrand-smoke.pptx");
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
    brandStripe(s, pptx);
    addText(s, "白底模板：从 SOP 到可复制交付", 0.72, 0.44, 8.0, 0.42, { size: 24, bold: true, color: C.ink });
    addText(s, "用统一模板把咨询、技术、数据与 AI 产品化能力沉淀为可复用方案。", 0.74, 0.96, 9.6, 0.24, { size: 13.5, bold: true, color: C.blue });
    const items = [
      ["Target", "定位清晰", "每页先写结论型标题，再选择证明对象。"],
      ["Workflow", "交付标准", "页脚、卡片、图标、编号圆统一使用 helper。"],
      ["BrainCircuit", "AI 产品化", "保留可编辑文本，用透明 PNG 图标保证预览稳定。"],
    ];
    items.forEach(([icon, title, body], i) => {
      const x = 0.65 + i * 4.05;
      card(s, pptx, x, 1.75, 3.55, 3.0, { fill: C.white, line: C.divider });
      iconCircle(s, pptx, icon, x + 0.28, 2.05, 0.72, C.blue);
      addText(s, title, x + 1.22, 2.14, 1.7, 0.25, { size: 15, bold: true, color: C.ink });
      addText(s, body, x + 0.34, 2.9, 2.8, 0.7, { size: 11.5, color: C.text });
      pill(s, pptx, ["Source Audit", "Claim Spine", "QA Ledger"][i], x + 0.34, 4.05, 2.6, { color: C.blue });
    });
    footer(s, 2);
  }

  {
    const s = pptx.addSlide();
    s.background = { color: C.white };
    addText(s, "管理矩阵：四个验证维度", 0.45, 0.32, 6.6, 0.42, { size: 24, bold: true, color: C.ink });
    addText(s, "编号圆、文字层级、项目符号和底部金句用于回归测试。", 0.47, 0.86, 7.4, 0.23, { size: 13, bold: true, color: C.blue });
    const cards = [
      [1, "结构验证", C.purple, C.purpleBg, ["页数与 16:9", "文本可提取", "无整页背景图"]],
      [2, "品牌验证", C.blue, C.blueBg, ["色板合规", "页脚一致", "字号可读"]],
      [3, "视觉验证", C.teal, C.tealBg, ["图标非占位", "编号圆居中", "无重叠溢出"]],
      [4, "交付验证", C.orange, C.orangeBg, ["QA ledger", "限制说明", "最终 PPTX"]],
    ];
    cards.forEach(([n, title, color, fill, bullets], i) => {
      const x = i % 2 === 0 ? 0.45 : 6.9;
      const y = i < 2 ? 1.35 : 4.0;
      card(s, pptx, x, y, 5.95, 2.25, { fill, line: color, shadowOpacity: 0.05 });
      numberedCircle(s, pptx, n, x + 0.28, y + 0.22, 0.56, color, 18);
      addText(s, title, x + 1.05, y + 0.28, 2.8, 0.26, { size: 17, bold: true, color });
      bullets.forEach((b, j) => bullet(s, pptx, b, x + 0.88, y + 0.92 + j * 0.34, 4.5, color, 11.2));
      addText(s, "用结构化检查降低返工风险", x + 1.35, y + 1.92, 3.2, 0.18, { size: 12, bold: true, color, align: "center" });
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
