#!/usr/bin/env node
const {
  C,
  ME2026,
  ME2026_LAYOUT,
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
  addME2026LabelTextRow,
} = require("./brand_ppt_helpers.cjs");

function arg(name, fallback) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

function sourceNote(slide, text = "内容由用户提供文本整理；原文中的图片位置以可编辑占位框表示，待补充真实截图或流程图。") {
  addText(slide, text, 0.72, 6.70, 10.95, 0.20, {
    size: 8,
    color: C.textMuted,
    margin: 0,
    fit: "shrink",
  });
}

function placeholder(slide, pptx, x, y, w, h, title, note = "待补充原始图片 / 流程截图") {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.06,
    fill: { color: "F7FAFF" },
    line: { color: "D5D8F5", width: 1.1, dash: "dash" },
  });
  addText(slide, title, x + 0.18, y + h / 2 - 0.20, w - 0.36, 0.20, {
    size: 12,
    bold: true,
    color: ME2026.primaryBlue,
    align: "center",
    margin: 0,
  });
  addText(slide, note, x + 0.18, y + h / 2 + 0.08, w - 0.36, 0.18, {
    size: 9,
    color: C.textMuted,
    align: "center",
    margin: 0,
  });
}

function flow(slide, pptx, items, x, y, w, color = ME2026.primaryBlue) {
  const gap = 0.18;
  const boxW = (w - gap * (items.length - 1)) / items.length;
  items.forEach((item, i) => {
    const bx = x + i * (boxW + gap);
    slide.addShape(pptx.ShapeType.roundRect, {
      x: bx,
      y,
      w: boxW,
      h: 0.58,
      rectRadius: 0.06,
      fill: { color: i % 2 === 0 ? "F6FBFF" : "FBF7FF" },
      line: { color, width: 1.0 },
    });
    addText(slide, item, bx + 0.08, y + 0.20, boxW - 0.16, 0.18, {
      size: 10,
      bold: true,
      color,
      align: "center",
      margin: 0,
      fit: "shrink",
    });
    if (i < items.length - 1) {
      slide.addShape(pptx.ShapeType.line, {
        x: bx + boxW + 0.02,
        y: y + 0.29,
        w: gap - 0.04,
        h: 0,
        line: { color, width: 1.0, endArrowType: "triangle" },
      });
    }
  });
}

function table(slide, pptx, cfg) {
  const { x, y, widths, rowH = 0.44, header, rows, colors = [ME2026.primaryBlue, ME2026.secondaryPurple] } = cfg;
  const totalW = widths.reduce((a, b) => a + b, 0);
  slide.addShape(pptx.ShapeType.rect, {
    x,
    y,
    w: totalW,
    h: rowH,
    fill: { color: colors[0] },
    line: { color: colors[0] },
  });
  let cx = x;
  header.forEach((text, i) => {
    addText(slide, text, cx + 0.06, y + 0.15, widths[i] - 0.12, 0.16, {
      size: 10,
      bold: true,
      color: C.white,
      align: "center",
      margin: 0,
      fit: "shrink",
    });
    cx += widths[i];
  });
  rows.forEach((row, r) => {
    cx = x;
    row.forEach((text, c) => {
      const fill = c === 0 ? "EAF4FF" : r % 2 === 0 ? "FFFFFF" : "F7FAFF";
      const cy = y + rowH * (r + 1);
      slide.addShape(pptx.ShapeType.rect, {
        x: cx,
        y: cy,
        w: widths[c],
        h: rowH,
        fill: { color: fill },
        line: { color: "D5D8F5", width: 0.7 },
      });
      addText(slide, text, cx + 0.08, cy + 0.09, widths[c] - 0.16, rowH - 0.12, {
        size: 9,
        bold: c === 0,
        color: c === 0 ? colors[0] : C.text,
        align: c === 0 ? "center" : "left",
        margin: 0,
        fit: "shrink",
      });
      cx += widths[c];
    });
  });
  return { x, y, w: totalW, h: rowH * (rows.length + 1) };
}

function slidePositioning(slide, pptx) {
  [
    ["automation", "产品定位", "视频本地化引擎：覆盖短剧翻译与营销素材本地化。", ME2026.primaryBlue, "F6FBFF"],
    ["media", "短剧翻译", "内容驱动：重视字幕准确、配音匹配、校对控制和人工介入。", ME2026.secondaryPurple, "FBF7FF"],
    ["conversion", "营销素材本地化", "转化驱动：重视快速改写、翻译、多版本输出和投放测试效率。", ME2026.tertiaryDeepTeal, "EEF9FB"],
  ].forEach((item, i) => {
    addME2026IconTitleCard(slide, pptx, {
      icon: item[0],
      title: item[1],
      body: item[2],
      x: 0.78 + i * 4.04,
      y: 1.55,
      w: 3.70,
      h: 2.30,
      color: item[3],
      fill: item[4],
      bodyH: 0.72,
      bodySize: 11,
    });
  });
  card(slide, pptx, 0.92, 4.38, 11.5, 1.00, { fill: ME2026.primaryBlue, line: ME2026.primaryBlue, shadow: false, radius: 0.06 });
  addText(slide, "业务目标：完成视频上传、翻译、配音、合成、下载全流程，并支持多语言批量生成与广告多版本本地化。", 1.18, 4.72, 10.95, 0.24, {
    size: 15,
    bold: true,
    color: C.white,
    align: "center",
    margin: 0,
    fit: "shrink",
  });
  sourceNote(slide);
}

function slideArchitecture(slide, pptx) {
  const layers = [
    ["用户层", "短剧翻译入口 / Reel 营销本土化入口"],
    ["任务层", "视频上传、语言配置、字幕策略、任务状态机"],
    ["AI 层", "ASR/OCR、字幕翻译、文案改写、音色克隆、TTS"],
    ["编排层", "阶段暂停、人工校对、重试补偿、Webhook/轮询"],
    ["云服务层", "视频点播、媒资上传、字幕擦除、配音合成、下载签名"],
  ];
  layers.forEach((row, i) => {
    const y = 1.50 + i * 0.72;
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.78,
      y,
      w: 6.0,
      h: 0.50,
      rectRadius: 0.04,
      fill: { color: i % 2 ? "FBF7FF" : "F6FBFF" },
      line: { color: i % 2 ? ME2026.secondaryPurple : ME2026.primaryBlue, width: 1.0 },
    });
    addText(slide, row[0], 0.98, y + 0.16, 1.0, 0.16, { size: 10, bold: true, color: i % 2 ? ME2026.secondaryPurple : ME2026.primaryBlue, margin: 0 });
    addText(slide, row[1], 2.02, y + 0.13, 4.45, 0.22, { size: 10, color: C.text, margin: 0, fit: "shrink" });
  });
  placeholder(slide, pptx, 7.18, 1.50, 5.35, 1.65, "架构分层图片占位", "替换为飞书文档中的架构图");
  flow(slide, pptx, ["上传", "识别/擦除", "翻译/改写", "配音", "合成", "下载"], 7.18, 3.72, 5.35, ME2026.primaryBlue);
  addME2026LabelTextRow(slide, pptx, {
    label: "流程差异",
    body: "短剧：内容准确、精细可控、人工介入强；营销素材：转化效果、快速自动、人工介入弱。",
    x: 0.78,
    y: 5.30,
    labelW: 1.80,
    bodyW: 9.68,
    rowH: 0.48,
    color: ME2026.secondaryPurple,
    fill: "FBF7FF",
    bodySize: 11,
  });
  sourceNote(slide);
}

function slideModeConfig(slide, pptx) {
  const tableBox = table(slide, pptx, {
    x: 0.72,
    y: 1.55,
    widths: [1.9, 2.6, 1.75, 1.75, 1.75, 1.75],
    rowH: 0.62,
    header: ["产品线", "入口", "字幕校对", "文案改写", "多版本输出", "人工介入"],
    rows: [
      ["短剧翻译", "短剧-视频翻译", "开启", "关闭", "关闭", "强"],
      ["素材本土化", "Reel-营销本土化", "默认关闭", "开启", "开启", "弱"],
    ],
  });
  const y0 = tableBox.y + tableBox.h + ME2026_LAYOUT.tableAfterGap + 0.10;
  [
    ["media", "短剧流程", "上传视频 -> ASR/OCR -> 字幕校对 -> 配音校对 -> 合成成品", ME2026.primaryBlue, "F6FBFF"],
    ["growth", "营销流程", "上传广告 -> 擦除字幕 -> 文案改写 -> 多语言翻译 -> 多版本合成", ME2026.secondaryPurple, "FBF7FF"],
  ].forEach((row, i) => {
    addME2026IconTitleCard(slide, pptx, {
      icon: row[0],
      title: row[1],
      body: row[2],
      x: 0.92,
      y: y0 + i * 1.28,
      w: 11.45,
      h: 0.92,
      iconD: 0.58,
      headerCenterOffset: 0.46,
      color: row[3],
      fill: row[4],
      bodyX: 2.25,
      bodyPadX: 2.60,
      bodyY: 0.33,
      bodyH: 0.24,
      bodySize: 12,
      bodyValign: "mid",
    });
  });
  sourceNote(slide);
}

function slidePlanCompare(slide, pptx) {
  const tableBox = table(slide, pptx, {
    x: 0.55,
    y: 1.45,
    widths: [1.35, 1.35, 1.35, 1.35, 2.15, 4.15],
    rowH: 0.74,
    header: ["方案", "自动化", "质量", "速度", "研发复杂度", "主要风险"],
    rows: [
      ["All in 火山云", "高", "较高", "快", "低：单平台 API", "供应商锁定；火山任一服务降级会造成链路中断。"],
      ["多云方案", "低", "较高", "慢", "高：三套 SDK + 编排", "跨云传输数小时是致命伤；限流、超时、格式不兼容会放大失败率。"],
    ],
  });
  const noteY = tableBox.y + tableBox.h + ME2026_LAYOUT.tableNoteGap + 0.16;
  card(slide, pptx, 0.88, noteY, 11.65, 0.92, { fill: ME2026.primaryBlue, line: ME2026.primaryBlue, shadow: false, radius: 0.05 });
  addText(slide, "0429 结论：产品方案定为 All in 火山云；短剧优先采用“分阶段处理”，支持字幕校对后继续配音合成。", 1.10, noteY + 0.31, 11.15, 0.24, {
    size: 14,
    bold: true,
    color: C.white,
    align: "center",
    margin: 0,
    fit: "shrink",
  });
  addME2026LabelTextRow(slide, pptx, {
    label: "待决策",
    body: "Webhook 与轮询是否双保险；失败后是否允许重试当前阶段；ROI 是否足以支撑营销视频功能优先级。",
    x: 0.88,
    y: noteY + 1.26,
    labelW: 1.65,
    bodyW: 9.90,
    rowH: 0.48,
    color: ME2026.tertiaryDeepTeal,
    fill: "EEF9FB",
    bodySize: 11,
  });
  sourceNote(slide);
}

function slideVolcWorkflow(slide, pptx) {
  [
    ["场景一", "先一次性生成再局部微调", "先获得完整翻译视频，再修改字幕、重生成单句音频或更换音色，最后重新导出。"],
    ["场景二", "分阶段处理（选择）", "任务到字幕识别或翻译阶段自动暂停，人工校对后恢复，完成语音合成与视频生成。"],
  ].forEach((row, i) => {
    const y = 1.52 + i * 1.45;
    card(slide, pptx, 0.82, y, 5.70, 1.08, { fill: i === 1 ? "F6FBFF" : "FFFFFF", line: i === 1 ? ME2026.primaryBlue : "D5D8F5", shadowOpacity: 0.04 });
    addME2026LabelTextRow(slide, pptx, {
      label: row[0],
      body: row[1],
      x: 1.08,
      y: y + 0.17,
      labelW: 1.10,
      bodyW: 3.75,
      rowH: 0.38,
      gap: 0.18,
      color: i === 1 ? ME2026.primaryBlue : ME2026.tertiaryDeepTeal,
      fill: i === 1 ? "F6FBFF" : "EEF9FB",
      bodySize: 12,
    });
    addText(slide, row[2], 2.36, y + 0.62, 3.75, 0.30, { size: 9, color: C.text, margin: 0, fit: "shrink" });
  });
  placeholder(slide, pptx, 6.95, 1.52, 5.45, 1.18, "火山云场景一流程图", "待插入官方流程截图");
  placeholder(slide, pptx, 6.95, 3.10, 5.45, 1.18, "火山云场景二流程图", "当前推荐流程截图");
  flow(slide, pptx, ["媒资上传", "创建术语库", "提交 AI 翻译任务", "阶段暂停", "校对恢复", "刷新导出"], 0.92, 5.35, 11.4, ME2026.primaryBlue);
  sourceNote(slide);
}

function slideTaskManagement(slide, pptx) {
  addText(slide, "业务主键：视频文件 ID + 目标语言；不可用操作置灰并 hover 提示。", 0.78, 1.16, 11.5, 0.20, {
    size: 11,
    color: C.textMuted,
    margin: 0,
  });
  table(slide, pptx, {
    x: 0.58,
    y: 1.55,
    widths: [1.55, 1.45, 4.6, 4.6],
    rowH: 0.56,
    header: ["阶段", "状态", "核心操作", "下载操作"],
    rows: [
      ["字幕翻译", "处理中", "校对字幕、校对音色（置灰）", "原始视频、原文字幕"],
      ["字幕翻译", "待校对", "校对字幕、校对音色", "译文字幕、原始视频、原文字幕"],
      ["语音翻译", "待校对", "校对字幕、校对音色", "译文字幕、原始视频"],
      ["视频合成", "处理中", "校对入口置灰", "原始视频、字幕文件"],
      ["视频合成", "已完成", "校对字幕、校对音色", "成品视频、译文字幕、原始视频、原文字幕"],
      ["任一阶段", "失败", "查看失败原因；系统自动重试待讨论", "已有产物可下载"],
    ],
  });
  addME2026LabelTextRow(slide, pptx, {
    label: "火山对接",
    body: "通过 API 签名鉴权；SDK 对接；任务重试暂不支持人工手动触发，自动重试机制待确认。",
    x: 0.78,
    y: 5.86,
    labelW: 1.65,
    bodyW: 9.95,
    rowH: 0.46,
    color: ME2026.secondaryPurple,
    fill: "FBF7FF",
    bodySize: 10,
  });
  sourceNote(slide);
}

function slideTaskCreate(slide, pptx) {
  [
    ["上传视频", "MP4/MOV；单文件 <=1GB；批量 <=10 个"],
    ["语言配置", "选择源语言与目标语言；遵循火山任务接口"],
    ["字幕识别", "OCR、ASR、上传源字幕；srt/webvtt"],
    ["术语库", "逐行维护或 CSV 批量导入；提供模板"],
    ["擦除字幕", "开启后调用云能力精准擦除"],
    ["压制新字幕", "硬/软字幕；字号 16-36；位置与行数配置"],
    ["背景音", "保留背景音；关闭时 BackgroundVolume=0"],
    ["资源清理", "超过 90 天术语库自动清理"],
  ].forEach((f, i) => {
    const x = 0.76 + (i % 4) * 3.08;
    const y = 1.48 + Math.floor(i / 4) * 1.28;
    card(slide, pptx, x, y, 2.72, 0.94, { fill: i % 2 ? "FBF7FF" : "F6FBFF", line: i % 2 ? ME2026.secondaryPurple : ME2026.primaryBlue, shadowOpacity: 0.03 });
    addText(slide, f[0], x + 0.18, y + 0.18, 2.36, 0.18, { size: 11, bold: true, color: i % 2 ? ME2026.secondaryPurple : ME2026.primaryBlue, margin: 0 });
    addText(slide, f[1], x + 0.18, y + 0.46, 2.34, 0.32, { size: 9, color: C.text, margin: 0, fit: "shrink" });
  });
  addME2026IconTitleCard(slide, pptx, {
    icon: "api",
    title: "方案一：火山云",
    body: "服务端上传获取 vid；创建术语库；IsEraseSource=true；Webhook/轮询待定。",
    x: 0.82,
    y: 4.45,
    w: 5.55,
    h: 1.40,
    color: ME2026.primaryBlue,
    fill: "F6FBFF",
    bodyH: 0.42,
    bodySize: 9,
  });
  addME2026IconTitleCard(slide, pptx, {
    icon: "operations",
    title: "方案二：多云供应商",
    body: "腾讯云提取/擦除，Gemini 翻译，再上传火山；支持最多三处精准擦除。",
    x: 6.82,
    y: 4.45,
    w: 5.55,
    h: 1.40,
    color: ME2026.secondaryPurple,
    fill: "FBF7FF",
    bodyH: 0.42,
    bodySize: 9,
  });
  sourceNote(slide);
}

function slideSubtitleReview(slide, pptx) {
  card(slide, pptx, 0.78, 1.50, 6.10, 3.85, { fill: "F6FBFF", line: ME2026.primaryBlue, shadowOpacity: 0.04 });
  addText(slide, "字幕校对工作台", 1.08, 1.78, 2.5, 0.24, { size: 15, bold: true, color: ME2026.primaryBlue, margin: 0 });
  table(slide, pptx, {
    x: 1.08,
    y: 2.22,
    widths: [1.2, 1.65, 1.65, 1.2],
    rowH: 0.42,
    header: ["时间轴", "原文", "译文", "操作"],
    rows: [
      ["00:01.0", "识别文本", "翻译文本", "改/删"],
      ["00:05.3", "新增字幕", "重新翻译", "合并"],
      ["00:08.9", "原文校对", "译文校对", "试听"],
    ],
  });
  addText(slide, "完成校对后：保存字幕文件、上传火山云、进入语音翻译；提示用户无法再修改字幕内容。", 1.08, 4.78, 5.38, 0.24, { size: 10, color: C.text, margin: 0, fit: "shrink" });
  card(slide, pptx, 7.22, 1.50, 5.18, 3.85, { fill: "FFFFFF", line: ME2026.secondaryPurple, shadowOpacity: 0.04 });
  addText(slide, "提交校验规则", 7.52, 1.78, 2.5, 0.24, { size: 15, bold: true, color: ME2026.secondaryPurple, margin: 0 });
  ["空字幕", "时间码格式", "时间码顺序", "时间码重叠", "序号连续性", "疑似未翻译（警告）"].forEach((c, i) => {
    bullet(slide, pptx, c, 7.58, 2.24 + i * 0.38, 4.20, i === 5 ? ME2026.tertiaryAmber : ME2026.secondaryPurple, 10);
  });
  addME2026LabelTextRow(slide, pptx, {
    label: "火山接口",
    body: "GetAITranslationProject、Update/Create/RemoveAITranslationUtterance、GenerateAITranslationUtteranceAudio。",
    x: 0.86,
    y: 5.82,
    labelW: 1.55,
    bodyW: 9.82,
    rowH: 0.46,
    color: ME2026.primaryBlue,
    fill: "F6FBFF",
    bodySize: 9,
  });
  sourceNote(slide);
}

function slideVoiceReview(slide, pptx) {
  flow(slide, pptx, ["选择句段", "切换说话人", "绑定音色", "生成单句音频", "刷新项目", "预览成品"], 0.82, 1.58, 11.55, ME2026.secondaryPurple);
  [
    ["切换说话人/音色", "UpdateAITranslationUtterances：更新指定句段 SpeakerId。"],
    ["新建说话人", "CreateAITranslationSpeaker -> UpdateAITranslationUtterances。"],
    ["克隆音色", "上传参考音频 -> CreateAITranslationSpeech -> 更新说话人。"],
    ["音色库音色", "ListAITranslationSpeech -> UpdateAITranslationSpeakers。"],
  ].forEach((o, i) => {
    addME2026LabelTextRow(slide, pptx, {
      label: o[0],
      body: o[1],
      x: 0.86,
      y: 2.62 + i * 0.56,
      labelW: 2.05,
      bodyW: 4.10,
      rowH: 0.40,
      color: i % 2 ? ME2026.primaryBlue : ME2026.secondaryPurple,
      fill: i % 2 ? "F6FBFF" : "FBF7FF",
      bodySize: 9,
    });
  });
  table(slide, pptx, {
    x: 7.10,
    y: 2.50,
    widths: [1.25, 1.75, 2.05],
    rowH: 0.42,
    header: ["分类", "字段", "用途"],
    rows: [
      ["音频", "BackgroundAudio", "背景音轨"],
      ["音频", "ForegroundAudio", "前景人声"],
      ["视频", "PreviewVideo", "整体预览"],
      ["视频", "PreviewVideoMuted", "单句试听"],
      ["视频", "OutputVideo", "最终下载"],
      ["说话人", "Speakers", "音色下拉"],
      ["句段", "TargetUtterances", "逐句译文/音频"],
    ],
  });
  addText(slide, "约束：GenerateAITranslationUtteranceAudio 不支持批量操作，每次修改后需重新生成对应句段音频。", 0.92, 6.18, 11.25, 0.24, {
    size: 11,
    bold: true,
    color: ME2026.primaryBlue,
    align: "center",
    margin: 0,
    fit: "shrink",
  });
  sourceNote(slide);
}

function slideExport(slide, pptx) {
  table(slide, pptx, {
    x: 0.80,
    y: 1.55,
    widths: [2.5, 6.0, 3.0],
    rowH: 0.58,
    header: ["下载对象", "开放节点", "限制"],
    rows: [
      ["原始视频", "创建任务后即可下载", "短时签名 URL"],
      ["原文字幕", "字幕翻译任务成功后可下载", "短时签名 URL"],
      ["译文字幕", "字幕翻译任务成功后可下载", "短时签名 URL"],
      ["成品视频", "语音翻译成功且校验完成后下载", "短时签名 URL"],
      ["VoiceTranslationVideo", "配音已合成、字幕未压制", "按场景开放"],
    ],
  });
  addME2026IconTitleCard(slide, pptx, {
    icon: "shield",
    title: "下载安全边界",
    body: "下载链接采用短时签名 URL，并保留下载次数与时效限制，避免成品视频和字幕文件长期裸露。",
    x: 0.92,
    y: 5.38,
    w: 5.50,
    h: 1.08,
    color: ME2026.tertiaryDeepTeal,
    fill: "EEF9FB",
    iconD: 0.56,
    headerCenterOffset: 0.44,
    bodyX: 1.26,
    bodyY: 0.70,
    bodyH: 0.26,
    bodyPadX: 1.58,
    bodySize: 9,
  });
  addME2026IconTitleCard(slide, pptx, {
    icon: "diligence",
    title: "仍需确认",
    body: "下载次数限制、链接有效期、失败任务已有产物是否开放下载，需要与产品、法务和研发共同确认。",
    x: 6.82,
    y: 5.38,
    w: 5.50,
    h: 1.08,
    color: ME2026.secondaryPurple,
    fill: "FBF7FF",
    iconD: 0.56,
    headerCenterOffset: 0.44,
    bodyX: 1.26,
    bodyY: 0.70,
    bodyH: 0.26,
    bodyPadX: 1.58,
    bodySize: 9,
  });
  sourceNote(slide);
}

function slideMarketingCore(slide, pptx) {
  table(slide, pptx, {
    x: 0.45,
    y: 1.44,
    widths: [1.45, 2.3, 2.1, 2.1, 1.9, 0.95],
    rowH: 0.52,
    header: ["任务", "功能逻辑", "输入", "输出", "实现方式", "优先级"],
    rows: [
      ["文案提取", "视频语音转时间轴字幕", "广告视频、源语言", "原始字幕", "火山 SDK", "高"],
      ["多版本改写", "生成本地营销文案", "字幕、市场、风格、卖点", "多版本文案", "LLM prompt", "中"],
      ["多语言翻译", "扩展目标语言", "改写/原始文案、目标语言", "语言 x 版本字幕", "LLM prompt", "高"],
      ["配音与合成", "克隆音色并合成视频", "原视频、字幕文件", "语言 x 版本视频", "火山 SDK", "高"],
      ["素材分发", "分发到投放平台", "视频 URL、账号授权", "素材 ID", "API 对接", "中"],
      ["效果分析", "识别最优版本", "投放数据、素材 ID", "优化建议", "工程化", "低"],
    ],
  });
  addText(slide, "目标：把原广告视频自动生成多个本地化版本，用于广告投放与 A/B 测试，提升 CTR / CVR。", 0.78, 5.90, 11.65, 0.22, {
    size: 12,
    bold: true,
    color: ME2026.primaryBlue,
    align: "center",
    margin: 0,
    fit: "shrink",
  });
  sourceNote(slide);
}

function slideAgents(slide, pptx) {
  [
    ["globalization", "文案翻译 Agent", "根据目标市场进行语言分发，将文案翻译为自然、文化适配、受时长约束的多语言内容。", '{ "target_content_matrix": [ { "language": "en", "version": "A", "lines": [...] } ] }', ME2026.primaryBlue, "F6FBFF"],
    ["strategy", "文案改写 Agent", "解析广告卖点、目标用户与文案结构，按 PAS / AIDA / PAS 增强等策略生成多版本投放文案。", '{ "rewrite_content": [ { "version": "A", "tone": "emotional", "lines": [...] } ] }', ME2026.secondaryPurple, "FBF7FF"],
  ].forEach((a, i) => {
    const x = 0.80 + i * 6.05;
    card(slide, pptx, x, 1.48, 5.55, 4.65, { fill: a[5], line: a[4], shadowOpacity: 0.04 });
    addME2026IconBadge(slide, pptx, a[0], x + 0.54, 1.95, 0.62, { color: a[4] });
    addText(slide, a[1], x + 1.00, 1.78, 3.40, 0.24, { size: 16, bold: true, color: a[4], margin: 0 });
    addText(slide, a[2], x + 0.38, 2.48, 4.76, 0.66, { size: 10, color: C.text, margin: 0, fit: "shrink" });
    placeholder(slide, pptx, x + 0.38, 3.42, 4.76, 0.88, i === 0 ? "翻译 Agent 样式占位" : "改写 Agent 样式占位", "替换为飞书文档中的样式图片");
    addText(slide, a[3], x + 0.40, 4.56, 4.72, 0.54, { size: 9, color: C.textMuted, margin: 0, fit: "shrink" });
  });
  sourceNote(slide);
}

function slideDecisions(slide, pptx) {
  [
    ["方案定型", "产品方案定为 All in 火山云。"],
    ["字幕策略", "倾向于上传处理后的字幕，并在配音后微调字幕 + 重新配音。"],
    ["营销素材", "支持上传已有视频文件、擦除字幕、翻译；作为单独产品功能，不放在画布入口。"],
    ["校对体验", "字幕校对和音色校对合并，不让用户操作两次。"],
    ["竞品与 ROI", "参考猎豹；ROI 高不高需进一步评估。"],
    ["内容输入", "营销视频前期剧本里可能已有部分文案信息，Agent 可带入。"],
    ["短剧管理", "短剧是否增加整集管理仍需讨论。"],
  ].forEach((it, i) => {
    addME2026LabelTextRow(slide, pptx, {
      label: it[0],
      body: it[1],
      x: 0.82,
      y: 1.58 + i * 0.62,
      labelW: 1.65,
      bodyW: 9.85,
      rowH: 0.42,
      color: i % 3 === 0 ? ME2026.primaryBlue : i % 3 === 1 ? ME2026.secondaryPurple : ME2026.tertiaryDeepTeal,
      fill: i % 3 === 0 ? "F6FBFF" : i % 3 === 1 ? "FBF7FF" : "EEF9FB",
      bodySize: 10,
    });
  });
  sourceNote(slide);
}

async function main() {
  assertPalette();
  const out = arg("--out", "/tmp/video-localization-engine-me2026-test.pptx");
  const pptx = createPresentation({ title: "视频本地化引擎产品方案 ME2026 测试" });
  await prepareME2026IconCache([
    "automation",
    "media",
    "conversion",
    "growth",
    "strategy",
    "diligence",
    "globalization",
    "api",
    "operations",
    "shield",
    "insight",
    "crm",
  ]);

  let slide = pptx.addSlide();
  addME2026Cover(slide, pptx, {
    title: "视频本地化引擎\n产品方案",
    subtitle: "短剧翻译 x 营销素材本地化",
  });

  slide = pptx.addSlide();
  addME2026Index(slide, pptx, [
    "产品定位与目标",
    "架构流程与模式配置",
    "方案对比与火山云工作流",
    "短剧功能模块",
    "营销视频与 Agent 能力",
    "0429 决策总结",
  ]);

  [
    ["产品定位：一个引擎覆盖内容驱动与转化驱动", slidePositioning],
    ["产品架构：从上传到合成下载的分层链路", slideArchitecture],
    ["模式配置：短剧翻译与素材本土化差异", slideModeConfig],
    ["方案对比：All in 火山云作为当前推荐方案", slidePlanCompare],
    ["火山云工作流：选择分阶段处理以承接人工校对", slideVolcWorkflow],
    ["任务管理：围绕阶段、状态与操作权限建立状态机", slideTaskManagement],
    ["任务创建：上传、语言、字幕、术语库与字幕压制配置", slideTaskCreate],
    ["字幕校对：编辑区、校验规则与火山接口承接", slideSubtitleReview],
    ["音色校对：说话人、音色克隆与逐句音频生成", slideVoiceReview],
    ["内容导出：按任务节点开放短时签名下载", slideExport],
    ["营销视频：多语言多版本本地化能力矩阵", slideMarketingCore],
    ["营销 Agent：文案翻译与文案改写的 JSON 输出结构", slideAgents],
    ["0429 修改意见：已定方向与待确认问题", slideDecisions],
  ].forEach(([title, draw], i) => {
    const s = pptx.addSlide();
    addME2026WhiteBase(s, pptx, title, i + 3);
    draw(s, pptx);
  });

  slide = pptx.addSlide();
  addME2026ThankYou(slide, pptx, { pageNum: 16 });

  await pptx.writeFile({ fileName: out });
  console.log(out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
