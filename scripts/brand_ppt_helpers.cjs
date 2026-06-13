const fs = require("fs");
const path = require("path");
const Module = require("module");

const SKILL_DIR = path.resolve(__dirname, "..");

function addModulePath(dir) {
  if (!dir || !fs.existsSync(dir)) return;
  const current = process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter) : [];
  if (!current.includes(dir)) {
    process.env.NODE_PATH = [dir, ...current].join(path.delimiter);
    Module._initPaths();
  }
}

addModulePath(path.join(SKILL_DIR, "node_modules"));
addModulePath(process.env.AIDEA_PPT_NODE_MODULES);
addModulePath(process.env.CODEX_NODE_MODULES);

function requireDependency(name) {
  try {
    return require(name);
  } catch (err) {
    if (err && err.code === "MODULE_NOT_FOUND") {
      throw new Error(
        [
          `[aidea-sop-ppt-mebrand] Missing Node dependency "${name}".`,
          `Run: cd "${SKILL_DIR}" && npm install`,
          "If dependencies are provided by the host agent, set AIDEA_PPT_NODE_MODULES, NODE_PATH, or CODEX_NODE_MODULES.",
          `Original error: ${err.message}`,
        ].join("\n")
      );
    }
    throw err;
  }
}

const PptxGenJS = requireDependency("pptxgenjs");
const lucide = requireDependency("lucide");
const sharp = requireDependency("sharp");

const C = {
  blue: "1A4FFF",
  blueBright: "1FA5F0",
  blueDark: "0E3CCC",
  blueBg: "EEF2FF",
  blueBgSoft: "F4F6FF",
  purple: "7C3AED",
  purpleDark: "4C1D95",
  purpleBg: "F5F3FF",
  purpleLight: "EDE9FE",
  sky: "7DD3FC",
  mint: "5EEAD4",
  teal: "0E7490",
  tealDark: "1E5F8E",
  tealBg: "ECFDF5",
  tealLight: "CCFBF1",
  orange: "F97316",
  orangeBg: "FFF7ED",
  orangeLight: "FED7AA",
  amber: "F59E0B",
  lavender: "C084FC",
  white: "FFFFFF",
  ink: "0F172A",
  text: "1E293B",
  textMid: "475569",
  textMuted: "64748B",
  divider: "E2E8F0",
  cardBorder: "E5E7EB",
};

const ME2026 = {
  primaryBlue: "1161F7",
  primarySteel: "398BBF",
  primaryDarkBlue: "0D49B9",
  secondaryPurple: "8801DF",
  secondaryDarkPurple: "6601A7",
  secondarySky: "4CB9FF",
  secondaryCyan: "45D0E4",
  tertiaryLavender: "B867EC",
  tertiaryAmber: "FFC000",
  tertiaryWarmGray: "403C3C",
  tertiaryDeepTeal: "226872",
  tertiaryDeepBlue: "265C80",
  lightGray: "E7E5E5",
  midGray: "545354",
  softBlue: "D5D8F5",
  panelGray: "F4F4F4",
};

const FONT = "Source Han Sans CN";
const FONT_FALLBACK = "Arial";
const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const ME2026_ASSET_DIR = path.join(__dirname, "..", "assets", "me-2026-app");
const ME2026_DELOITTE_ICON_DIR = path.join(ME2026_ASSET_DIR, "deloitte-white-icons");
const ME2026_ASSETS = {
  coverBg: path.join(ME2026_ASSET_DIR, "cover-bg.jpg"),
  indexBg: path.join(ME2026_ASSET_DIR, "index-bg.jpg"),
  meetsocialGroupLogo: path.join(ME2026_ASSET_DIR, "meetsocial-group-logo.png"),
  meetExperienceCoverLogo: path.join(ME2026_ASSET_DIR, "meet-experience-cover-logo.png"),
  meetExperienceFooterLogo: path.join(ME2026_ASSET_DIR, "meet-experience-footer-logo.png"),
  meetsocialFooterLogo: path.join(ME2026_ASSET_DIR, "meetsocial-footer-logo.png"),
  thankYouBg: path.join(ME2026_ASSET_DIR, "thank-you-bg.jpg"),
  thankYouMeetSocialLogo: path.join(ME2026_ASSET_DIR, "thank-you-meetsocial-logo.png"),
  thankYouOfficialQr: path.join(ME2026_ASSET_DIR, "thank-you-official-qr.jpg"),
};

const ME2026_ICON_LIBRARY = {
  comparison: { icon: "GitCompareArrows", color: ME2026.primaryBlue, fill: "EAF4FF", label: "对比分析" },
  strategy: { icon: "Target", color: ME2026.primaryBlue, fill: "EAF4FF", label: "策略" },
  diligence: { icon: "SearchCheck", color: ME2026.tertiaryDeepTeal, fill: "EEF9FB", label: "尽调" },
  growth: { icon: "TrendingUp", color: ME2026.primaryBlue, fill: "EAF4FF", label: "增长" },
  media: { icon: "Megaphone", color: ME2026.secondaryPurple, fill: "F6ECFF", label: "媒体" },
  automation: { icon: "Bot", color: ME2026.secondaryPurple, fill: "F6ECFF", label: "自动化" },
  conversion: { icon: "BadgeDollarSign", color: ME2026.primaryBlue, fill: "EAF4FF", label: "转化" },
  retention: { icon: "RefreshCcw", color: ME2026.secondarySky, fill: "EAF8FF", label: "留存" },
  pricing: { icon: "CircleDollarSign", color: ME2026.tertiaryAmber, fill: "FFF8DA", label: "价格" },
  journey: { icon: "Route", color: ME2026.tertiaryLavender, fill: "FAF0FF", label: "旅程" },
  crm: { icon: "Users", color: ME2026.primarySteel, fill: "EEF8FC", label: "CRM" },
  api: { icon: "Network", color: ME2026.primaryDarkBlue, fill: "EAF4FF", label: "API" },
  operations: { icon: "Workflow", color: ME2026.secondaryPurple, fill: "F6ECFF", label: "运营" },
  compliance: { icon: "ShieldCheck", color: ME2026.tertiaryDeepTeal, fill: "EEF9FB", label: "合规" },
  service: { icon: "Handshake", color: ME2026.primaryBlue, fill: "EAF4FF", label: "服务" },
  company: { icon: "Building2", color: ME2026.primarySteel, fill: "EEF8FC", label: "公司" },
  globalization: { icon: "Globe", color: ME2026.primaryBlue, fill: "EAF4FF", label: "全球化" },
  insight: { icon: "FileSearch", color: ME2026.tertiaryDeepTeal, fill: "EEF9FB", label: "洞察" },
  capability: { icon: "Layers", color: ME2026.secondaryPurple, fill: "F6ECFF", label: "能力" },
  message: { icon: "MessageCircle", color: ME2026.primaryBlue, fill: "EAF4FF", label: "消息" },
};

function loadME2026DeloitteWhiteIcons() {
  const catalogPath = path.join(ME2026_DELOITTE_ICON_DIR, "catalog.json");
  if (!fs.existsSync(catalogPath)) return {};
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const items = {};
  for (const icon of catalog.icons || []) {
    const asset = path.join(ME2026_DELOITTE_ICON_DIR, icon.file);
    if (!icon.alias || !fs.existsSync(asset)) continue;
    items[icon.alias] = {
      asset,
      color: icon.color || ME2026.primaryBlue,
      fill: "FFFFFF",
      label: icon.label || icon.alias,
      sourceSlide: icon.sourceSlide,
      sourceLabel: icon.sourceLabel,
    };
  }
  return items;
}

Object.assign(ME2026_ICON_LIBRARY, loadME2026DeloitteWhiteIcons());
const iconCache = new Map();

function createPresentation({ title = "ME Brand Deck", author = "Codex" } = {}) {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "ME_WIDE", width: SLIDE_W, height: SLIDE_H });
  pptx.layout = "ME_WIDE";
  pptx.author = author;
  pptx.company = "觅跃科技";
  pptx.subject = title;
  pptx.title = title;
  pptx.lang = "zh-CN";
  pptx.theme = {
    headFontFace: FONT,
    bodyFontFace: FONT,
    lang: "zh-CN",
  };
  return pptx;
}

function softShadow(opacity = 0.08) {
  return { type: "outer", color: C.ink, opacity, blur: 1, angle: 45, distance: 1 };
}

function assertPalette() {
  Object.entries(C).forEach(([name, value]) => {
    if (!/^[0-9A-F]{6}$/i.test(value)) {
      throw new Error(`Invalid palette color ${name}: ${value}`);
    }
  });
}

function addText(slide, text, x, y, w, h, opts = {}) {
  slide.addText(text, {
    x,
    y,
    w,
    h,
    fontFace: opts.fontFace || FONT,
    latinFontFace: opts.latinFontFace || FONT_FALLBACK,
    eastAsianFontFace: opts.eastAsianFontFace || FONT,
    fontSize: opts.size || 12,
    bold: Boolean(opts.bold),
    italic: Boolean(opts.italic),
    color: opts.color || C.text,
    align: opts.align || "left",
    valign: opts.valign || "mid",
    margin: opts.margin ?? 0,
    fit: opts.fit || "shrink",
    breakLine: opts.breakLine || false,
    paraSpaceAfterPt: opts.paraSpaceAfterPt ?? 0,
    bullet: opts.bullet,
    lineSpacingMultiple: opts.lineSpacingMultiple,
  });
}

function card(slide, pptx, x, y, w, h, opts = {}) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: opts.radius ?? 0.08,
    fill: { color: opts.fill || C.white, transparency: opts.transparency ?? 0 },
    line: { color: opts.line || C.cardBorder, width: opts.lineWidth || 1 },
    shadow: opts.shadow === false ? undefined : softShadow(opts.shadowOpacity ?? 0.06),
  });
}

function brandStripe(slide, pptx, x = 0.45, y = 0.5) {
  slide.addShape(pptx.ShapeType.rect, {
    x,
    y,
    w: 0.1,
    h: 0.55,
    fill: { color: C.blue },
    line: { color: C.blue },
  });
}

function topTitleCompact(slide, pptx, title, subtitle, pageNum, opts = {}) {
  const x = opts.x ?? 0.78;
  const titleY = opts.titleY ?? 0.42;
  const stripeX = opts.stripeX ?? 0.45;
  const stripeY = opts.stripeY ?? 0.48;
  brandStripe(slide, pptx, stripeX, stripeY);
  addText(slide, title, x, titleY, opts.titleW ?? 11.2, opts.titleH ?? 0.42, {
    size: opts.titleSize ?? 24,
    bold: true,
    color: opts.titleColor || C.ink,
    margin: 0,
  });
  if (subtitle) {
    addText(slide, subtitle, x, opts.subtitleY ?? 0.94, opts.subtitleW ?? 11.2, opts.subtitleH ?? 0.34, {
      size: opts.subtitleSize ?? 18,
      color: opts.subtitleColor || C.textMuted,
      margin: 0,
    });
  }
  if (pageNum !== undefined && pageNum !== null) footer(slide, pageNum, opts.footer || {});
}

function footer(slide, pageNum, opts = {}) {
  const label = opts.label || "觅跃科技  |  飞书深诺";
  const color = opts.color || C.textMuted;
  addText(slide, label, 0.5, 7.06, 3.0, 0.22, { size: 10, color });
  addText(slide, String(pageNum), 12.55, 7.06, 0.32, 0.22, {
    size: 10,
    bold: true,
    color,
    align: "right",
  });
}

function numberedCircle(slide, pptx, n, x, y, d, color = C.blue, size = 16) {
  slide.addShape(pptx.ShapeType.ellipse, {
    x,
    y,
    w: d,
    h: d,
    fill: { color },
    line: { color },
  });
  slide.addText(String(n), {
    x,
    y,
    w: d,
    h: d,
    margin: 0,
    fontFace: FONT,
    latinFontFace: FONT_FALLBACK,
    eastAsianFontFace: FONT,
    fontSize: size,
    bold: true,
    color: C.white,
    align: "center",
    valign: "mid",
    fit: "shrink",
  });
}

function xmlAttrs(attrs = {}) {
  return Object.entries(attrs)
    .map(([k, v]) => `${k}="${String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`)
    .join(" ");
}

function lucideSvg(iconName, color = C.blue, strokeWidth = 2.4) {
  const node = lucide[iconName] || lucide.CircleHelp;
  const body = node.map(([tag, attrs]) => `<${tag} ${xmlAttrs(attrs)}/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 24 24" fill="none" stroke="#${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

async function prepareIconCache(iconNames = [], colors = [C.blue]) {
  const names = [...new Set(iconNames.length ? iconNames : ["CircleHelp"])];
  const colorList = [...new Set(colors)];
  for (const iconName of names) {
    for (const color of colorList) {
      const key = `${iconName}:${color}`;
      if (iconCache.has(key)) continue;
      const svg = lucideSvg(iconName, color, 2.45);
      const png = await sharp(Buffer.from(svg)).resize(192, 192).png().toBuffer();
      iconCache.set(key, `data:image/png;base64,${png.toString("base64")}`);
    }
  }
}

function addIcon(slide, iconName, x, y, w, h, color = C.blue) {
  const data = iconCache.get(`${iconName}:${color}`);
  if (!data) throw new Error(`Icon not prepared: ${iconName}:${color}`);
  slide.addImage({ data, x, y, w, h });
}

function iconCircle(slide, pptx, iconName, x, y, d, color = C.blue, fill = C.blueBg) {
  slide.addShape(pptx.ShapeType.ellipse, {
    x,
    y,
    w: d,
    h: d,
    fill: { color: fill },
    line: { color: C.divider, transparency: 15 },
  });
  const pad = d * 0.28;
  addIcon(slide, iconName, x + pad, y + pad, d - pad * 2, d - pad * 2, color);
}

function iconBadge(slide, pptx, iconName, cx, cy, d = 0.64, opts = {}) {
  const color = opts.color || C.blue;
  const fill = opts.fill || C.blueBg;
  iconCircle(slide, pptx, iconName, cx - d / 2, cy - d / 2, d, color, fill);
}

function iconTextRow(slide, pptx, iconName, x, centerY, w, opts = {}) {
  const d = opts.iconD ?? 0.54;
  const color = opts.color || C.blue;
  const fill = opts.fill || C.blueBg;
  iconBadge(slide, pptx, iconName, x + d / 2, centerY, d, { color, fill });
  const titleX = x + d + (opts.gap ?? 0.22);
  const titleW = opts.titleW ?? 1.1;
  const titleH = opts.titleH ?? 0.28;
  addText(slide, opts.title || "", titleX, centerY - titleH / 2, titleW, titleH, {
    size: opts.titleSize ?? 13,
    bold: true,
    color,
    margin: 0,
    valign: "mid",
  });
  if (opts.body) {
    const bodyX = titleX + titleW + (opts.bodyGap ?? 0.24);
    addText(slide, opts.body, bodyX, centerY - (opts.bodyH ?? 0.36) / 2, w - (bodyX - x), opts.bodyH ?? 0.36, {
      size: opts.bodySize ?? 11,
      color: opts.bodyColor || C.text,
      margin: 0,
      valign: "mid",
      fit: "shrink",
    });
  }
}

function resolveME2026Icon(keyOrIcon) {
  if (!keyOrIcon) return { ...ME2026_ICON_LIBRARY.insight };
  if (ME2026_ICON_LIBRARY[keyOrIcon]) return { ...ME2026_ICON_LIBRARY[keyOrIcon] };
  return {
    icon: lucide[keyOrIcon] ? keyOrIcon : "CircleHelp",
    color: ME2026.primaryBlue,
    fill: "EAF4FF",
    label: keyOrIcon,
  };
}

async function prepareME2026IconCache(keys = Object.keys(ME2026_ICON_LIBRARY), extraColors = []) {
  const resolved = keys.map(resolveME2026Icon);
  const names = resolved.filter((item) => !item.asset).map((item) => item.icon);
  const colors = [...resolved.map((item) => item.color), ...extraColors];
  if (names.length) await prepareIconCache(names, colors);
}

function addME2026IconBadge(slide, pptx, keyOrIcon, cx, cy, d = 0.68, opts = {}) {
  const item = { ...resolveME2026Icon(keyOrIcon), ...opts };
  if (item.asset) {
    slide.addShape(pptx.ShapeType.ellipse, {
      x: cx - d / 2,
      y: cy - d / 2,
      w: d,
      h: d,
      fill: { color: item.fill || C.white },
      line: { color: item.line || item.color || ME2026.primaryBlue, transparency: item.lineTransparency ?? 0, width: item.lineWidth ?? 1 },
    });
    const pad = item.pad ?? d * 0.23;
    slide.addImage({ path: item.asset, x: cx - d / 2 + pad, y: cy - d / 2 + pad, w: d - pad * 2, h: d - pad * 2 });
    return;
  }
  iconBadge(slide, pptx, item.icon, cx, cy, d, {
    color: item.color,
    fill: item.fill,
  });
}

function addME2026IconTitleCard(slide, pptx, cfg = {}) {
  const x = cfg.x ?? 0.8;
  const y = cfg.y ?? 1.55;
  const w = cfg.w ?? 3.6;
  const h = cfg.h ?? 1.2;
  const iconD = cfg.iconD ?? 0.72;
  const iconX = x + (cfg.iconX ?? 0.28);
  const rowCenterY = cfg.centerY ?? y + (cfg.headerCenterOffset ?? 0.48);
  const titleX = iconX + iconD + (cfg.gap ?? 0.34);
  const titleH = cfg.titleH ?? 0.34;
  const icon = resolveME2026Icon(cfg.icon || cfg.iconKey || "insight");
  const accent = cfg.color || icon.color;
  const fill = cfg.iconFill || icon.fill;

  card(slide, pptx, x, y, w, h, {
    fill: cfg.fill || C.white,
    line: cfg.line || accent,
    lineWidth: cfg.lineWidth ?? 1,
    shadow: cfg.shadow,
    shadowOpacity: cfg.shadowOpacity ?? 0.05,
    radius: cfg.radius ?? 0.08,
  });
  addME2026IconBadge(slide, pptx, cfg.icon || cfg.iconKey || "insight", iconX + iconD / 2, rowCenterY, iconD, {
    color: accent,
    fill,
  });
  addText(slide, cfg.title || icon.label, titleX, rowCenterY - titleH / 2, cfg.titleW ?? w - (titleX - x) - 0.28, titleH, {
    size: cfg.titleSize ?? 16,
    bold: true,
    color: cfg.titleColor || accent,
    margin: 0,
    valign: "mid",
    fit: "shrink",
  });
  if (cfg.body) {
    const bodyH = cfg.bodyH ?? Math.max(0.24, h - (cfg.bodyY ?? 1.08) - 0.2);
    addText(slide, cfg.body, x + (cfg.bodyX ?? 0.32), y + (cfg.bodyY ?? 1.08), w - (cfg.bodyPadX ?? 0.64), bodyH, {
      size: cfg.bodySize ?? 11,
      color: cfg.bodyColor || C.text,
      margin: 0,
      fit: "shrink",
      valign: cfg.bodyValign || "top",
      breakLine: cfg.bodyBreakLine,
    });
  }
  if (Array.isArray(cfg.bullets)) {
    const bulletY = y + (cfg.bulletY ?? 1.08);
    cfg.bullets.forEach((text, i) => {
      bullet(slide, pptx, text, x + (cfg.bulletX ?? 0.36), bulletY + i * (cfg.bulletGap ?? 0.34), w - (cfg.bulletWPad ?? 0.72), accent, cfg.bulletSize ?? 10);
    });
  }
}

function addME2026StackedIconRow(slide, pptx, cfg = {}) {
  const x = cfg.x ?? 0.8;
  const y = cfg.y ?? 1.55;
  const w = cfg.w ?? 3.4;
  const h = cfg.h ?? 0.88;
  const color = cfg.color || resolveME2026Icon(cfg.icon || cfg.iconKey || "insight").color;
  const iconD = cfg.iconD ?? 0.44;
  const iconSlotW = cfg.iconSlotW ?? 0.82;
  const padX = cfg.padX ?? 0.24;
  const centerY = y + h / 2;
  const textX = x + padX + iconSlotW;
  const textW = w - (textX - x) - (cfg.textRightPad ?? 0.24);
  const titleH = cfg.titleH ?? 0.24;
  const titleY = y + (cfg.titleY ?? 0.17);
  const bodyY = titleY + titleH + (cfg.titleBodyGap ?? 0.08);
  const bodyH = cfg.bodyH ?? Math.max(0.18, h - (bodyY - y) - 0.16);

  card(slide, pptx, x, y, w, h, {
    fill: cfg.fill || C.white,
    line: cfg.line || color,
    shadow: cfg.shadow,
    shadowOpacity: cfg.shadowOpacity ?? 0.04,
    radius: cfg.radius ?? 0.06,
  });
  addME2026IconBadge(slide, pptx, cfg.icon || cfg.iconKey || "insight", x + padX + iconD / 2, centerY, iconD, {
    color,
    fill: cfg.iconFill || resolveME2026Icon(cfg.icon || cfg.iconKey || "insight").fill,
  });
  addText(slide, cfg.title || "", textX, titleY, textW, titleH, {
    size: cfg.titleSize ?? 12,
    bold: true,
    color: cfg.titleColor || color,
    margin: 0,
    valign: "mid",
    fit: "shrink",
  });
  if (cfg.body) {
    addText(slide, cfg.body, textX, bodyY, textW, bodyH, {
      size: cfg.bodySize ?? 9,
      color: cfg.bodyColor || C.text,
      margin: 0,
      valign: "top",
      fit: "shrink",
      breakLine: cfg.bodyBreakLine,
    });
  }
}

function pill(slide, pptx, text, x, y, w, opts = {}) {
  const h = opts.h || 0.42;
  const size = opts.size || 12;
  const textH = opts.textH ?? Math.min(h, Math.max(0.18, size / 72 * 1.35));
  card(slide, pptx, x, y, w, h, {
    fill: opts.fill || C.blueBgSoft,
    line: opts.line || C.divider,
    shadow: false,
    radius: opts.radius ?? 0.07,
  });
  addText(slide, text, x + (opts.padX ?? 0.1), y + (h - textH) / 2, w - (opts.padX ?? 0.1) * 2, textH, {
    size,
    bold: opts.bold ?? true,
    color: opts.color || C.blue,
    align: "center",
    valign: "mid",
    margin: opts.margin ?? 0,
    fit: opts.fit || "shrink",
  });
}

function addME2026LabelTextRow(slide, pptx, cfg = {}) {
  const x = cfg.x ?? 0.8;
  const y = cfg.y ?? 6.0;
  const rowH = cfg.rowH ?? 0.42;
  const labelW = cfg.labelW ?? 1.55;
  const gap = cfg.gap ?? 0.24;
  const bodyW = cfg.bodyW ?? 9.6;
  const color = cfg.color || ME2026.primaryBlue;
  const fill = cfg.fill || C.white;
  const centerY = y + rowH / 2;
  pill(slide, pptx, cfg.label || "", x, y, labelW, {
    h: rowH,
    textH: cfg.labelTextH,
    size: cfg.labelSize ?? 10,
    bold: cfg.labelBold ?? true,
    color,
    fill,
    line: cfg.line || color,
  });
  const bodyH = cfg.bodyH ?? rowH;
  addText(slide, cfg.body || "", x + labelW + gap, centerY - bodyH / 2, bodyW, bodyH, {
    size: cfg.bodySize ?? 10,
    bold: cfg.bodyBold ?? false,
    color: cfg.bodyColor || C.text,
    margin: cfg.bodyMargin ?? 0,
    valign: "mid",
    fit: cfg.bodyFit || "shrink",
  });
}

function bullet(slide, pptx, text, x, y, w, color = C.blue, size = 12) {
  const h = size >= 12 ? 0.32 : 0.28;
  const dot = 0.07;
  slide.addShape(pptx.ShapeType.ellipse, {
    x,
    y: y + h / 2 - dot / 2,
    w: dot,
    h: dot,
    fill: { color },
    line: { color },
  });
  addText(slide, text, x + 0.22, y, w - 0.22, h, { size, color: C.text, valign: "mid" });
}

function addME2026Footer(slide, pptx, pageNum, opts = {}) {
  const centerY = opts.centerY ?? ((opts.y ?? 7.1) + 0.12);
  const meH = opts.meH ?? 0.1;
  const msH = opts.msH ?? 0.14;
  const dividerH = opts.dividerH ?? 0.19;
  slide.addImage({ path: ME2026_ASSETS.meetExperienceFooterLogo, x: opts.meX ?? 0.62, y: centerY - meH / 2, w: opts.meW ?? 1.15, h: meH });
  slide.addShape(pptx.ShapeType.line, {
    x: opts.dividerX ?? 1.92,
    y: centerY - dividerH / 2,
    w: 0,
    h: dividerH,
    line: { color: "BFBFBF", width: 0.8 },
  });
  slide.addImage({ path: ME2026_ASSETS.meetsocialFooterLogo, x: opts.msX ?? 2.02, y: centerY - msH / 2, w: opts.msW ?? 1.1, h: msH });
  if (pageNum !== undefined && pageNum !== null) {
    const pageH = opts.pageH ?? 0.18;
    addText(slide, String(pageNum), opts.pageX ?? 12.62, centerY - pageH / 2, 0.42, pageH, {
      size: opts.pageSize ?? 10,
      bold: true,
      italic: opts.italic ?? true,
      color: opts.pageColor || "B7B7B7",
      align: "right",
    });
  }
}

function addME2026Cover(slide, pptx, opts = {}) {
  slide.background = { color: opts.background || ME2026.primaryBlue };
  slide.addImage({ path: ME2026_ASSETS.coverBg, x: 0, y: 0, w: SLIDE_W, h: SLIDE_H });
  if (opts.overlay !== false) {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: SLIDE_W,
      h: SLIDE_H,
      fill: { color: ME2026.primaryBlue, transparency: opts.overlayTransparency ?? 28 },
      line: { color: ME2026.primaryBlue, transparency: 100 },
    });
  }
  slide.addImage({ path: ME2026_ASSETS.meetsocialGroupLogo, x: opts.groupLogoX ?? 0.95, y: opts.groupLogoY ?? 1.08, w: opts.groupLogoW ?? 3.78, h: opts.groupLogoH ?? 1.82 });
  addText(slide, opts.title || "WhatsApp驱动\n出海APP用户私域增长", opts.titleX ?? 0.95, opts.titleY ?? 3.08, opts.titleW ?? 7.6, opts.titleH ?? 1.55, {
    size: opts.titleSize ?? 48,
    bold: true,
    color: opts.titleColor || C.white,
    margin: 0,
    breakLine: true,
    fit: "shrink",
  });
  if (opts.subtitle) {
    addText(slide, opts.subtitle, opts.subtitleX ?? 1.0, opts.subtitleY ?? 4.82, opts.subtitleW ?? 7.2, opts.subtitleH ?? 0.34, {
      size: opts.subtitleSize ?? 18,
      bold: true,
      color: opts.subtitleColor || C.white,
      margin: 0,
    });
  }
  slide.addImage({ path: ME2026_ASSETS.meetExperienceCoverLogo, x: opts.meLogoX ?? 1.15, y: opts.meLogoY ?? 6.4, w: opts.meLogoW ?? 3.05, h: opts.meLogoH ?? 0.41 });
}

function addME2026ThankYou(slide, pptx, opts = {}) {
  slide.background = { color: C.white };
  const leftW = opts.leftW ?? 6.18;
  slide.addImage({ path: ME2026_ASSETS.thankYouBg, x: 0, y: 0, w: leftW, h: SLIDE_H });
  if (opts.leftOverlay !== false) {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: leftW,
      h: SLIDE_H,
      fill: { color: ME2026.primaryBlue, transparency: opts.leftOverlayTransparency ?? 35 },
      line: { color: ME2026.primaryBlue, transparency: 100 },
    });
  }
  addText(slide, "Contact Us.", 9.1, 1.26, 2.25, 0.38, {
    size: 24,
    bold: true,
    color: "051D41",
    margin: 0,
    fit: "shrink",
  });
  addText(slide, "联系我们", 11.18, 1.26, 1.55, 0.38, {
    size: 24,
    bold: true,
    color: "051D41",
    margin: 0,
    fit: "shrink",
  });
  addText(slide, "美    国    ·    新    加    坡    ·    日    本    ·    印    度    ·    迪    拜", 7.9, 1.96, 4.72, 0.22, {
    size: 11,
    bold: true,
    color: "051D41",
    margin: 0,
    align: "center",
    fit: "shrink",
  });
  addText(slide, "上    海    ·    北    京    ·    深    圳    ·    广    州    ·    成    都", 7.9, 2.42, 4.72, 0.22, {
    size: 11,
    bold: true,
    color: "051D41",
    margin: 0,
    align: "center",
    fit: "shrink",
  });
  addText(slide, (opts.title || "THANK YOU").replace(" ", "\u00A0"), 1.35, 3.64, 4.5, 0.58, {
    size: opts.titleSize ?? 48,
    bold: true,
    color: C.white,
    margin: 0,
    fit: "shrink",
  });
  addText(slide, opts.tagline || "全球成功，从这里开始", 2.3, 4.5, 2.4, 0.24, {
    size: opts.taglineSize ?? 14,
    bold: true,
    color: C.white,
    margin: 0,
    align: "center",
  });
  slide.addImage({ path: ME2026_ASSETS.thankYouMeetSocialLogo, x: 10.55, y: 3.12, w: 1.95, h: 0.83 });
  slide.addShape(pptx.ShapeType.rect, {
    x: 7.52,
    y: 3.85,
    w: 5.42,
    h: 2.96,
    fill: { color: "F2F2F2" },
    line: { color: "F2F2F2" },
  });
  slide.addImage({ path: ME2026_ASSETS.thankYouOfficialQr, x: 7.82, y: 4.0, w: 1.95, h: 1.95 });
  const contactX = opts.contactX ?? 10.42;
  const contactY = opts.contactY ?? 4.0;
  const contactSize = opts.contactSize ?? 1.95;
  slide.addShape(pptx.ShapeType.rect, {
    x: contactX,
    y: contactY,
    w: contactSize,
    h: contactSize,
    fill: { color: opts.contactFill || C.white },
    line: { color: opts.contactLine || ME2026.softBlue, width: opts.contactLineWidth ?? 1.2 },
  });
  addText(slide, opts.contactPlaceholderText || "黏贴个人联系方式", contactX + 0.16, contactY + contactSize / 2 - 0.18, contactSize - 0.32, 0.36, {
    size: opts.contactPlaceholderSize ?? 14,
    bold: true,
    color: opts.contactPlaceholderColor || ME2026.primaryBlue,
    margin: 0,
    align: "center",
    valign: "mid",
    fit: "shrink",
  });
  addText(slide, "MEET EXPERIENCE", 7.75, 6.2, 2.25, 0.22, {
    size: 14,
    bold: true,
    color: ME2026.primaryBlue,
    margin: 0,
    align: "center",
    fit: "shrink",
  });
  addText(slide, "官方公众号", 7.75, 6.52, 2.25, 0.2, {
    size: 14,
    bold: true,
    color: ME2026.primaryBlue,
    margin: 0,
    align: "center",
  });
  addText(slide, "联系解决方案", 10.42, 6.36, 1.95, 0.22, {
    size: 14,
    bold: true,
    color: ME2026.primaryBlue,
    margin: 0,
    align: "center",
    fit: "shrink",
  });
  if (opts.pageNum !== undefined && opts.pageNum !== null) {
    addText(slide, String(opts.pageNum), 12.55, 7.06, 0.42, 0.18, {
      size: 10,
      bold: true,
      italic: true,
      color: "B7B7B7",
      align: "right",
      margin: 0,
    });
  }
}

function addME2026Index(slide, pptx, items = [], opts = {}) {
  slide.background = { color: C.white };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: opts.leftW ?? 4.32,
    h: SLIDE_H,
    fill: { color: C.white },
    line: { color: C.white },
  });
  slide.addImage({ path: ME2026_ASSETS.indexBg, x: opts.bgX ?? 4.32, y: 0, w: opts.bgW ?? 9.01, h: SLIDE_H });
  if (opts.overlay !== false) {
    slide.addShape(pptx.ShapeType.rect, {
      x: opts.bgX ?? 4.32,
      y: 0,
      w: opts.bgW ?? 9.01,
      h: SLIDE_H,
      fill: { color: ME2026.primaryBlue, transparency: opts.overlayTransparency ?? 18 },
      line: { color: ME2026.primaryBlue, transparency: 100 },
    });
  }
  addText(slide, opts.cnTitle || "目录", 0.55, 3.02, 1.75, 0.62, {
    size: 44,
    bold: true,
    color: C.ink,
    margin: 0,
  });
  addText(slide, opts.enTitle || "INDEX", 0.58, 3.73, 2.2, 0.45, {
    size: 32,
    bold: true,
    color: C.ink,
    margin: 0,
  });
  const rows = items.length ? items : [
    ["01", "MeetSocial介绍"],
    ["02", "泛APP行业WhatsApp解决方案"],
    ["03", "服务案例"],
    ["04", "服务价格"],
  ];
  rows.forEach(([num, label], i) => {
    const y = (opts.firstY ?? 1.55) + i * (opts.rowGap ?? 1.18);
    addText(slide, num, 5.9, y, 0.82, 0.5, {
      size: 28,
      bold: true,
      color: C.white,
      margin: 0,
      align: "center",
    });
    addText(slide, label, 6.95, y + 0.02, 5.8, 0.48, {
      size: i === 1 ? 24 : 26,
      bold: true,
      color: C.white,
      margin: 0,
      fit: "shrink",
    });
  });
  addME2026Footer(slide, pptx, opts.pageNum ?? 2, { pageColor: C.white, ...opts.footer });
}

function addME2026WhiteBase(slide, pptx, title, pageNum, opts = {}) {
  slide.background = { color: C.white };
  addText(slide, title, opts.titleX ?? 0.62, opts.titleY ?? 0.42, opts.titleW ?? 12.0, opts.titleH ?? 0.48, {
    size: opts.titleSize ?? 22,
    bold: true,
    color: opts.titleColor || C.ink,
    margin: 0,
    fit: "shrink",
  });
  if (opts.subtitle) {
    addText(slide, opts.subtitle, opts.subtitleX ?? 0.62, opts.subtitleY ?? 0.86, opts.subtitleW ?? 12.0, opts.subtitleH ?? 0.34, {
      size: opts.subtitleSize ?? 20,
      bold: true,
      color: opts.subtitleColor || ME2026.primaryBlue,
      margin: 0,
      fit: "shrink",
    });
  }
  addME2026Footer(slide, pptx, pageNum, opts.footer || {});
}

function addJourneySolutionMatrix(slide, pptx, opts = {}) {
  const stages = opts.stages || [
    { icon: "Brain", title: "了解\n(Awareness)", pain: "拉新成本高", card: "全渠道引流方案", bullets: ["CTWA广告", "落地页点击即聊", "APP跳转WhatsApp"], actions: ["CTWA广告", "多途径引流方案"] },
    { icon: "Search", title: "兴趣\n(Interest)", pain: "广告点击后流失", card: "潜客培育方案", bullets: ["智能客服首轮接待", "会员/试用权益触达", "活动报名与激活提醒"], actions: ["智能化客服平台", "小商家号运营"] },
    { icon: "Handshake", title: "留资\n(Consultation)", pain: "转化与复购差", card: "用户标签体系", bullets: ["收集关键意向信息", "按行业/需求/行为分层", "精准推荐产品功能与服务方案"], actions: ["CRM数据互通", "Meta 生态营销"] },
    { icon: "BadgeDollarSign", title: "转化\n(Purchase)", pain: "品牌资产难沉淀", card: "LTV提升体系", bullets: ["订阅续费提醒", "交叉销售与升级推荐", "老客召回与激活", "促进长期留存与复购"], actions: ["多场景营销", "社群运营"] },
  ];
  addText(slide, opts.headline || "觅跃科技旗下WhatsApp SaaS产品Meetbot，精准承接高意向用户，实现“问询即转化”增长", 0.62, 0.92, 12.0, 0.34, {
    size: 19,
    bold: true,
    color: ME2026.primaryBlue,
    margin: 0,
    fit: "shrink",
  });
  slide.addShape(pptx.ShapeType.trapezoid, {
    x: 1.55,
    y: 1.48,
    w: 11.0,
    h: 0.55,
    rotate: 180,
    fill: { color: ME2026.softBlue, transparency: 18 },
    line: { color: ME2026.softBlue, transparency: 100 },
  });
  addText(slide, "用户全生命周期私域运营", 5.8, 1.62, 2.2, 0.22, { size: 15, bold: true, color: ME2026.primaryDarkBlue, margin: 0, align: "center" });
  const labelX = 0.55;
  const labelW = 0.78;
  card(slide, pptx, labelX, 2.07, labelW, 0.78, { fill: ME2026.tertiaryLavender, line: ME2026.tertiaryLavender, shadow: false, radius: 0.08 });
  addText(slide, "用户\n旅程", labelX + 0.08, 2.16, labelW - 0.16, 0.58, { size: 16, bold: true, color: C.white, margin: 0, align: "center", breakLine: true });
  card(slide, pptx, labelX, 3.08, labelW, 0.78, { fill: ME2026.secondarySky, line: ME2026.secondarySky, shadow: false, radius: 0.08 });
  addText(slide, "企业\n痛点", labelX + 0.08, 3.17, labelW - 0.16, 0.58, { size: 16, bold: true, color: C.white, margin: 0, align: "center", breakLine: true });
  card(slide, pptx, labelX, 4.02, labelW, 2.55, { fill: ME2026.primaryBlue, line: ME2026.primaryBlue, shadow: false, radius: 0.08 });
  addText(slide, "我们\n的核\n心解\n决方\n案", labelX + 0.11, 4.35, labelW - 0.22, 1.95, { size: 17, bold: true, color: C.white, margin: 0, align: "center", breakLine: true });

  const x0 = 1.72;
  const gap = 0.52;
  const colW = 2.08;
  stages.forEach((stage, i) => {
    const x = x0 + i * (colW + gap);
    const stageCenterY = 2.45;
    iconBadge(slide, pptx, stage.icon, x + 0.36, stageCenterY, 0.42, { color: ME2026.tertiaryLavender, fill: C.white });
    addText(slide, stage.title, x + 0.58, stageCenterY - 0.25, 1.35, 0.5, { size: 15, bold: true, color: C.ink, margin: 0, align: "center", breakLine: true });
    card(slide, pptx, x, 3.11, colW, 0.43, { fill: ME2026.secondarySky, line: ME2026.secondarySky, shadow: false, radius: 0.16 });
    addText(slide, stage.pain, x + 0.1, 3.2, colW - 0.2, 0.18, { size: 14, bold: true, color: C.white, margin: 0, align: "center" });
    addText(slide, stage.pain, x + 0.16, 3.63, colW - 0.32, 0.24, { size: 12, bold: true, color: ME2026.secondarySky, margin: 0, align: "center" });
    card(slide, pptx, x - 0.12, 4.1, colW + 0.24, 2.35, { fill: "F9F9F9", line: "F9F9F9", shadow: false, radius: 0.02 });
    addText(slide, stage.card, x + 0.1, 4.23, colW - 0.2, 0.26, { size: 15, bold: true, color: C.ink, margin: 0, align: "center" });
    stage.bullets.forEach((b, j) => {
      addText(slide, `> ${b}`, x + 0.02, 4.67 + j * 0.25, colW - 0.04, 0.22, { size: 10, color: C.ink, margin: 0, fit: "shrink" });
    });
    stage.actions.forEach((action, j) => {
      card(slide, pptx, x - 0.02, 5.56 + j * 0.5, colW + 0.04, 0.35, { fill: ME2026.primaryBlue, line: ME2026.primaryBlue, shadow: false, radius: 0.04 });
      addText(slide, action, x + 0.04, 5.63 + j * 0.5, colW - 0.08, 0.18, { size: 11, bold: true, color: C.white, align: "center", margin: 0 });
    });
  });
  card(slide, pptx, 1.75, 6.62, 11.0, 0.38, { fill: ME2026.primaryBlue, line: ME2026.primaryBlue, shadow: false, radius: 0.04 });
  addText(slide, "WhatsApp 代运营服务", 1.8, 6.7, 10.9, 0.2, { size: 13, bold: true, color: C.white, align: "center", margin: 0 });
}

function addApiCapabilityFlow(slide, pptx, opts = {}) {
  const leftX = 0.62;
  const leftY = 1.52;
  const leftW = 5.15;
  const leftH = 5.32;
  card(slide, pptx, leftX, leftY, leftW, leftH, {
    fill: "F6FAFF",
    line: "D6DDFB",
    shadow: false,
    radius: 0.08,
  });
  addText(slide, "API 能力范围", leftX + 0.35, leftY + 0.22, leftW - 0.7, 0.28, {
    size: 18,
    bold: true,
    color: ME2026.primaryBlue,
    margin: 0,
    align: "center",
  });

  const sections = opts.sections || [
    { title: "账号管理", items: ["账号信息查询", "号码状态查询", "账号信息修改", "WABA信息查询"], y: leftY + 0.72, h: 1.2 },
    { title: "模板管理", items: ["查询模板", "创建模板", "编辑模板", "删除模板"], y: leftY + 2.05, h: 1.2 },
    { title: "消息管理", items: ["发送消息", "用户消息回传", "媒体上传下载", "消息状态变化", "模板状态变化", "账号状态变化"], y: leftY + 3.38, h: 1.72 },
  ];

  const drawPill = (text, x, y, w) => {
    card(slide, pptx, x, y, w, 0.3, {
      fill: ME2026.primaryBlue,
      line: ME2026.primaryBlue,
      shadow: false,
      radius: 0.04,
    });
    addText(slide, text, x + 0.06, y + 0.06, w - 0.12, 0.17, {
      size: 9,
      bold: true,
      color: C.white,
      align: "center",
      margin: 0,
      fit: "shrink",
    });
  };

  sections.forEach((section) => {
    const sx = leftX + 0.28;
    const sw = leftW - 0.56;
    card(slide, pptx, sx, section.y, sw, section.h, {
      fill: C.white,
      line: "AFC2FF",
      shadow: false,
      radius: 0.08,
    });
    addText(slide, section.title, sx + 0.18, section.y + 0.13, sw - 0.36, 0.22, {
      size: 13,
      bold: true,
      color: C.ink,
      margin: 0,
      align: "center",
    });
    const gap = 0.22;
    const pillW = (sw - 0.5 - gap) / 2;
    const startX = sx + 0.25;
    const startY = section.y + 0.47;
    section.items.forEach((item, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      drawPill(item, startX + col * (pillW + gap), startY + row * 0.38, pillW);
    });
  });

  const connectorY = 4.18;
  slide.addShape(pptx.ShapeType.line, {
    x: leftX + leftW + 0.18,
    y: connectorY,
    w: 0.72,
    h: 0,
    line: { color: ME2026.primaryBlue, width: 2, endArrowType: "triangle" },
  });
  addText(slide, "代理 API", leftX + leftW + 0.05, connectorY - 0.34, 0.98, 0.2, {
    size: 11,
    bold: true,
    color: ME2026.primaryBlue,
    margin: 0,
    align: "center",
  });

  const rightX = 6.85;
  const rightY = 1.52;
  const rightW = 5.86;
  const rightH = 5.32;
  card(slide, pptx, rightX, rightY, rightW, rightH, {
    fill: C.white,
    line: "D6DDFB",
    shadow: false,
    radius: 0.08,
  });
  addText(slide, "API 对接链路", rightX + 0.38, rightY + 0.22, rightW - 0.76, 0.28, {
    size: 18,
    bold: true,
    color: C.ink,
    margin: 0,
    align: "center",
  });
  addText(slide, "WhatsApp 客户", rightX + 1.98, rightY + 0.78, 1.9, 0.22, {
    size: 13,
    bold: true,
    color: C.ink,
    margin: 0,
    align: "center",
  });

  const flowNode = (x, y, w, h, text, options = {}) => {
    card(slide, pptx, x, y, w, h, {
      fill: options.fill || "F2F4F8",
      line: options.line || "DDE4F6",
      shadow: false,
      radius: options.radius || 0.04,
    });
    addText(slide, text, x + 0.06, y + (h - 0.18) / 2, w - 0.12, 0.18, {
      size: options.size || 10,
      bold: options.bold !== false,
      color: options.color || C.ink,
      align: "center",
      margin: 0,
      breakLine: true,
      fit: "shrink",
    });
  };
  const arrow = (x1, y1, x2, y2, color = ME2026.primaryBlue) => {
    slide.addShape(pptx.ShapeType.line, {
      x: x1,
      y: y1,
      w: x2 - x1,
      h: y2 - y1,
      line: { color, width: 1.3, endArrowType: "triangle" },
    });
  };

  const topY = 2.55;
  flowNode(rightX + 0.48, topY, 1.6, 0.34, "消息推送", { size: 10 });
  flowNode(rightX + rightW - 2.08, topY, 1.6, 0.34, "消息发送", { size: 10 });

  const meetbotX = rightX + 0.48;
  const meetbotY = 3.22;
  const meetbotW = rightW - 0.96;
  card(slide, pptx, meetbotX, meetbotY, meetbotW, 0.88, {
    fill: ME2026.primaryBlue,
    line: ME2026.primaryBlue,
    shadow: false,
    radius: 0.1,
  });
  addText(slide, "Meetbot", meetbotX + 0.25, meetbotY + 0.14, meetbotW - 0.5, 0.28, {
    size: 20,
    bold: true,
    color: C.white,
    align: "center",
    margin: 0,
  });
  addText(slide, "Meta 审核 BSP；承接企业 API 调用、Webhook 回调与合规消息触达", meetbotX + 0.26, meetbotY + 0.52, meetbotW - 0.52, 0.18, {
    size: 10,
    bold: true,
    color: C.white,
    align: "center",
    margin: 0,
    fit: "shrink",
  });

  const nodeY = 4.52;
  const nodeW = 1.42;
  flowNode(rightX + 0.54, nodeY, nodeW, 0.36, "API 调用", { size: 10 });
  flowNode(rightX + 2.22, nodeY, nodeW, 0.36, "用户消息", { size: 10 });
  flowNode(rightX + 3.9, nodeY, nodeW, 0.36, "消息状态", { size: 10 });

  const systemY = 5.68;
  card(slide, pptx, rightX + 0.48, systemY, meetbotW, 0.62, {
    fill: "000000",
    line: "000000",
    shadow: false,
    radius: 0.08,
  });
  addText(slide, "企业系统", rightX + 0.72, systemY + 0.18, meetbotW - 0.48, 0.22, {
    size: 18,
    bold: true,
    color: C.white,
    align: "center",
    margin: 0,
  });

  arrow(rightX + 1.28, topY + 0.34, rightX + 1.28, meetbotY);
  arrow(rightX + rightW - 1.28, topY + 0.34, rightX + rightW - 1.28, meetbotY);
  arrow(rightX + 1.25, meetbotY + 0.88, rightX + 1.25, nodeY);
  arrow(rightX + 2.93, meetbotY + 0.88, rightX + 2.93, nodeY);
  arrow(rightX + 4.61, meetbotY + 0.88, rightX + 4.61, nodeY);
  arrow(rightX + 1.25, nodeY + 0.36, rightX + 1.25, systemY);
  arrow(rightX + 2.93, nodeY + 0.36, rightX + 2.93, systemY);
  arrow(rightX + 4.61, nodeY + 0.36, rightX + 4.61, systemY);
}

function addME2026ConsultingTimeline(slide, pptx, cfg = {}) {
  slide.background = { color: C.white };
  const titleLines = cfg.titleLines || ["时间轴", "标注日期"];
  addText(slide, titleLines[0], cfg.titleX ?? 0.75, cfg.titleY ?? 0.62, 2.2, 0.36, {
    size: cfg.titleSize ?? 25,
    bold: true,
    color: cfg.titleColor || "000000",
    margin: 0,
    fit: "shrink",
  });
  addText(slide, titleLines[1] || "", cfg.titleX ?? 0.75, (cfg.titleY ?? 0.62) + 0.38, 2.45, 0.36, {
    size: cfg.titleSize ?? 25,
    bold: true,
    color: cfg.subtitleColor || ME2026.midGray,
    margin: 0,
    fit: "shrink",
  });

  const axisY = cfg.axisY ?? 4.14;
  const axisX = cfg.axisX ?? 1.05;
  const axisW = cfg.axisW ?? 11.25;
  slide.addShape(pptx.ShapeType.line, {
    x: axisX,
    y: axisY,
    w: axisW,
    h: 0,
    line: { color: cfg.axisColor || "BBBCBC", width: 1.35 },
  });

  const monthNodes = cfg.monthNodes || [
    { x: 2.72, label: "六月", color: ME2026.tertiaryDeepTeal },
    { x: 6.35, label: "七月", color: ME2026.primaryBlue },
    { x: 9.92, label: "八月", color: ME2026.secondaryPurple },
  ];
  monthNodes.forEach((node) => {
    slide.addShape(pptx.ShapeType.ellipse, {
      x: node.x - 0.37,
      y: axisY - 0.37,
      w: 0.74,
      h: 0.74,
      fill: { color: node.color },
      line: { color: node.color },
    });
    addText(slide, node.label, node.x - 0.55, axisY + 0.58, 1.1, 0.22, {
      size: 16,
      bold: true,
      color: node.color,
      align: "center",
      margin: 0,
      fit: "shrink",
    });
  });

  const events = cfg.events || [
    { x: 1.38, day: "26", text: "虚拟文字，虚拟文字阅读\n参考，虚拟文字阅读参考", above: true, color: ME2026.tertiaryDeepTeal, lineH: 1.62 },
    { x: 3.82, day: "04", text: "虚拟文字，虚拟文字阅读\n参考，虚拟文字阅读参考", above: true, color: ME2026.tertiaryDeepTeal, lineH: 2.18 },
    { x: 4.48, day: "15", text: "虚拟文字，虚拟文字阅读\n参考，虚拟文字阅读参考", above: false, color: ME2026.tertiaryDeepTeal, lineH: 2.18 },
    { x: 5.05, day: "22", text: "虚拟文字，虚拟文字阅读\n参考，虚拟文字阅读参考", above: true, color: ME2026.tertiaryDeepTeal, lineH: 1.62 },
    { x: 7.72, day: "16", text: "虚拟文字，虚拟文字阅读\n参考，虚拟文字阅读参考", above: true, color: ME2026.primaryBlue, lineH: 1.62 },
    { x: 8.22, day: "13", text: "虚拟文字，虚拟文字阅读\n参考，虚拟文字阅读参考", above: false, color: ME2026.primaryBlue, lineH: 2.18 },
    { x: 9.08, day: "23", text: "虚拟文字，虚拟文字阅读\n参考，虚拟文字阅读参考", above: true, color: ME2026.primaryBlue, lineH: 2.18 },
    { x: 11.0, day: "5", text: "虚拟文字，虚拟文字阅读\n参考，虚拟文字阅读参考", above: true, color: ME2026.tertiaryDeepTeal, lineH: 1.62 },
  ];
  events.forEach((event) => {
    slide.addShape(pptx.ShapeType.ellipse, {
      x: event.x - 0.09,
      y: axisY - 0.09,
      w: 0.18,
      h: 0.18,
      fill: { color: event.color },
      line: { color: event.color },
    });
    if (event.above) {
      slide.addShape(pptx.ShapeType.line, {
        x: event.x,
        y: axisY,
        w: 0,
        h: -event.lineH,
        line: { color: event.color, width: 1.35 },
      });
      addText(slide, event.day, event.x + 0.11, axisY - event.lineH - 0.06, 0.42, 0.22, {
        size: 14,
        bold: true,
        color: event.color,
        margin: 0,
      });
      addText(slide, event.text, event.x + 0.11, axisY - event.lineH + 0.18, 1.42, 0.44, {
        size: 9,
        bold: true,
        color: event.color,
        margin: 0,
        breakLine: true,
        fit: "shrink",
      });
    } else {
      slide.addShape(pptx.ShapeType.line, {
        x: event.x,
        y: axisY,
        w: 0,
        h: event.lineH,
        line: { color: event.color, width: 1.35 },
      });
      addText(slide, event.day, event.x + 0.08, axisY + event.lineH - 0.72, 0.42, 0.22, {
        size: 14,
        bold: true,
        color: event.color,
        margin: 0,
      });
      addText(slide, event.text, event.x + 0.08, axisY + event.lineH - 0.5, 1.46, 0.44, {
        size: 9,
        bold: true,
        color: event.color,
        margin: 0,
        breakLine: true,
        fit: "shrink",
      });
    }
  });

  if (cfg.pageNum !== undefined && cfg.pageNum !== null) {
    addME2026Footer(slide, pptx, cfg.pageNum);
  }
}

function addME2026ConsultingIconGrid(slide, pptx, cfg = {}) {
  const items = cfg.items || [
    { icon: "consult-target", title: "目标定义", body: "明确增长目标、成功指标和关键约束。", color: ME2026.primaryBlue },
    { icon: "consult-search", title: "问题诊断", body: "拆解现状链路，识别影响转化的关键断点。", color: ME2026.tertiaryDeepTeal },
    { icon: "consult-grid", title: "结构化拆解", body: "按市场、渠道、客户旅程和组织角色建立分析矩阵。", color: ME2026.primarySteel },
    { icon: "consult-dashboard", title: "数据看板", body: "把过程指标、结果指标和异常信号放入同一观察面。", color: ME2026.primaryBlue },
    { icon: "consult-gear", title: "机制设计", body: "定义运营节奏、协作边界、工具规则和复盘动作。", color: ME2026.secondaryPurple },
    { icon: "consult-verified", title: "落地核验", body: "用样本、日志、SLA 和可复盘材料确认真实效果。", color: ME2026.tertiaryDeepTeal },
  ];
  const cols = cfg.cols ?? 3;
  const x0 = cfg.x ?? 0.9;
  const y0 = cfg.y ?? 1.55;
  const colW = cfg.colW ?? 3.75;
  const rowH = cfg.rowH ?? 1.55;
  const gapX = cfg.gapX ?? 0.42;
  const gapY = cfg.gapY ?? 0.34;
  items.forEach((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = x0 + col * (colW + gapX);
    const y = y0 + row * (rowH + gapY);
    const color = item.color || resolveME2026Icon(item.icon).color || ME2026.primaryBlue;
    slide.addShape(pptx.ShapeType.line, {
      x,
      y: y + rowH,
      w: colW,
      h: 0,
      line: { color: item.line || "E1E6F3", width: 1 },
    });
    addME2026IconBadge(slide, pptx, item.icon, x + 0.42, y + 0.42, 0.58, {
      color,
      fill: item.fill || C.white,
      line: color,
      pad: item.iconPad ?? 0.1,
    });
    addText(slide, item.title, x + 0.88, y + 0.18, colW - 1.0, 0.28, {
      size: cfg.titleSize ?? 14,
      bold: true,
      color,
      margin: 0,
      valign: "mid",
      fit: "shrink",
    });
    addText(slide, item.body, x + 0.88, y + 0.6, colW - 1.05, 0.54, {
      size: cfg.bodySize ?? 10,
      color: cfg.bodyColor || C.text,
      margin: 0,
      valign: "top",
      fit: "shrink",
    });
  });
}

function addME2026ConsultingProcessRows(slide, pptx, cfg = {}) {
  const rows = cfg.rows || [
    { icon: "consult-calendar", title: "阶段排期", body: "把调研、方案、验证和复盘切成明确窗口，减少跨团队等待。", color: ME2026.tertiaryLavender },
    { icon: "consult-org", title: "角色协同", body: "明确业务、产品、投放、数据和客服的责任边界与交付物。", color: ME2026.primarySteel },
    { icon: "consult-line-chart", title: "指标牵引", body: "围绕触达、互动、转化、留存四类指标建立统一复盘语言。", color: ME2026.primaryBlue },
    { icon: "consult-shield", title: "风险控制", body: "把合规、授权、数据安全和素材版权前置到方案设计阶段。", color: ME2026.tertiaryDeepTeal },
  ];
  const x = cfg.x ?? 1.0;
  const y0 = cfg.y ?? 1.55;
  const w = cfg.w ?? 11.35;
  const rowH = cfg.rowH ?? 1.05;
  const gap = cfg.gap ?? 0.22;
  rows.forEach((row, i) => {
    const y = y0 + i * (rowH + gap);
    const color = row.color || ME2026.primaryBlue;
    card(slide, pptx, x, y, w, rowH, {
      fill: i % 2 ? "F8FBFF" : C.white,
      line: "DCE5F4",
      shadow: false,
      radius: 0.04,
    });
    const centerY = y + rowH / 2;
    addText(slide, String(i + 1).padStart(2, "0"), x + 0.28, centerY - 0.14, 0.42, 0.28, {
      size: 14,
      bold: true,
      color,
      margin: 0,
      align: "center",
    });
    addME2026IconBadge(slide, pptx, row.icon, x + 1.08, centerY, 0.52, {
      color,
      fill: C.white,
      line: color,
      pad: row.iconPad ?? 0.1,
    });
    addText(slide, row.title, x + 1.58, centerY - 0.18, 1.55, 0.36, {
      size: 15,
      bold: true,
      color,
      margin: 0,
      valign: "mid",
      fit: "shrink",
    });
    addText(slide, row.body, x + 3.35, centerY - 0.2, w - 3.72, 0.4, {
      size: 11,
      color: C.text,
      margin: 0,
      valign: "mid",
      fit: "shrink",
    });
  });
}

module.exports = {
  C,
  ME2026,
  ME2026_ASSETS,
  ME2026_DELOITTE_ICON_DIR,
  ME2026_ICON_LIBRARY,
  FONT,
  FONT_FALLBACK,
  SLIDE_W,
  SLIDE_H,
  createPresentation,
  assertPalette,
  softShadow,
  addText,
  card,
  brandStripe,
  topTitleCompact,
  footer,
  numberedCircle,
  prepareIconCache,
  prepareME2026IconCache,
  addIcon,
  iconCircle,
  iconBadge,
  iconTextRow,
  resolveME2026Icon,
  addME2026IconBadge,
  addME2026IconTitleCard,
  addME2026StackedIconRow,
  pill,
  addME2026LabelTextRow,
  bullet,
  addME2026Footer,
  addME2026Cover,
  addME2026ThankYou,
  addME2026Index,
  addME2026WhiteBase,
  addJourneySolutionMatrix,
  addApiCapabilityFlow,
  addME2026ConsultingTimeline,
  addME2026ConsultingIconGrid,
  addME2026ConsultingProcessRows,
};
