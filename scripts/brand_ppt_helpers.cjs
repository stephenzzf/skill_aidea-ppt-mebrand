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

const FONT = "Source Han Sans CN";
const FONT_FALLBACK = "Arial";
const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
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

function pill(slide, pptx, text, x, y, w, opts = {}) {
  card(slide, pptx, x, y, w, opts.h || 0.42, {
    fill: opts.fill || C.blueBgSoft,
    line: opts.line || C.divider,
    shadow: false,
    radius: 0.07,
  });
  addText(slide, text, x + 0.1, y + 0.1, w - 0.2, 0.18, {
    size: opts.size || 12,
    bold: opts.bold ?? true,
    color: opts.color || C.blue,
    align: "center",
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

module.exports = {
  C,
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
  addIcon,
  iconCircle,
  iconBadge,
  iconTextRow,
  pill,
  bullet,
};
