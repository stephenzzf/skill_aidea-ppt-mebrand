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

const ME2026_LAYOUT = {
  contentTopY: 1.55,
  tableAfterGap: 0.34,
  tableNoteGap: 0.30,
  cardPad: 0.28,
  cardTextInset: 0.10,
  iconCardTitleBodyGap: 0.22,
  minTextBoxH: 0.18,
  minComponentH: {
    iconTitleCard: 1.0,
    stackedIconRow: 0.86,
    labelTextRow: 0.54,
    tableFollowModuleGap: 0.30,
  },
  footer: {
    logoX: 0.78,
    logoY: 7.05,
    logoH: 0.15,
    pageNumX: 12.55,
    pageNumY: 7.04,
  },
};

const ME2026_TOKENS = {
  colors: ME2026,
  baseColors: C,
  font: {
    preferred: "Source Han Sans CN",
    fallback: "Arial",
    title: 24,
    subtitle: 18,
    cardTitle: 16,
    body: 11,
    note: 8,
  },
  layout: ME2026_LAYOUT,
  radius: {
    card: 0.08,
    pill: 0.18,
  },
  shadow: {
    softOpacity: 0.08,
    maxOpacity: 0.12,
  },
};

const FONT = "Source Han Sans CN";
const FONT_FALLBACK = "Arial";
const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const ME2026_ASSET_DIR = path.join(__dirname, "..", "assets", "me-2026-app");
const ME2026_DELOITTE_ICON_DIR = path.join(ME2026_ASSET_DIR, "deloitte-white-icons");
const ME2026_ASSETS = {
  coverBg: path.join(ME2026_ASSET_DIR, "cover-bg.jpg"),
  coverGlassBg: path.join(ME2026_ASSET_DIR, "cover-glass-bg.png"),
  indexBg: path.join(ME2026_ASSET_DIR, "index-bg.jpg"),
  meetExperienceBilingualLogo: path.join(ME2026_ASSET_DIR, "meet-experience-bilingual.png"),
  meetExperienceBilingualReverseLogo: path.join(ME2026_ASSET_DIR, "meet-experience-bilingual-reverse.png"),
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
  diligence: { icon: "SearchCheck", color: ME2026.primaryBlue, fill: "EAF4FF", tone: "blue", label: "尽调" },
  growth: { icon: "TrendingUp", color: ME2026.primaryBlue, fill: "EAF4FF", label: "增长" },
  media: { icon: "Megaphone", color: ME2026.secondaryPurple, fill: "F6ECFF", label: "媒体" },
  automation: { icon: "Bot", color: ME2026.secondaryPurple, fill: "F6ECFF", label: "自动化" },
  conversion: { icon: "BadgeDollarSign", color: ME2026.primaryBlue, fill: "EAF4FF", label: "转化" },
  retention: { icon: "RefreshCcw", color: ME2026.primaryBlue, fill: "EAF4FF", tone: "blue", label: "留存" },
  pricing: { icon: "CircleDollarSign", color: ME2026.primaryBlue, fill: "EAF4FF", tone: "blue", label: "价格" },
  journey: { icon: "Route", color: ME2026.secondaryPurple, fill: "F6ECFF", tone: "purple", label: "旅程" },
  crm: { icon: "Users", color: ME2026.primaryBlue, fill: "EAF4FF", tone: "blue", label: "CRM" },
  api: { icon: "Network", color: ME2026.primaryDarkBlue, fill: "EAF4FF", label: "API" },
  operations: { icon: "Workflow", color: ME2026.secondaryPurple, fill: "F6ECFF", label: "运营" },
  compliance: { icon: "ShieldCheck", color: ME2026.primaryBlue, fill: "EAF4FF", tone: "blue", label: "合规" },
  service: { icon: "Handshake", color: ME2026.primaryBlue, fill: "EAF4FF", label: "服务" },
  company: { icon: "Building2", color: ME2026.primaryBlue, fill: "EAF4FF", tone: "blue", label: "公司" },
  globalization: { icon: "Globe", color: ME2026.primaryBlue, fill: "EAF4FF", label: "全球化" },
  insight: { icon: "FileSearch", color: ME2026.primaryBlue, fill: "EAF4FF", tone: "blue", label: "洞察" },
  capability: { icon: "Layers", color: ME2026.secondaryPurple, fill: "F6ECFF", label: "能力" },
  message: { icon: "MessageCircle", color: ME2026.primaryBlue, fill: "EAF4FF", label: "消息" },
  data: { icon: "Database", color: ME2026.primaryBlue, fill: "EAF4FF", tone: "blue", label: "数据" },
  review: { icon: "ClipboardCheck", color: ME2026.secondaryPurple, fill: "F6ECFF", tone: "purple", label: "复核" },
  publish: { icon: "Send", color: ME2026.primaryBlue, fill: "EAF4FF", tone: "blue", label: "发布" },
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
const ME2026_ICON_TONES = {
  blue: { color: ME2026.primaryBlue, fill: "EAF2FF" },
  purple: { color: ME2026.secondaryPurple, fill: "F6EDFF" },
};
const ME2026_ICON_APPEARANCES = new Set(["bare", "circle", "rounded-square"]);
const ME2026_LOGO_ASPECT = 3838 / 1068;

function normalizeIconStrokeWidth(strokeWidth = 2.45) {
  const value = Number(strokeWidth);
  if (!Number.isFinite(value) || value <= 0 || value > 8) throw new Error(`Invalid icon strokeWidth: ${strokeWidth}`);
  return Number(value.toFixed(3));
}

function normalizeIconColor(color = ME2026.primaryBlue) {
  const normalized = String(color).replace(/^#/, "").toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(normalized)) throw new Error(`Invalid icon color: ${color}`);
  return normalized;
}

function iconCacheKey(iconName, color, strokeWidth) {
  return `${iconName}:${normalizeIconColor(color)}:${normalizeIconStrokeWidth(strokeWidth)}`;
}

function inferIconTone(color) {
  return normalizeIconColor(color) === normalizeIconColor(ME2026.secondaryPurple) ? "purple" : "blue";
}

function getME2026IconTone(tone) {
  if (!Object.hasOwn(ME2026_ICON_TONES, tone)) throw new Error(`Unknown ME2026 icon tone: ${tone}. Use blue or purple.`);
  return { ...ME2026_ICON_TONES[tone] };
}

function validateIconAppearance(appearance = "circle") {
  if (!ME2026_ICON_APPEARANCES.has(appearance)) throw new Error(`Unknown ME2026 icon appearance: ${appearance}. Use bare, circle, or rounded-square.`);
  return appearance;
}

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
  return require('./pptx_compatibility.cjs').installCompatibility(pptx);
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
    ...(opts.autoShrink === false ? {} : { fit: opts.fit || "shrink" }),
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

async function prepareIconCache(iconNames = [], colors = [C.blue], strokeWidth = 2.45) {
  const names = [...new Set(iconNames.length ? iconNames : ["CircleHelp"])];
  const colorList = [...new Set(colors.map(normalizeIconColor))];
  const weight = normalizeIconStrokeWidth(strokeWidth);
  for (const iconName of names) {
    for (const color of colorList) {
      const key = iconCacheKey(iconName, color, weight);
      if (iconCache.has(key)) continue;
      const svg = lucideSvg(iconName, color, weight);
      const png = await sharp(Buffer.from(svg)).resize(192, 192).png().toBuffer();
      iconCache.set(key, `data:image/png;base64,${png.toString("base64")}`);
    }
  }
}

function addIcon(slide, iconName, x, y, w, h, color = C.blue, strokeWidth = 2.45, opts = {}) {
  const key = iconCacheKey(iconName, color, strokeWidth);
  const data = iconCache.get(key);
  if (!data) throw new Error(`Icon not prepared: ${key}`);
  const semanticKey = opts.semanticKey || iconName;
  slide.addImage({
    data,
    x,
    y,
    w,
    h,
    objectName: `ME2026_ICON:${semanticKey}`,
    altText: opts.altText || opts.label || semanticKey,
  });
}

function iconContainer(slide, pptx, appearance, cx, cy, d, fill, opts = {}) {
  const shapeType = appearance === "circle" ? pptx.ShapeType.ellipse : pptx.ShapeType.roundRect;
  slide.addShape(shapeType, {
    x: cx - d / 2,
    y: cy - d / 2,
    w: d,
    h: d,
    fill: { color: normalizeIconColor(fill) },
    line: { color: normalizeIconColor(opts.lineColor || fill), transparency: opts.lineTransparency ?? 40, width: opts.lineWidth ?? 0.6 },
    objectName: opts.containerName || "ME2026_ICON_CONTAINER",
  });
}

function addIconGlyph(slide, item, cx, cy, d, opts = {}) {
  const appearance = validateIconAppearance(opts.appearance);
  const glyphScale = opts.glyphScale ?? (appearance === "bare" ? 0.88 : 0.7);
  if (!Number.isFinite(glyphScale) || glyphScale <= 0 || glyphScale > 1) throw new Error(`Invalid icon glyphScale: ${glyphScale}; expected a value in (0, 1].`);
  const frame = d * glyphScale;
  addIcon(slide, item.icon, cx - frame / 2, cy - frame / 2, frame, frame, item.color, opts.strokeWidth ?? 2.45, {
    semanticKey: opts.semanticKey,
    altText: item.label,
  });
}

function iconCircle(slide, pptx, iconName, x, y, d, color = C.blue, fill = C.blueBg, opts = {}) {
  slide.addShape(pptx.ShapeType.ellipse, {
    x,
    y,
    w: d,
    h: d,
    fill: { color: normalizeIconColor(fill) },
    line: { color: opts.lineColor || C.divider, transparency: opts.lineTransparency ?? 15 },
    objectName: opts.containerName || "ME2026_ICON_CONTAINER",
  });
  const glyphScale = opts.glyphScale ?? 0.7;
  if (!Number.isFinite(glyphScale) || glyphScale <= 0 || glyphScale > 1) throw new Error(`Invalid icon glyphScale: ${glyphScale}; expected a value in (0, 1].`);
  const frame = d * glyphScale;
  addIcon(slide, iconName, x + (d - frame) / 2, y + (d - frame) / 2, frame, frame, color, opts.strokeWidth ?? 2.45, {
    semanticKey: opts.semanticKey || iconName,
    altText: opts.label || opts.semanticKey || iconName,
  });
}

function iconBadge(slide, pptx, iconName, cx, cy, d = 0.64, opts = {}) {
  const appearance = validateIconAppearance(opts.appearance);
  const tone = opts.tone || inferIconTone(opts.color || C.blue);
  const toneStyle = getME2026IconTone(tone);
  const color = normalizeIconColor(opts.color ?? toneStyle.color);
  const fill = normalizeIconColor(opts.fill ?? toneStyle.fill);
  const item = { icon: iconName, color, fill, label: opts.label || opts.semanticKey || iconName };
  if (appearance !== "bare") iconContainer(slide, pptx, appearance, cx, cy, d, fill, opts);
  addIconGlyph(slide, item, cx, cy, d, { ...opts, appearance, semanticKey: opts.semanticKey || iconName });
}

function iconTextRow(slide, pptx, iconName, x, centerY, w, opts = {}) {
  const d = opts.iconD ?? 0.54;
  const toneStyle = opts.iconTone ? getME2026IconTone(opts.iconTone) : null;
  const color = opts.color ?? toneStyle?.color ?? C.blue;
  const fill = opts.fill ?? toneStyle?.fill ?? C.blueBg;
  iconBadge(slide, pptx, iconName, x + d / 2, centerY, d, {
    color,
    fill,
    appearance: opts.iconAppearance,
    tone: opts.iconTone,
    glyphScale: opts.iconScale,
    strokeWidth: opts.iconStrokeWidth,
    semanticKey: opts.semanticKey || iconName,
    label: opts.iconLabel || opts.title || iconName,
  });
  const titleX = x + d + (opts.gap ?? 0.22);
  const titleW = opts.titleW ?? 1.1;
  const titleH = opts.titleH ?? 0.28;
  addText(slide, opts.title || "", titleX, centerY - titleH / 2, titleW, titleH, {
    size: opts.titleSize ?? 13,
    bold: true,
    color,
    margin: 0,
    valign: "mid",
    autoShrink: opts.autoShrink,
  });
  if (opts.body) {
    const bodyX = titleX + titleW + (opts.bodyGap ?? 0.24);
    addText(slide, opts.body, bodyX, centerY - (opts.bodyH ?? 0.36) / 2, w - (bodyX - x), opts.bodyH ?? 0.36, {
      size: opts.bodySize ?? 11,
      color: opts.bodyColor || C.text,
      margin: 0,
      valign: "mid",
      fit: "shrink",
      autoShrink: opts.autoShrink,
    });
  }
}

function resolveME2026Icon(keyOrIcon) {
  if (!keyOrIcon) return resolveME2026Icon("insight");
  if (ME2026_ICON_LIBRARY[keyOrIcon]) {
    const item = { ...ME2026_ICON_LIBRARY[keyOrIcon] };
    return { ...item, tone: item.tone || inferIconTone(item.color || ME2026.primaryBlue) };
  }
  return {
    icon: lucide[keyOrIcon] ? keyOrIcon : "CircleHelp",
    color: ME2026.primaryBlue,
    fill: ME2026_ICON_TONES.blue.fill,
    tone: "blue",
    label: keyOrIcon,
  };
}

async function prepareME2026IconCache(keys = Object.keys(ME2026_ICON_LIBRARY), extraColors = [], options = {}) {
  const opts = typeof options === "number" ? { strokeWidth: options } : (options || {});
  const resolved = keys.map(resolveME2026Icon);
  const names = resolved.filter((item) => !item.asset).map((item) => item.icon);
  const colors = [
    ...resolved.map((item) => item.color),
    ME2026_ICON_TONES.blue.color,
    ME2026_ICON_TONES.purple.color,
    ME2026.primaryDarkBlue,
    ME2026.primarySteel,
    ME2026.tertiaryDeepTeal,
    ME2026.tertiaryLavender,
    ME2026.tertiaryAmber,
    C.blue,
    C.purple,
    ...extraColors,
  ];
  const weights = [...new Set([2.45, 2.25, opts.strokeWidth].filter((value) => value !== undefined).map(normalizeIconStrokeWidth))];
  if (names.length) {
    for (const weight of weights) await prepareIconCache(names, colors, weight);
  }
}

function addME2026IconBadge(slide, pptx, keyOrIcon, cx, cy, d = 0.68, opts = {}) {
  const semanticKey = opts.semanticKey || (typeof keyOrIcon === "string" ? keyOrIcon : keyOrIcon?.icon);
  const resolved = resolveME2026Icon(keyOrIcon);
  const item = { ...resolved, ...opts };
  const appearance = validateIconAppearance(item.appearance);
  const tone = item.tone || resolved.tone || inferIconTone(item.color || ME2026.primaryBlue);
  const toneStyle = getME2026IconTone(tone);
  const color = normalizeIconColor(opts.color ?? (opts.tone ? toneStyle.color : resolved.color ?? toneStyle.color));
  const fill = normalizeIconColor(opts.fill ?? opts.iconFill ?? (opts.tone ? toneStyle.fill : resolved.fill ?? toneStyle.fill));
  if (item.asset) {
    if (appearance !== "bare") {
      const shapeType = appearance === "circle" ? pptx.ShapeType.ellipse : pptx.ShapeType.roundRect;
      slide.addShape(shapeType, {
        x: cx - d / 2,
        y: cy - d / 2,
        w: d,
        h: d,
        fill: { color: normalizeIconColor(opts.fill ?? opts.iconFill ?? item.fill ?? C.white) },
        line: { color: normalizeIconColor(item.line || item.color || ME2026.primaryBlue), transparency: item.lineTransparency ?? 0, width: item.lineWidth ?? 1 },
        objectName: item.containerName || "ME2026_ICON_CONTAINER",
      });
    }
    const glyphScale = item.glyphScale ?? (appearance === "bare" ? 0.88 : 0.7);
    if (!Number.isFinite(glyphScale) || glyphScale <= 0 || glyphScale > 1) throw new Error(`Invalid icon glyphScale: ${glyphScale}; expected a value in (0, 1].`);
    const size = d * glyphScale;
    slide.addImage({ path: item.asset, x: cx - size / 2, y: cy - size / 2, w: size, h: size, objectName: `ME2026_ICON:${semanticKey}`, altText: item.label || semanticKey });
    return;
  }
  iconBadge(slide, pptx, item.icon, cx, cy, d, {
    color,
    fill,
    tone,
    appearance,
    glyphScale: opts.glyphScale,
    strokeWidth: opts.strokeWidth ?? 2.25,
    lineColor: opts.lineColor,
    lineTransparency: opts.lineTransparency,
    lineWidth: opts.lineWidth,
    containerName: opts.containerName,
    semanticKey,
    label: item.label,
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
  const titleBottomOffset = rowCenterY - y + titleH / 2;
  const iconKey = cfg.icon || cfg.iconKey || "insight";
  const icon = resolveME2026Icon(iconKey);
  const iconTone = cfg.iconTone || (cfg.titleColor || cfg.color ? inferIconTone(cfg.titleColor || cfg.color) : icon.tone);
  const toneStyle = getME2026IconTone(iconTone);
  const accent = cfg.color || toneStyle.color;
  const fill = cfg.iconFill || toneStyle.fill;

  card(slide, pptx, x, y, w, h, {
    fill: cfg.fill || C.white,
    line: cfg.line || accent,
    lineWidth: cfg.lineWidth ?? 1,
    shadow: cfg.shadow,
    shadowOpacity: cfg.shadowOpacity ?? 0.05,
    radius: cfg.radius ?? 0.08,
  });
  addME2026IconBadge(slide, pptx, iconKey, iconX + iconD / 2, rowCenterY, iconD, {
    color: cfg.iconColor || cfg.color || toneStyle.color,
    fill,
    tone: iconTone,
    appearance: cfg.iconAppearance,
    glyphScale: cfg.iconScale,
    strokeWidth: cfg.iconStrokeWidth ?? 2.25,
  });
  addText(slide, cfg.title || icon.label, titleX, rowCenterY - titleH / 2, cfg.titleW ?? w - (titleX - x) - 0.28, titleH, {
    size: cfg.titleSize ?? 16,
    bold: true,
    color: cfg.titleColor || accent,
    margin: 0,
    valign: "mid",
    fit: "shrink",
    autoShrink: cfg.autoShrink,
  });
  if (cfg.body) {
    const defaultBodyY = Math.min(
      Math.max(ME2026_LAYOUT.minTextBoxH, h - ME2026_LAYOUT.cardTextInset - ME2026_LAYOUT.minTextBoxH),
      titleBottomOffset + (cfg.titleBodyGap ?? ME2026_LAYOUT.iconCardTitleBodyGap)
    );
    const bodyY = cfg.bodyY ?? defaultBodyY;
    const bodyX = cfg.bodyX ?? ME2026_LAYOUT.cardPad;
    const bodyPadX = cfg.bodyPadX ?? bodyX * 2;
    const bodyH = cfg.bodyH ?? Math.max(ME2026_LAYOUT.minTextBoxH, h - bodyY - (cfg.bodyBottomPad ?? ME2026_LAYOUT.cardTextInset));
    addText(slide, cfg.body, x + bodyX, y + bodyY, w - bodyPadX, bodyH, {
      size: cfg.bodySize ?? 11,
      color: cfg.bodyColor || C.text,
      margin: 0,
      fit: "shrink",
      autoShrink: cfg.autoShrink,
      valign: cfg.bodyValign || "top",
      breakLine: cfg.bodyBreakLine,
    });
  }
  if (Array.isArray(cfg.bullets)) {
    const bulletY = y + (cfg.bulletY ?? 1.08);
    cfg.bullets.forEach((text, i) => {
      bullet(slide, pptx, text, x + (cfg.bulletX ?? 0.36), bulletY + i * (cfg.bulletGap ?? 0.34), w - (cfg.bulletWPad ?? 0.72), accent, cfg.bulletSize ?? 10, { autoShrink: cfg.autoShrink });
    });
  }
}

function addME2026StackedIconRow(slide, pptx, cfg = {}) {
  const x = cfg.x ?? 0.8;
  const y = cfg.y ?? 1.55;
  const w = cfg.w ?? 3.4;
  const h = cfg.h ?? 0.88;
  const iconKey = cfg.icon || cfg.iconKey || "insight";
  const icon = resolveME2026Icon(iconKey);
  const iconTone = cfg.iconTone || (cfg.titleColor || cfg.color ? inferIconTone(cfg.titleColor || cfg.color) : icon.tone);
  const toneStyle = getME2026IconTone(iconTone);
  const color = cfg.color || toneStyle.color;
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
  addME2026IconBadge(slide, pptx, iconKey, x + padX + iconD / 2, centerY, iconD, {
    color: cfg.iconColor || cfg.color || toneStyle.color,
    fill: cfg.iconFill || toneStyle.fill,
    tone: iconTone,
    appearance: cfg.iconAppearance,
    glyphScale: cfg.iconScale,
    strokeWidth: cfg.iconStrokeWidth ?? 2.25,
  });
  addText(slide, cfg.title || "", textX, titleY, textW, titleH, {
    size: cfg.titleSize ?? 12,
    bold: true,
    color: cfg.titleColor || color,
    margin: 0,
    valign: "mid",
    fit: "shrink",
    autoShrink: cfg.autoShrink,
  });
  if (cfg.body) {
    addText(slide, cfg.body, textX, bodyY, textW, bodyH, {
      size: cfg.bodySize ?? 9,
      color: cfg.bodyColor || C.text,
      margin: 0,
      valign: "top",
      fit: "shrink",
      autoShrink: cfg.autoShrink,
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
    autoShrink: opts.autoShrink,
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
    autoShrink: cfg.autoShrink,
  });
  const bodyH = cfg.bodyH ?? rowH;
  addText(slide, cfg.body || "", x + labelW + gap, centerY - bodyH / 2, bodyW, bodyH, {
    size: cfg.bodySize ?? 10,
    bold: cfg.bodyBold ?? false,
    color: cfg.bodyColor || C.text,
    margin: cfg.bodyMargin ?? 0,
    valign: "mid",
    fit: cfg.bodyFit || "shrink",
    autoShrink: cfg.autoShrink,
  });
}

function bullet(slide, pptx, text, x, y, w, color = C.blue, size = 12, opts = {}) {
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
  addText(slide, text, x + 0.22, y, w - 0.22, h, { size, color: C.text, valign: "mid", autoShrink: opts.autoShrink });
}

function addME2026Footer(slide, pptx, pageNum, opts = {}) {
  const brandVariant = opts.brandVariant ?? "legacy";
  if (brandVariant !== "legacy" && brandVariant !== "bilingual") {
    throw new RangeError(`addME2026Footer brandVariant must be 'legacy' or 'bilingual'; received '${brandVariant}'.`);
  }
  const centerY = opts.centerY ?? (opts.y !== undefined ? opts.y + 0.12 : brandVariant === "bilingual" ? 7.13 : 7.22);
  if (brandVariant === "bilingual") {
    const maxW = opts.logoW;
    const maxH = opts.logoH ?? (maxW === undefined ? 0.36 : undefined) ?? 0.36;
    const logoW = Math.min(maxW ?? maxH * ME2026_LOGO_ASPECT, maxH * ME2026_LOGO_ASPECT);
    const logoH = logoW / ME2026_LOGO_ASPECT;
    const logoX = opts.logoX ?? 0.62;
    slide.addImage({
      path: ME2026_ASSETS.meetExperienceBilingualLogo,
      x: logoX,
      y: centerY - logoH / 2,
      w: logoW,
      h: logoH,
      objectName: "ME2026_BRAND_LOGO",
      altText: "觅跃科技 Meet Experience",
    });
  } else {
    const meH = opts.meH ?? 0.1;
    const dividerH = opts.dividerH ?? 0.19;
    const groupH = opts.msH ?? opts.groupH ?? 0.14;
    slide.addImage({
      path: ME2026_ASSETS.meetExperienceFooterLogo,
      x: opts.meX ?? 0.62,
      y: centerY - meH / 2,
      w: opts.meW ?? 1.15,
      h: meH,
      objectName: "ME2026_FOOTER_ME_LOGO",
      altText: "MEET EXPERIENCE",
    });
    slide.addShape(pptx.ShapeType.line, {
      x: opts.dividerX ?? 1.92,
      y: centerY - dividerH / 2,
      w: 0,
      h: dividerH,
      line: { color: opts.dividerColor || "BFBFBF", width: opts.dividerWidth ?? 0.8 },
      objectName: "ME2026_FOOTER_DIVIDER",
    });
    slide.addImage({
      path: ME2026_ASSETS.meetsocialFooterLogo,
      x: opts.msX ?? opts.groupX ?? 2.02,
      y: centerY - groupH / 2,
      w: opts.msW ?? opts.groupW ?? 1.1,
      h: groupH,
      objectName: "ME2026_FOOTER_GROUP_LOGO",
      altText: "MeetSocial Group",
    });
  }
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
  slide.background = { color: opts.background || C.white };
  slide.addImage({
    path: opts.backgroundImage || ME2026_ASSETS.coverGlassBg,
    x: 0,
    y: 0,
    w: SLIDE_W,
    h: SLIDE_H,
    objectName: "ME2026_GLASS_BACKGROUND",
    altText: "ME2026浅蓝紫玻璃背景装饰",
  });
  if (opts.overlay === true) {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: SLIDE_W,
      h: SLIDE_H,
      fill: { color: opts.overlayColor || ME2026.primaryBlue, transparency: opts.overlayTransparency ?? 28 },
      line: { color: opts.overlayColor || ME2026.primaryBlue, transparency: 100 },
      objectName: "ME2026_COVER_OVERLAY",
    });
  }
  const logoW = opts.logoW ?? 2.3;
  const logoH = logoW / ME2026_LOGO_ASPECT;
  slide.addImage({
    path: ME2026_ASSETS.meetExperienceBilingualLogo,
    x: opts.logoX ?? opts.groupLogoX ?? 0.8,
    y: opts.logoY ?? opts.groupLogoY ?? 0.75,
    w: logoW,
    h: logoH,
    objectName: "ME2026_BRAND_LOGO",
    altText: "觅跃科技 Meet Experience",
  });
  addText(slide, opts.title || "WhatsApp驱动\n出海APP用户私域增长", opts.titleX ?? 0.95, opts.titleY ?? 3.08, opts.titleW ?? 7.6, opts.titleH ?? 1.55, {
    size: opts.titleSize ?? 48,
    bold: true,
    color: opts.titleColor ?? "5C0BE0",
    margin: 0,
    breakLine: true,
    fit: "shrink",
  });
  if (opts.subtitle) {
    addText(slide, opts.subtitle, opts.subtitleX ?? 1.0, opts.subtitleY ?? 4.82, opts.subtitleW ?? 7.2, opts.subtitleH ?? 0.34, {
      size: opts.subtitleSize ?? 18,
      bold: true,
      color: opts.subtitleColor ?? C.ink,
      margin: 0,
    });
  }
}

function addME2026ThankYou(slide, pptx, opts = {}) {
  slide.background = { color: opts.background || C.white };
  slide.addImage({
    path: opts.backgroundImage || ME2026_ASSETS.coverGlassBg,
    x: 0,
    y: 0,
    w: SLIDE_W,
    h: SLIDE_H,
    objectName: "ME2026_GLASS_BACKGROUND",
    altText: "ME2026浅蓝紫玻璃背景装饰",
  });
  const leftW = opts.leftW ?? 6.18;
  if (opts.leftOverlay === true) {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: leftW,
      h: SLIDE_H,
      fill: { color: opts.overlayColor || ME2026.primaryBlue, transparency: opts.leftOverlayTransparency ?? 35 },
      line: { color: opts.overlayColor || ME2026.primaryBlue, transparency: 100 },
      objectName: "ME2026_THANKYOU_LEFT_OVERLAY",
    });
  }

  const contactPanelX = opts.contactPanelX ?? 7.52;
  const contactPanelY = opts.contactPanelY ?? 0.82;
  const contactPanelW = opts.contactPanelW ?? 5.42;
  const contactPanelH = opts.contactPanelH ?? 6.02;
  slide.addShape(pptx.ShapeType.roundRect, {
    x: contactPanelX,
    y: contactPanelY,
    w: contactPanelW,
    h: contactPanelH,
    rectRadius: 0.08,
    fill: { color: opts.contactPanelFill || C.white, transparency: opts.contactPanelTransparency ?? 12 },
    line: { color: opts.contactPanelLine || C.white, transparency: opts.contactPanelLineTransparency ?? 55, width: opts.contactPanelLineWidth ?? 0.8 },
    objectName: "ME2026_CLOSING_CONTACT_PANEL",
  });
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
  addText(slide, (opts.title || "THANK YOU").replace(" ", "\u00A0"), opts.titleX ?? 0.95, opts.titleY ?? 3.08, opts.titleW ?? 5.6, opts.titleH ?? 0.78, {
    size: opts.titleSize ?? 48,
    bold: true,
    color: opts.titleColor ?? "5C0BE0",
    margin: 0,
    fit: "shrink",
  });
  addText(slide, opts.tagline || "全球成功，从这里开始", opts.taglineX ?? 0.98, opts.taglineY ?? 4.02, opts.taglineW ?? 4.8, opts.taglineH ?? 0.3, {
    size: opts.taglineSize ?? 14,
    bold: true,
    color: opts.taglineColor ?? C.ink,
    margin: 0,
    align: opts.taglineAlign ?? "left",
  });
  const closingLogoW = Math.min(opts.thankYouLogoW ?? 2.1, 2.3);
  const closingLogoH = Math.min(opts.thankYouLogoH ?? 0.64, closingLogoW / ME2026_LOGO_ASPECT);
  const closingLogoActualW = closingLogoH * ME2026_LOGO_ASPECT;
  slide.addImage({
    path: ME2026_ASSETS.meetExperienceBilingualLogo,
    x: opts.thankYouLogoX ?? 0.8,
    y: opts.thankYouLogoY ?? 0.75,
    w: closingLogoActualW,
    h: closingLogoH,
    objectName: "ME2026_BRAND_LOGO",
    altText: "觅跃科技 Meet Experience",
  });
  slide.addImage({ path: ME2026_ASSETS.thankYouOfficialQr, x: 7.82, y: 4.0, w: 1.95, h: 1.95, objectName: "ME2026_CLOSING_OFFICIAL_QR", altText: "MEET EXPERIENCE 官方公众号二维码" });
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
    objectName: "ME2026_CLOSING_CONTACT_BOX",
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
      color: opts.pageColor || "514A73",
      align: "right",
      margin: 0,
    });
  }
}

const ME2026_INDEX_LAYOUT = {
  firstY: ME2026_LAYOUT.contentTopY,
  rowGap: 1.18,
  rowTextOffsetY: 0.02,
  rowTextH: 0.48,
  footerGap: 0.18,
  minRowGap: 0.62,
};

function normalizeME2026IndexRows(items) {
  const defaultRows = [
    ["01", "MeetSocial介绍"],
    ["02", "泛APP行业WhatsApp解决方案"],
    ["03", "服务案例"],
    ["04", "服务价格"],
  ];

  if (!Array.isArray(items)) {
    throw new TypeError(
      "addME2026Index items must be an array of label strings or [number, label] pairs; pass options as the fourth argument."
    );
  }
  if (items.length === 0) return defaultRows;

  const hasLabels = items.some((item) => typeof item === "string");
  const hasNumberedRows = items.some(Array.isArray);
  if (hasLabels && hasNumberedRows) {
    throw new TypeError("addME2026Index items must use either string labels or [number, label] rows, not a mixture.");
  }

  return items.map((item, index) => {
    if (typeof item === "string") {
      if (!item.trim()) {
        throw new TypeError(`addME2026Index items[${index}] must be a non-empty label string.`);
      }
      return [String(index + 1).padStart(2, "0"), item];
    }

    if (Array.isArray(item) && item.length === 2) {
      const [number, label] = item;
      const validNumber =
        (typeof number === "string" && Boolean(number.trim())) ||
        (typeof number === "number" && Number.isFinite(number));
      if (validNumber && typeof label === "string" && label.trim()) {
        return [String(number), label];
      }
    }

    throw new TypeError(`addME2026Index items[${index}] must be a non-empty label string or a [number, non-empty label] pair.`);
  });
}

function getME2026IndexRowLayout(rowCount, opts, footerOptions) {
  if (rowCount > 6) {
    throw new RangeError("addME2026Index supports at most six rows; split longer directories across pages.");
  }

  const firstY = opts.firstY ?? ME2026_INDEX_LAYOUT.firstY;
  const requestedGap = opts.rowGap;
  if (!Number.isFinite(firstY) || firstY < 0) {
    throw new RangeError("addME2026Index firstY must be a finite non-negative slide coordinate.");
  }
  if (requestedGap !== undefined && (!Number.isFinite(requestedGap) || requestedGap <= 0)) {
    throw new RangeError("addME2026Index rowGap must be a finite positive number.");
  }

  const footerCenterY = footerOptions.centerY ?? (footerOptions.y !== undefined ? footerOptions.y + 0.12 : 7.13);
  const footerPageTop = footerCenterY - (footerOptions.pageH ?? 0.18) / 2;
  if (!Number.isFinite(footerPageTop)) {
    throw new RangeError("addME2026Index footer coordinates must be finite numbers.");
  }

  const contentBottom = Math.min(SLIDE_H, footerPageTop) - ME2026_INDEX_LAYOUT.footerGap;
  const maxRowY = contentBottom - ME2026_INDEX_LAYOUT.rowTextOffsetY - ME2026_INDEX_LAYOUT.rowTextH;
  const availableHeight = maxRowY - firstY;
  if (availableHeight < 0) {
    throw new RangeError("addME2026Index firstY leaves no room for an index row above the footer.");
  }

  let rowGap = requestedGap ?? ME2026_INDEX_LAYOUT.rowGap;
  if (rowCount > 1) {
    const maxRowGap = availableHeight / (rowCount - 1);
    if (requestedGap !== undefined && requestedGap > maxRowGap) {
      throw new RangeError(
        `addME2026Index rowGap ${requestedGap} overflows the ${rowCount}-row index; maximum is ${maxRowGap.toFixed(2)}.`
      );
    }
    rowGap = requestedGap ?? Math.min(ME2026_INDEX_LAYOUT.rowGap, maxRowGap);
    if (rowGap < ME2026_INDEX_LAYOUT.minRowGap) {
      throw new RangeError(
        `addME2026Index cannot fit ${rowCount} rows legibly in one column; split the index or use a multi-column layout.`
      );
    }
  }

  const lastRowBottom =
    firstY + (rowCount - 1) * rowGap + ME2026_INDEX_LAYOUT.rowTextOffsetY + ME2026_INDEX_LAYOUT.rowTextH;
  if (lastRowBottom > contentBottom + 1e-6) {
    throw new RangeError("addME2026Index rows overlap the footer or extend beyond the slide.");
  }
  return { firstY, rowGap };
}

function addME2026Index(slide, pptx, items = [], opts = {}) {
  if (!opts || typeof opts !== "object" || Array.isArray(opts)) {
    throw new TypeError("addME2026Index options must be an object in the fourth argument.");
  }
  if (opts.footer !== undefined && (!opts.footer || typeof opts.footer !== "object" || Array.isArray(opts.footer))) {
    throw new TypeError("addME2026Index footer options must be an object.");
  }

  const rows = normalizeME2026IndexRows(items);
  const footerOptions = { pageColor: C.white, ...opts.footer, brandVariant: "bilingual" };
  const { firstY, rowGap } = getME2026IndexRowLayout(rows.length, opts, footerOptions);

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
  rows.forEach(([num, label], i) => {
    const y = firstY + i * rowGap;
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
  addME2026Footer(slide, pptx, opts.pageNum ?? 2, footerOptions);
}

function addME2026WhiteBase(slide, pptx, title, pageNum, opts = {}) {
  slide.background = { color: C.white };
  addText(slide, title, opts.titleX ?? 0.62, opts.titleY ?? 0.42, opts.titleW ?? 12.0, opts.titleH ?? 0.48, {
    size: opts.titleSize ?? 22,
    bold: true,
    color: opts.titleColor || C.ink,
    margin: 0,
    fit: "shrink",
    autoShrink: opts.autoShrink,
  });
  if (opts.subtitle) {
    addText(slide, opts.subtitle, opts.subtitleX ?? 0.62, opts.subtitleY ?? 0.86, opts.subtitleW ?? 12.0, opts.subtitleH ?? 0.34, {
      size: opts.subtitleSize ?? 20,
      bold: true,
      color: opts.subtitleColor || ME2026.primaryBlue,
      margin: 0,
      fit: "shrink",
      autoShrink: opts.autoShrink,
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
  addText(slide, "用户\n旅程", labelX + 0.08, 2.16, labelW - 0.16, 0.58, { size: 16, bold: true, color: C.ink, margin: 0, align: "center", breakLine: true });
  card(slide, pptx, labelX, 3.08, labelW, 0.78, { fill: ME2026.secondarySky, line: ME2026.secondarySky, shadow: false, radius: 0.08 });
  addText(slide, "企业\n痛点", labelX + 0.08, 3.17, labelW - 0.16, 0.58, { size: 16, bold: true, color: C.ink, margin: 0, align: "center", breakLine: true });
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
    addText(slide, stage.pain, x + 0.1, 3.2, colW - 0.2, 0.18, { size: 14, bold: true, color: C.ink, margin: 0, align: "center" });
    addText(slide, stage.pain, x + 0.16, 3.63, colW - 0.32, 0.24, { size: 12, bold: true, color: ME2026.primaryDarkBlue, margin: 0, align: "center" });
    card(slide, pptx, x - 0.12, 4.1, colW + 0.24, 2.35, { fill: "F9F9F9", line: "F9F9F9", shadow: false, radius: 0.02 });
    addText(slide, stage.card, x + 0.1, 4.23, colW - 0.2, 0.26, { size: 15, bold: true, color: C.ink, margin: 0, align: "center" });
    stage.bullets.forEach((b, j) => {
      addText(slide, `> ${b}`, x + 0.02, 4.67 + j * 0.25, colW - 0.04, 0.22, { size: 10, color: C.ink, margin: 0, fit: "shrink" });
    });
    const actionsInline = stage.bullets.length >= 4 && stage.actions.length === 2;
    const actionButtonW = actionsInline ? (colW + 0.04 - 0.08) / 2 : colW + 0.04;
    stage.actions.forEach((action, j) => {
      const actionX = x - 0.02 + (actionsInline ? j * (actionButtonW + 0.08) : 0);
      const actionY = actionsInline ? 5.94 : 5.56 + j * 0.5;
      card(slide, pptx, actionX, actionY, actionButtonW, 0.35, { fill: ME2026.primaryBlue, line: ME2026.primaryBlue, shadow: false, radius: 0.04 });
      addText(slide, action, actionX + 0.06, actionY + 0.07, actionButtonW - 0.12, 0.18, { size: 11, bold: true, color: C.white, align: "center", margin: 0 });
    });
  });
  card(slide, pptx, 1.75, 6.62, 11.0, 0.38, { fill: ME2026.primaryBlue, line: ME2026.primaryBlue, shadow: false, radius: 0.04 });
  addText(slide, "WhatsApp 代运营服务", 1.8, 6.7, 10.9, 0.2, { size: 13, bold: true, color: C.ink, align: "center", margin: 0 });
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

module.exports = {
  C,
  ME2026,
  ME2026_TOKENS,
  ME2026_LAYOUT,
  ME2026_ASSETS,
  ME2026_DELOITTE_ICON_DIR,
  ME2026_ICON_LIBRARY,
  ME2026_ICON_TONES,
  ME2026_LOGO_ASPECT,
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
};
