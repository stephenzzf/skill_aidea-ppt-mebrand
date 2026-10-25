#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const {
  C,
  ME2026,
  ME2026_ICON_LIBRARY,
  ME2026_DELOITTE_ICON_DIR,
  createPresentation,
  assertPalette,
  addText,
  card,
  prepareME2026IconCache,
  addME2026WhiteBase,
  addME2026IconBadge,
} = require("./brand_ppt_helpers.cjs");

function arg(name, fallback) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

const ICON_APPEARANCE_SAMPLES = {
  data: { appearance: "bare", tone: "blue", glyphScale: 0.94 },
  review: { appearance: "circle", tone: "purple", glyphScale: 0.76 },
  publish: { appearance: "rounded-square", tone: "blue", glyphScale: 0.76 },
};

const iconSourceCatalogPath = path.join(ME2026_DELOITTE_ICON_DIR, "catalog.json");
const iconSourceCatalog = fs.existsSync(iconSourceCatalogPath)
  ? JSON.parse(fs.readFileSync(iconSourceCatalogPath, "utf8"))
  : { icons: [] };
const ICON_SOURCE_FALLBACKS = new Map(
  (iconSourceCatalog.icons || [])
    .filter((icon) => icon.alias && icon.lucideFallback)
    .map((icon) => [icon.alias, icon.lucideFallback]),
);

function addCatalogPage(slide, pptx, keys, pageNum) {
  addME2026WhiteBase(slide, pptx, "ME2026 公开安全小图标目录", pageNum, {
    subtitle: "统一高对比蓝 / 紫；来源扩展图标以语义线稿展示，正式调用仍保留原资产和自定义色。",
    subtitleSize: 14,
  });
  keys.forEach((key, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 0.72 + col * 3.08;
    const y = 1.55 + row * 1.12;
    const item = ME2026_ICON_LIBRARY[key];
    const fallbackIcon = ICON_SOURCE_FALLBACKS.get(key);
    const appearanceSample = ICON_APPEARANCE_SAMPLES[key];
    const standardTone = fallbackIcon
      ? ((pageNum * 20 + i) % 2 === 0 ? "blue" : "purple")
      : (item.tone || (item.color === ME2026.secondaryPurple ? "purple" : "blue"));
    card(slide, pptx, x, y, 2.58, 0.86, {
      fill: row % 2 === 0 ? "F6FBFF" : C.white,
      line: "D7E3F5",
      shadowOpacity: 0.04,
    });
    addME2026IconBadge(slide, pptx, fallbackIcon || key, x + 0.42, y + 0.43, 0.5, {
      ...appearanceSample,
      tone: appearanceSample?.tone || standardTone,
      semanticKey: key,
      label: item.label || key,
      glyphScale: appearanceSample?.glyphScale ?? 0.74,
      strokeWidth: 2.25,
    });
    addText(slide, item.label || key, x + 0.82, y + 0.31, 1.55, 0.18, {
      size: 12,
      bold: true,
      color: C.text,
      margin: 0,
      fit: "shrink",
    });
    addText(slide, key, x + 0.82, y + 0.60, 1.65, 0.20, {
      size: 9,
      color: C.textMuted,
      margin: 0,
      fit: "shrink",
    });
  });
}

async function main() {
  assertPalette();
  const out = arg("--out", "/tmp/me2026-icon-catalog.pptx");
  const pptx = createPresentation({ title: "ME2026 Icon Catalog" });
  const keys = Object.keys(ME2026_ICON_LIBRARY);
  const glyphKeys = [...new Set([...keys, ...ICON_SOURCE_FALLBACKS.values()])];
  await prepareME2026IconCache(glyphKeys, [C.white]);
  const pageSize = 20;
  for (let i = 0; i < keys.length; i += pageSize) {
    addCatalogPage(pptx.addSlide(), pptx, keys.slice(i, i + pageSize), i / pageSize + 1);
  }
  await pptx.writeFile({ fileName: out });
  console.log(out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
