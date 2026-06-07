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

function addSourceNote(slide, text = "测试内容基于公开资料与常识级业务归纳，用于验证 ME2026 PPT Skill；不代表实时市场研究或投资建议。") {
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
      body: "飞书深诺更偏全球媒体资源、媒介管理、整合数字营销和数字技术服务；易点天下更偏企业国际化智能营销、效果营销和平台化广告技术。",
      color: ME2026.primaryBlue,
    },
    {
      icon: "strategy",
      title: "打法差异",
      body: "前者适合需要媒体资源、策略咨询、创意和服务团队协同的客户；后者适合需要技术驱动投放、内容创意和行业方案组合的客户。",
      color: ME2026.secondaryPurple,
    },
    {
      icon: "diligence",
      title: "采购判断",
      body: "应重点核验平台授权、目标市场经验、数据技术能力、素材生产效率、行业案例和跨区域服务团队，而不是只比较返点或价格。",
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
  addText(slide, "结论：两家公司都服务中国企业出海增长，选型关键在于客户当前缺口是“全球媒体与整合服务”还是“智能营销平台与效果增长”。", 1.18, 4.86, 10.8, 0.22, {
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
      desc: "面向中国品牌全球化，强调全球媒体资源、媒介管理、整合式数字营销、数字技术服务和行业 SaaS 能力。",
      tags: ["全球媒体资源", "整合营销", "媒介管理", "数字技术"],
      strengths: ["适合多市场、多平台投放项目", "适合需要策略、创意、媒介协同", "适合品牌出海和效果增长并重"],
    },
    {
      name: "易点天下",
      icon: "automation",
      color: ME2026.secondaryPurple,
      desc: "企业国际化智能营销服务商，强调效果营销、品牌塑造、垂直行业方案，以及 Cyberklick / Yeahmobi 等平台能力。",
      tags: ["智能营销", "效果营销", "品牌塑造", "平台技术"],
      strengths: ["适合重视技术与数据驱动增长", "适合电商、游戏、工具应用等场景", "适合内容创意和投放效率联动"],
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
  addSourceNote(slide, "公开资料参考：飞书深诺 TikTok for Business 伙伴页、中国金融信息网；易点天下官网、公司概况和服务页。");
}

function addCapabilityMatrix(slide, pptx) {
  const x = 0.72;
  const y = 1.52;
  const rowH = 0.68;
  const widths = [2.2, 4.95, 4.95];
  const rows = [
    ["公司定位", "全球营销服务集团与媒体资源协同", "企业国际化智能营销服务商"],
    ["核心优势", "媒体资源、媒介管理、整合营销、数字技术", "数据技术、效果营销、内容创意、行业方案"],
    ["适配客户", "品牌预算较大、渠道复杂、需要服务协同", "重视投放效率、素材迭代和商业化变现"],
    ["交付关注", "平台授权、项目管理、跨区域执行质量", "平台产品、算法数据、素材和投放运营闭环"],
    ["尽调重点", "媒体代理关系、行业经验、服务团队配置", "Cyberklick / Yeahmobi 能力、案例和数据治理"],
  ];
  slide.addShape(pptx.ShapeType.rect, { x, y, w: 11.9, h: rowH, fill: { color: ME2026.primaryBlue }, line: { color: ME2026.primaryBlue } });
  ["维度", "飞书深诺", "易点天下"].forEach((head, i) => {
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
    ["media", "媒体触达", "全球媒体资源与媒介策略", "智能化平台与渠道匹配"],
    ["growth", "效果增长", "品效协同和广告优化", "效果营销与用户获取"],
    ["automation", "技术赋能", "数字技术服务与行业 SaaS", "数据算法、AIGC 与平台工具"],
    ["insight", "复盘优化", "服务团队与策略复盘", "数据分析与投放迭代"],
  ];
  stages.forEach(([icon, title, fsn, eclick], i) => {
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
    addText(slide, "易点天下", x + 0.18, 4.59, 2.2, 0.18, { size: 12, bold: true, color: ME2026.secondaryPurple, align: "center", margin: 0 });
    addText(slide, eclick, x + 0.22, 4.98, 2.1, 0.34, { size: 10, color: C.text, align: "center", margin: 0, fit: "shrink" });
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
      body: "如果核心问题是海外媒体资源、品牌策略和跨区域服务管理，优先评估飞书深诺；如果核心问题是投放效率、内容素材和平台化工具，重点评估易点天下。",
    },
    {
      icon: "operations",
      title: "组合打法",
      color: ME2026.secondaryPurple,
      body: "大型出海项目可拆成“策略媒介主服务商 + 效果增长/平台工具补位”，用分工降低供应商单点依赖。",
    },
    {
      icon: "diligence",
      title: "尽调重点",
      color: ME2026.tertiaryDeepTeal,
      body: "重点核验授权资质、目标行业案例、重点市场服务团队、数据归因口径、素材生产流程、AI 工具实际可用性和 SLA。",
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
  addText(slide, "Skill 验证点：ME2026 模板资产、公开安全图标、页脚居中、图标卡片对齐、竞品矩阵和正文可编辑性。", 1.08, 6.34, 11.0, 0.13, {
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
  const out = arg("--out", "/tmp/feishu-vs-eclick-me2026-test.pptx");
  const pptx = createPresentation({ title: "飞书深诺与易点天下对比分析 ME2026 Skill Test" });
  await prepareME2026IconCache([
    "comparison",
    "strategy",
    "diligence",
    "growth",
    "media",
    "automation",
    "conversion",
    "retention",
    "operations",
    "company",
    "globalization",
    "insight",
  ], [C.white]);

  addME2026Cover(pptx.addSlide(), pptx, {
    title: "飞书深诺与易点天下\n对比分析",
    subtitle: "ME2026 Skill Test：出海营销服务商对比、图标卡片与页脚 QA",
  });

  addME2026Index(pptx.addSlide(), pptx, [
    ["01", "核心结论"],
    ["02", "公司画像"],
    ["03", "能力对比矩阵"],
    ["04", "出海营销链路与适配建议"],
  ], { pageNum: 2 });

  {
    const s = pptx.addSlide();
    addME2026WhiteBase(s, pptx, "核心结论：全球媒体服务与智能营销平台的选型差异", 3);
    addCoreConclusion(s, pptx);
  }
  {
    const s = pptx.addSlide();
    addME2026WhiteBase(s, pptx, "公司画像：服务定位与能力侧重点", 4);
    addCompanyProfile(s, pptx);
  }
  {
    const s = pptx.addSlide();
    addME2026WhiteBase(s, pptx, "能力对比矩阵：从定位到尽调重点", 5);
    addCapabilityMatrix(s, pptx);
  }
  {
    const s = pptx.addSlide();
    addME2026WhiteBase(s, pptx, "出海营销链路对比：触达、增长、技术、复盘", 6);
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
