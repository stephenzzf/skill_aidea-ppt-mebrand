#!/usr/bin/env node
const {
  C,
  ME2026,
  createPresentation,
  assertPalette,
  addText,
  card,
  bullet,
  pill,
  prepareME2026IconCache,
  addME2026Cover,
  addME2026Index,
  addME2026WhiteBase,
  addME2026ThankYou,
  addME2026IconBadge,
  addME2026IconTitleCard,
} = require("./brand_ppt_helpers.cjs");

function arg(name, fallback) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

function addSourceNote(slide, text = "测试内容基于公开常识级业务描述，用于验证 ME2026 PPT Skill；不代表实时市场研究或投资建议。") {
  addText(slide, text, 0.72, 6.72, 10.9, 0.18, {
    size: 8,
    color: C.textMuted,
    margin: 0,
    fit: "shrink",
  });
}

function addCoreConclusion(slide, pptx) {
  const cards = [
    {
      icon: "comparison",
      title: "定位差异",
      body: "飞书深诺更偏整合营销、媒体代理与跨境增长服务；钛动科技更偏数字营销技术、广告投放运营与商业化增长。",
      color: ME2026.primaryBlue,
    },
    {
      icon: "strategy",
      title: "打法差异",
      body: "前者适合需要营销策略、媒体资源和服务团队协同的客户；后者适合重视投放效率、素材运营和数据闭环的客户。",
      color: ME2026.secondaryPurple,
    },
    {
      icon: "diligence",
      title: "采购判断",
      body: "建议从目标市场、媒体预算、技术集成、服务响应和历史行业经验五个维度做尽调，而不是只比较报价。",
      color: ME2026.tertiaryDeepTeal,
    },
  ];
  cards.forEach((item, i) => {
    addME2026IconTitleCard(slide, pptx, {
      icon: item.icon,
      title: item.title,
      body: item.body,
      x: 0.78 + i * 4.12,
      y: 1.55,
      w: 3.55,
      h: 2.35,
      color: item.color,
      fill: i === 1 ? "FBF7FF" : C.white,
      bodyY: 1.12,
      bodyH: 0.88,
      bodySize: 11,
    });
  });
  card(slide, pptx, 0.95, 4.55, 11.25, 0.9, {
    fill: ME2026.primaryBlue,
    line: ME2026.primaryBlue,
    shadow: false,
    radius: 0.08,
  });
  addText(slide, "结论：两家公司都可服务出海增长，但最佳选择取决于客户当前缺口是“整体营销体系”还是“投放效率与运营闭环”。", 1.18, 4.86, 10.8, 0.22, {
    size: 16,
    bold: true,
    color: C.white,
    align: "center",
    margin: 0,
    fit: "shrink",
  });
  addSourceNote(slide);
}

function addCompanyProfile(slide, pptx) {
  const companies = [
    {
      name: "飞书深诺",
      icon: "globalization",
      color: ME2026.primaryBlue,
      desc: "面向中国企业出海增长，强调媒体资源、整合营销、跨境服务团队与多市场执行能力。",
      tags: ["出海营销服务", "媒体代理", "整合营销", "跨境增长"],
      strengths: ["适合预算和渠道较复杂的品牌", "适合需要策略、媒介、运营协同", "适合多区域市场扩张项目"],
    },
    {
      name: "钛动科技",
      icon: "automation",
      color: ME2026.secondaryPurple,
      desc: "面向出海企业数字营销和商业化增长，强调广告技术、素材运营、数据分析和投放优化。",
      tags: ["数字营销", "广告技术", "运营服务", "商业化增长"],
      strengths: ["适合重视投放效率的团队", "适合需要快速测试素材与渠道", "适合建立数据驱动增长流程"],
    },
  ];
  companies.forEach((item, i) => {
    const x = 0.75 + i * 6.25;
    card(slide, pptx, x, 1.55, 5.65, 4.85, {
      fill: i === 0 ? "F6FBFF" : "FBF7FF",
      line: item.color,
      shadowOpacity: 0.05,
    });
    addME2026IconBadge(slide, pptx, item.icon, x + 0.62, 2.05, 0.72, { color: item.color });
    addText(slide, item.name, x + 1.08, 1.86, 2.5, 0.34, {
      size: 18,
      bold: true,
      color: item.color,
      margin: 0,
    });
    addText(slide, item.desc, x + 0.42, 2.55, 4.75, 0.68, {
      size: 12,
      color: C.text,
      margin: 0,
      fit: "shrink",
    });
    item.tags.forEach((tag, j) => {
      pill(slide, pptx, tag, x + 0.42 + (j % 2) * 2.35, 3.45 + Math.floor(j / 2) * 0.48, 2.05, {
        fill: C.white,
        line: item.color,
        color: item.color,
        size: 10,
        h: 0.34,
      });
    });
    item.strengths.forEach((point, j) => {
      bullet(slide, pptx, point, x + 0.48, 4.75 + j * 0.34, 4.65, item.color, 10);
    });
  });
  addSourceNote(slide);
}

function addCapabilityMatrix(slide, pptx) {
  const x = 0.72;
  const y = 1.52;
  const w = 11.9;
  const rowH = 0.68;
  const widths = [2.2, 4.95, 4.95];
  const rows = [
    ["公司定位", "整合营销服务与媒体资源协同", "数字营销技术与投放运营服务"],
    ["核心优势", "策略、媒介、创意、服务团队组合", "广告投放、素材运营、数据优化闭环"],
    ["适配客户", "品牌预算较大、市场多、服务协同需求高", "增长团队强调效率、测试节奏和数据反馈"],
    ["交付关注", "媒介资源、项目管理、跨区域服务质量", "账户结构、素材迭代、优化模型和数据报表"],
    ["尽调重点", "行业案例、当地媒体经验、服务团队配置", "平台经验、技术能力、投放优化机制"],
  ];
  slide.addShape(pptx.ShapeType.rect, { x, y, w, h: rowH, fill: { color: ME2026.primaryBlue }, line: { color: ME2026.primaryBlue } });
  ["维度", "飞书深诺", "钛动科技"].forEach((head, i) => {
    const cx = x + widths.slice(0, i).reduce((a, b) => a + b, 0);
    addText(slide, head, cx + 0.1, y + 0.23, widths[i] - 0.2, 0.16, {
      size: 13,
      bold: true,
      color: C.white,
      align: "center",
      margin: 0,
    });
  });
  rows.forEach((row, r) => {
    const ry = y + rowH * (r + 1);
    const fill = r % 2 === 0 ? "F6FBFF" : C.white;
    let cx = x;
    row.forEach((text, c) => {
      slide.addShape(pptx.ShapeType.rect, {
        x: cx,
        y: ry,
        w: widths[c],
        h: rowH,
        fill: { color: c === 0 ? "EAF4FF" : fill },
        line: { color: "D5D8F5", width: 0.8 },
      });
      addText(slide, text, cx + 0.12, ry + 0.14, widths[c] - 0.24, rowH - 0.24, {
        size: c === 0 ? 12 : 11,
        bold: c === 0,
        color: c === 0 ? ME2026.primaryBlue : C.text,
        margin: 0,
        align: c === 0 ? "center" : "left",
        fit: "shrink",
      });
      cx += widths[c];
    });
  });
  addSourceNote(slide);
}

function addMarketingChain(slide, pptx) {
  const stages = [
    ["media", "媒体触达", "渠道资源与预算分配", "平台投放与素材测试"],
    ["growth", "增长转化", "整合营销活动承接", "广告数据驱动优化"],
    ["operations", "运营闭环", "服务团队项目协同", "账户、素材、报表流程化"],
    ["insight", "复盘优化", "市场经验与策略复盘", "数据分析与投放迭代"],
  ];
  stages.forEach(([icon, title, fsn, teemo], i) => {
    const x = 0.82 + i * 3.08;
    addME2026IconBadge(slide, pptx, icon, x + 0.55, 1.96, 0.64);
    addText(slide, title, x + 0.98, 1.78, 1.65, 0.32, {
      size: 15,
      bold: true,
      color: ME2026.primaryBlue,
      margin: 0,
    });
    card(slide, pptx, x, 2.55, 2.55, 1.3, { fill: "F6FBFF", line: ME2026.primaryBlue, shadowOpacity: 0.04 });
    addText(slide, "飞书深诺", x + 0.18, 2.76, 2.2, 0.18, { size: 12, bold: true, color: ME2026.primaryBlue, align: "center", margin: 0 });
    addText(slide, fsn, x + 0.22, 3.15, 2.1, 0.34, { size: 10, color: C.text, align: "center", margin: 0, fit: "shrink" });
    card(slide, pptx, x, 4.38, 2.55, 1.3, { fill: "FBF7FF", line: ME2026.secondaryPurple, shadowOpacity: 0.04 });
    addText(slide, "钛动科技", x + 0.18, 4.59, 2.2, 0.18, { size: 12, bold: true, color: ME2026.secondaryPurple, align: "center", margin: 0 });
    addText(slide, teemo, x + 0.22, 4.98, 2.1, 0.34, { size: 10, color: C.text, align: "center", margin: 0, fit: "shrink" });
    if (i < stages.length - 1) {
      slide.addShape(pptx.ShapeType.line, {
        x: x + 2.68,
        y: 1.96,
        w: 0.55,
        h: 0,
        line: { color: ME2026.primaryBlue, width: 1.2, endArrowType: "triangle" },
      });
    }
  });
  addSourceNote(slide);
}

function addScenarioAdvice(slide, pptx) {
  const rows = [
    {
      icon: "strategy",
      title: "采购策略",
      color: ME2026.primaryBlue,
      body: "先定义增长缺口：如果缺策略、媒介资源和跨区域服务，优先看整合营销能力；如果缺投放效率和数据闭环，优先看技术运营能力。",
    },
    {
      icon: "operations",
      title: "组合打法",
      color: ME2026.secondaryPurple,
      body: "预算较大的出海品牌可采用“策略服务 + 投放运营”组合，避免单一供应商覆盖所有环节导致评估失真。",
    },
    {
      icon: "diligence",
      title: "尽调重点",
      color: ME2026.tertiaryDeepTeal,
      body: "必须核验行业案例、目标市场经验、账户优化机制、素材迭代流程、服务团队 SLA 和数据报告口径。",
    },
  ];
  rows.forEach((row, i) => {
    addME2026IconTitleCard(slide, pptx, {
      icon: row.icon,
      title: row.title,
      body: row.body,
      x: 0.72,
      y: 1.55 + i * 1.55,
      w: 11.8,
      h: 1.12,
      iconD: 0.68,
      headerCenterOffset: 0.56,
      color: row.color,
      fill: i === 1 ? "FBF7FF" : "F6FBFF",
      bodyX: 3.05,
      bodyY: 0.28,
      bodyH: 0.52,
      bodyPadX: 3.35,
      bodySize: 12,
    });
  });
  card(slide, pptx, 0.92, 6.22, 11.45, 0.42, {
    fill: ME2026.primaryBlue,
    line: ME2026.primaryBlue,
    shadow: false,
    radius: 0.04,
  });
  addText(slide, "Skill 验证点：横向图标卡片、ME2026 色系、页脚 Logo 对齐、竞品对比矩阵和高密度正文可编辑性。", 1.08, 6.30, 11.0, 0.22, {
    size: 10,
    bold: true,
    color: C.white,
    align: "center",
    margin: 0,
    fit: "shrink",
  });
}

function addThankYou(slide, pptx) {
  addME2026ThankYou(slide, pptx, { pageNum: 8 });
}

async function main() {
  assertPalette();
  const out = arg("--out", "/tmp/feishu-vs-teemo-me2026-test.pptx");
  const pptx = createPresentation({ title: "飞书深诺与钛动科技对比分析 ME2026 Skill Test" });
  await prepareME2026IconCache([
    "comparison",
    "strategy",
    "diligence",
    "growth",
    "media",
    "automation",
    "conversion",
    "retention",
    "journey",
    "crm",
    "api",
    "operations",
    "company",
    "globalization",
    "insight",
  ], [C.white]);

  addME2026Cover(pptx.addSlide(), pptx, {
    title: "飞书深诺与钛动科技\n对比分析",
    subtitle: "ME2026 Skill Test：竞品对比内容密度、图标卡片与页脚 QA",
  });

  addME2026Index(pptx.addSlide(), pptx, [
    ["01", "核心结论"],
    ["02", "公司画像"],
    ["03", "能力对比矩阵"],
    ["04", "出海营销链路与适配建议"],
  ], { pageNum: 2 });

  {
    const s = pptx.addSlide();
    addME2026WhiteBase(s, pptx, "核心结论：两类出海增长服务的选型差异", 3);
    addCoreConclusion(s, pptx);
  }
  {
    const s = pptx.addSlide();
    addME2026WhiteBase(s, pptx, "公司画像：服务定位与能力侧重点", 4);
    addCompanyProfile(s, pptx);
  }
  {
    const s = pptx.addSlide();
    addME2026WhiteBase(s, pptx, "能力对比矩阵：从定位到交付关注点", 5);
    addCapabilityMatrix(s, pptx);
  }
  {
    const s = pptx.addSlide();
    addME2026WhiteBase(s, pptx, "出海营销链路对比：触达、转化、运营、复盘", 6);
    addMarketingChain(s, pptx);
  }
  {
    const s = pptx.addSlide();
    addME2026WhiteBase(s, pptx, "适配场景建议：采购策略、组合打法与尽调重点", 7);
    addScenarioAdvice(s, pptx);
  }
  addThankYou(pptx.addSlide(), pptx);

  await pptx.writeFile({ fileName: out });
  console.log(out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
