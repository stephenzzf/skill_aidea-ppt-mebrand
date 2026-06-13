#!/usr/bin/env node
const path = require("path");
const {
  C,
  ME2026,
  createPresentation,
  assertPalette,
  prepareIconCache,
  addME2026Cover,
  addME2026Index,
  addME2026WhiteBase,
  addJourneySolutionMatrix,
  addApiCapabilityFlow,
} = require("./brand_ppt_helpers.cjs");

function arg(name, fallback) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

async function buildMe2026Smoke(out) {
  const pptx = createPresentation({ title: "ME2026 Template Smoke" });
  await prepareIconCache(["Brain", "Search", "Handshake", "BadgeDollarSign"], [ME2026.primaryBlue, ME2026.tertiaryLavender, C.white]);

  {
    const s = pptx.addSlide();
    addME2026Cover(s, pptx, {
      title: "WhatsApp驱动\n出海APP用户私域增长",
      titleSize: 48,
    });
  }

  {
    const s = pptx.addSlide();
    addME2026Index(s, pptx, [
      ["01", "MeetSocial介绍"],
      ["02", "泛APP行业WhatsApp解决方案"],
      ["03", "服务案例"],
      ["04", "服务价格"],
    ], { pageNum: 2 });
  }

  {
    const s = pptx.addSlide();
    addME2026WhiteBase(s, pptx, "基于WhatsApp的私域增长方案", 3);
    addJourneySolutionMatrix(s, pptx);
  }

  {
    const s = pptx.addSlide();
    addME2026WhiteBase(s, pptx, "WhatsApp API：灵活定制企业场景", 4);
    addApiCapabilityFlow(s, pptx);
  }

  await pptx.writeFile({ fileName: out });
}

async function main() {
  assertPalette();
  const out = arg("--out", "/tmp/aidea-sop-ppt-mebrand-smoke.pptx");
  const scenario = arg("--scenario", "me2026");
  if (!["me2026", "me2026-app", "default"].includes(scenario)) {
    throw new Error(`Unknown scenario "${scenario}". Use --scenario me2026.`);
  }
  await buildMe2026Smoke(out);
  console.log(out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
