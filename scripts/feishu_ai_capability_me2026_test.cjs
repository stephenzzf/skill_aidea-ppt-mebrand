#!/usr/bin/env node
const {
  C,
  ME2026,
  createPresentation,
  assertPalette,
  addText,
  card,
  bullet,
  prepareME2026IconCache,
  addME2026Cover,
  addME2026Index,
  addME2026WhiteBase,
  addME2026ThankYou,
  addME2026IconBadge,
  addME2026IconTitleCard,
  addME2026LabelTextRow,
} = require("./brand_ppt_helpers.cjs");

function arg(name, fallback) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

function sourceNote(slide, text = "公开资料版：基于官网、公开伙伴页与云厂商案例归纳；未包含内部访谈、合同、客户数据或实时财务核验。") {
  addText(slide, text, 0.72, 6.72, 10.9, 0.18, {
    size: 8,
    color: C.textMuted,
    margin: 0,
    fit: "shrink",
  });
}

function addThreeCards(slide, pptx, cards, y = 1.55) {
  cards.forEach((item, i) => {
    addME2026IconTitleCard(slide, pptx, {
      icon: item.icon,
      title: item.title,
      body: item.body,
      x: 0.72 + i * 4.14,
      y,
      w: 3.62,
      h: 2.18,
      color: item.color,
      fill: item.fill,
      bodyY: 1.05,
      bodyH: 0.72,
      bodySize: 11,
    });
  });
}

function addConclusion(slide, pptx) {
  addThreeCards(slide, pptx, [
    {
      icon: "strategy",
      title: "AI定位",
      body: "飞书深诺公开定位为 AI 技术驱动的数字化全球营销服务集团，AI 贴近营销数据、内容创意、投放优化和客户运营链路。",
      color: ME2026.primaryBlue,
      fill: "F6FBFF",
    },
    {
      icon: "capability",
      title: "能力形态",
      body: "公开证据显示其能力更像“营销服务 + 数据平台 + AI 工具”的组合，而不是单一大模型产品。",
      color: ME2026.secondaryPurple,
      fill: "FBF7FF",
    },
    {
      icon: "diligence",
      title: "调研判断",
      body: "可确认 AI 已进入创意生产、广告素材理解、数据分类和私域自动化等环节；底层模型深度仍需尽调。",
      color: ME2026.tertiaryDeepTeal,
      fill: "F4FCFD",
    },
  ]);
  card(slide, pptx, 0.84, 4.42, 11.72, 1.0, {
    fill: ME2026.primaryBlue,
    line: ME2026.primaryBlue,
    shadow: false,
    radius: 0.08,
  });
  addText(slide, "核心结论：飞书深诺的 AI 能力价值不在“模型参数”，而在将 AI 嵌入跨境营销交付链路，提升素材理解、创意迭代、投放复盘和私域承接效率。", 1.04, 4.74, 11.32, 0.26, {
    size: 15,
    bold: true,
    color: C.white,
    align: "center",
    margin: 0,
    fit: "shrink",
  });
  sourceNote(slide);
}

function addEvidence(slide, pptx) {
  const items = [
    ["globalization", "官网定位", "官网公开表述强调 AI 技术驱动、数字化全球营销服务集团和中国品牌全球化服务。", "来源：MeetSocial 官网", ME2026.primaryBlue],
    ["media", "Creative Booster", "公开伙伴资料显示 Creative Booster 围绕大数据与 AI 做创意洞察、生产、应用与效果反馈。", "来源：TikTok / Canva 公开案例", ME2026.secondaryPurple],
    ["insight", "Datahub 广告理解", "AWS 案例披露 Datahub 使用 Amazon Bedrock 与 Claude / Nova 等能力做广告图文多模态分类。", "来源：AWS 中国案例博客", ME2026.tertiaryDeepTeal],
    ["automation", "Meetbot 私域承接", "Meetbot 公开能力聚焦 WhatsApp 私域运营、自动化触达、智能客服和高意向用户承接。", "来源：Meetbot / MeetSocial 公开页面", ME2026.primarySteel],
  ];
  items.forEach(([icon, title, body, proof, color], i) => {
    const x = 0.72 + (i % 2) * 6.12;
    const y = 1.55 + Math.floor(i / 2) * 2.24;
    card(slide, pptx, x, y, 5.52, 1.78, {
      fill: i % 2 === 0 ? "F6FBFF" : "FBF7FF",
      line: color,
      shadowOpacity: 0.05,
    });
    addME2026IconBadge(slide, pptx, icon, x + 0.52, y + 0.48, 0.58);
    addText(slide, title, x + 0.92, y + 0.28, 3.9, 0.28, {
      size: 15,
      bold: true,
      color,
      margin: 0,
      fit: "shrink",
    });
    addText(slide, body, x + 0.4, y + 0.82, 4.82, 0.38, {
      size: 11,
      color: C.text,
      margin: 0,
      fit: "shrink",
    });
    addText(slide, proof, x + 0.4, y + 1.38, 4.82, 0.16, {
      size: 9,
      bold: true,
      color: C.textMuted,
      margin: 0,
      fit: "shrink",
    });
  });
  sourceNote(slide, "证据链仅用于公开资料调研：官网定位、伙伴页面、AWS 案例与产品公开页；未使用未授权客户素材。");
}

function addCapabilityMap(slide, pptx) {
  const layers = [
    ["Database", "数据层", "广告素材、投放数据、平台事件、用户行为、私域触点与行业标签。", ME2026.primarySteel],
    ["automation", "模型层", "多模态广告理解、素材分类、创意生成辅助、客服意图识别和营销内容推荐。", ME2026.secondaryPurple],
    ["capability", "工具层", "Creative Booster、Datahub、Meetbot，以及面向投放、内容和客户运营的内部工具。", ME2026.primaryBlue],
    ["service", "服务层", "全球营销方案、媒介投放优化、创意生产、本地化运营和 WhatsApp 私域增长。", ME2026.tertiaryDeepTeal],
  ];
  layers.forEach(([icon, title, body, color], i) => {
    const y = 1.52 + i * 1.14;
    addME2026IconTitleCard(slide, pptx, {
      icon,
      title,
      body,
      x: 0.78,
      y,
      w: 11.82,
      h: 0.88,
      iconD: 0.48,
      headerCenterOffset: 0.44,
      titleSize: 15,
      color,
      fill: i % 2 === 0 ? "F6FBFF" : "FBF7FF",
      bodyX: 2.46,
      bodyY: 0.26,
      bodyH: 0.24,
      bodyPadX: 2.86,
      bodySize: 11,
    });
    if (i < layers.length - 1) {
      slide.addShape(pptx.ShapeType.line, {
        x: 6.66,
        y: y + 0.91,
        w: 0,
        h: 0.2,
        line: { color: ME2026.primaryBlue, width: 1.2, endArrowType: "triangle" },
      });
    }
  });
  sourceNote(slide);
}

function addCreativeFlow(slide, pptx) {
  addThreeCards(slide, pptx, [
    ["insight", "创意洞察", "识别高表现脚本、画面结构、卖点表达和本地化元素。", ME2026.primaryBlue, "F6FBFF"],
    ["media", "生产协同", "结合 AI 口播、模板化素材、AIGC 文案/图片辅助，提高多语言素材产出速度。", ME2026.secondaryPurple, "FBF7FF"],
    ["growth", "效果反馈", "素材上线后通过投放表现回流，形成洞察、生产、应用、复盘的迭代闭环。", ME2026.primaryBlue, "F6FBFF"],
  ].map(([icon, title, body, color, fill]) => ({ icon, title, body, color, fill })));
  const steps = ["行业素材库", "AI洞察", "创意生产", "投放应用", "效果复盘"];
  steps.forEach((step, i) => {
    const x = 0.95 + i * 2.36;
    card(slide, pptx, x, 4.55, 1.72, 0.54, {
      fill: i % 2 ? "FBF7FF" : "EAF4FF",
      line: i % 2 ? ME2026.secondaryPurple : ME2026.primaryBlue,
      shadow: false,
      radius: 0.08,
    });
    addText(slide, step, x + 0.08, 4.72, 1.56, 0.16, {
      size: 11,
      bold: true,
      color: i % 2 ? ME2026.secondaryPurple : ME2026.primaryBlue,
      align: "center",
      margin: 0,
    });
    if (i < steps.length - 1) {
      slide.addShape(pptx.ShapeType.line, {
        x: x + 1.82,
        y: 4.82,
        w: 0.46,
        h: 0,
        line: { color: ME2026.primaryBlue, width: 1.1, endArrowType: "triangle" },
      });
    }
  });
  sourceNote(slide, "Creative Booster 相关内容来自公开伙伴页和公开业务描述；具体工具能力、素材库规模和模型链路需以产品演示/合同为准。");
}

function addDatahubMatrix(slide, pptx) {
  const x = 0.72;
  const y = 1.5;
  const rowH = 0.74;
  const widths = [2.2, 4.25, 5.45];
  const rows = [
    ["问题", "传统广告素材理解依赖人工标注", "分类慢、粒度不稳、难支撑大规模素材洞察"],
    ["AI能力", "多模态识别图像与文本信号", "使用大模型做广告分类、理解素材主题和行业特征"],
    ["业务价值", "沉淀素材洞察与复盘数据", "帮助投放、创意和客户复盘更快定位有效内容"],
    ["尽调问题", "准确率、人工复核、模型成本", "需核验模型调用方式、数据权限、分类标准和错误处理"],
  ];
  slide.addShape(pptx.ShapeType.rect, { x, y, w: 11.9, h: rowH, fill: { color: ME2026.primaryBlue }, line: { color: ME2026.primaryBlue } });
  ["维度", "公开可见能力", "调研判断"].forEach((head, i) => {
    const cx = x + widths.slice(0, i).reduce((a, b) => a + b, 0);
    addText(slide, head, cx + 0.1, y + 0.25, widths[i] - 0.2, 0.16, {
      size: 13,
      bold: true,
      color: C.white,
      align: "center",
      margin: 0,
    });
  });
  rows.forEach((row, r) => {
    const ry = y + rowH * (r + 1);
    let cx = x;
    row.forEach((text, c) => {
      slide.addShape(pptx.ShapeType.rect, {
        x: cx,
        y: ry,
        w: widths[c],
        h: rowH,
        fill: { color: c === 0 ? "EAF4FF" : (r % 2 === 0 ? "F8FBFF" : C.white) },
        line: { color: "D5D8F5", width: 0.8 },
      });
      addText(slide, text, cx + 0.12, ry + 0.16, widths[c] - 0.24, rowH - 0.28, {
        size: c === 0 ? 12 : 11,
        bold: c === 0,
        color: c === 0 ? ME2026.primaryBlue : C.text,
        align: c === 0 ? "center" : "left",
        margin: 0,
        fit: "shrink",
      });
      cx += widths[c];
    });
  });
  sourceNote(slide, "AWS 中国案例公开提到 Datahub 结合 Amazon Bedrock 与 Claude / Nova 处理广告图文多模态分类；此页不推断内部模型资产。");
}

function addPrivateDomain(slide, pptx) {
  const stages = [
    ["media", "广告触达", "CTWA、短视频与落地页把高意向用户引入 WhatsApp"],
    ["automation", "智能接待", "自动化消息、意图识别、客服辅助和问题分流"],
    ["crm", "标签沉淀", "收集需求、预算、行业、地域与交互行为标签"],
    ["conversion", "转化运营", "根据用户阶段做跟进、复购、召回和 LTV 提升"],
  ];
  stages.forEach(([icon, title, body], i) => {
    const x = 0.9 + i * 3.0;
    addME2026IconBadge(slide, pptx, icon, x + 0.86, 1.9, 0.64);
    addText(slide, title, x + 0.12, 2.46, 1.48, 0.28, {
      size: 14,
      bold: true,
      color: i === 1 ? ME2026.secondaryPurple : ME2026.primaryBlue,
      align: "center",
      margin: 0,
    });
    card(slide, pptx, x, 3.02, 1.76, 1.38, {
      fill: i % 2 ? "FBF7FF" : "F6FBFF",
      line: i === 1 ? ME2026.secondaryPurple : ME2026.primaryBlue,
      shadowOpacity: 0.04,
    });
    addText(slide, body, x + 0.18, 3.34, 1.4, 0.54, {
      size: 10,
      color: C.text,
      align: "center",
      margin: 0,
      fit: "shrink",
    });
    if (i < stages.length - 1) {
      slide.addShape(pptx.ShapeType.line, {
        x: x + 1.92,
        y: 3.7,
        w: 0.82,
        h: 0,
        line: { color: ME2026.primaryBlue, width: 1.2, endArrowType: "triangle" },
      });
    }
  });
  sourceNote(slide);
}

function addDiligence(slide, pptx) {
  const rows = [
    ["diligence", "技术深度", "区分自研模型、外部大模型集成、提示词/工作流封装和人工服务增强；要求产品演示与真实案例流程。", ME2026.primaryBlue],
    ["compliance", "数据治理", "核验跨平台数据权限、客户数据隔离、素材版权、用户隐私、模型调用日志和人工复核机制。", ME2026.tertiaryDeepTeal],
    ["growth", "商业落地", "评估 AI 是否能独立交付为工具，还是主要依赖服务团队；重点看 ROI、SLA、价格口径和客户续约。", ME2026.secondaryPurple],
  ];
  rows.forEach(([icon, title, body, color], i) => {
    addME2026IconTitleCard(slide, pptx, {
      icon,
      title,
      body,
      x: 0.72,
      y: 1.55 + i * 1.55,
      w: 11.8,
      h: 1.12,
      iconD: 0.68,
      headerCenterOffset: 0.56,
      color,
      fill: i === 1 ? "F4FCFD" : "F6FBFF",
      bodyX: 3.05,
      bodyY: 0.28,
      bodyH: 0.52,
      bodyPadX: 3.35,
      bodySize: 12,
    });
  });
  addME2026LabelTextRow(slide, pptx, {
    label: "建议补充材料",
    body: "产品演示、典型客户案例、AI 工具清单、模型/云服务架构说明、数据合规说明、真实投放复盘样本、报价与 SLA。",
    x: 0.86,
    y: 6.04,
    labelW: 1.42,
    bodyW: 9.85,
    rowH: 0.42,
    gap: 0.28,
    color: ME2026.primaryBlue,
    fill: C.white,
    bodySize: 10,
  });
  sourceNote(slide);
}

async function main() {
  const out = arg("--out", "/tmp/feishu-ai-capability-me2026-test.pptx");
  assertPalette();
  await prepareME2026IconCache([
    "strategy",
    "capability",
    "diligence",
    "globalization",
    "media",
    "insight",
    "automation",
    "service",
    "crm",
    "conversion",
    "growth",
    "compliance",
    "Database",
  ]);

  const pptx = createPresentation({ title: "飞书深诺AI能力调研报告", author: "Codex" });

  let slide = pptx.addSlide();
  addME2026Cover(slide, pptx, {
    title: "飞书深诺AI能力\n调研报告",
    subtitle: "公开资料版 | AI营销、数据智能与私域自动化能力梳理",
    titleW: 8.0,
    titleSize: 42,
  });

  slide = pptx.addSlide();
  addME2026Index(slide, pptx, {
    pageNum: 2,
    rows: [
      ["01", "核心结论"],
      ["02", "公开证据链"],
      ["03", "AI能力地图"],
      ["04", "应用场景与尽调建议"],
    ],
  });

  slide = pptx.addSlide();
  addME2026WhiteBase(slide, pptx, "核心结论：AI能力嵌入跨境营销交付链路", 3);
  addConclusion(slide, pptx);

  slide = pptx.addSlide();
  addME2026WhiteBase(slide, pptx, "公开证据链：四类资料支撑AI能力判断", 4);
  addEvidence(slide, pptx);

  slide = pptx.addSlide();
  addME2026WhiteBase(slide, pptx, "AI能力地图：从数据、模型、工具到服务闭环", 5);
  addCapabilityMap(slide, pptx);

  slide = pptx.addSlide();
  addME2026WhiteBase(slide, pptx, "AI创意与内容能力：Creative Booster 所代表的创意闭环", 6);
  addCreativeFlow(slide, pptx);

  slide = pptx.addSlide();
  addME2026WhiteBase(slide, pptx, "数据智能与广告理解能力：Datahub 的多模态分类场景", 7);
  addDatahubMatrix(slide, pptx);

  slide = pptx.addSlide();
  addME2026WhiteBase(slide, pptx, "私域自动化与智能客服能力：Meetbot 承接高意向用户", 8);
  addPrivateDomain(slide, pptx);

  slide = pptx.addSlide();
  addME2026WhiteBase(slide, pptx, "尽调建议：把AI能力拆成技术、数据与商业三条线", 9);
  addDiligence(slide, pptx);

  slide = pptx.addSlide();
  addME2026ThankYou(slide, pptx, { pageNum: 10 });

  await pptx.writeFile({ fileName: out });
  console.log(out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
