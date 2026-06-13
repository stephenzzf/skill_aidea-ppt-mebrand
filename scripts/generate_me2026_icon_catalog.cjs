#!/usr/bin/env node
const {
  C,
  ME2026,
  ME2026_ICON_LIBRARY,
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

function addCatalogPage(slide, pptx, keys, pageNum) {
  addME2026WhiteBase(slide, pptx, "ME2026 公开安全小图标目录", pageNum, {
    subtitle: "使用 ME2026_ICON_LIBRARY key 快速选择并加入 PPT；包含 Lucide 通用图标和 ME2026 白底咨询提取图标。",
    subtitleSize: 14,
  });
  keys.forEach((key, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 0.72 + col * 3.08;
    const y = 1.55 + row * 1.12;
    const item = ME2026_ICON_LIBRARY[key];
    card(slide, pptx, x, y, 2.58, 0.86, {
      fill: row % 2 === 0 ? "F6FBFF" : C.white,
      line: item.color || ME2026.primaryBlue,
      shadowOpacity: 0.04,
    });
    addME2026IconBadge(slide, pptx, key, x + 0.42, y + 0.43, 0.5);
    addText(slide, item.label || key, x + 0.82, y + 0.31, 1.55, 0.18, {
      size: 12,
      bold: true,
      color: item.color || ME2026.primaryBlue,
      margin: 0,
      fit: "shrink",
    });
    addText(slide, key, x + 0.82, y + 0.62, 1.55, 0.14, {
      size: 8,
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
  await prepareME2026IconCache(keys, [C.white]);
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
