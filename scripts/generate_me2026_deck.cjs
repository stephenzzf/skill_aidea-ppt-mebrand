#!/usr/bin/env node
const path = require("path");
const { spawnSync } = require("child_process");

const SKILL_DIR = path.resolve(__dirname, "..");

const SCENARIOS = {
  smoke: { script: "smoke_generate_deck.cjs", defaults: ["--scenario", "me2026"], defaultOut: "/tmp/aidea-sop-ppt-mebrand-me2026-smoke.pptx" },
  me2026: { script: "smoke_generate_deck.cjs", defaults: ["--scenario", "me2026"], defaultOut: "/tmp/aidea-sop-ppt-mebrand-me2026-smoke.pptx" },
  realistic: { script: "realistic_me2026_app_test.cjs", defaults: [], defaultOut: "/tmp/aidea-sop-ppt-mebrand-realistic-me2026.pptx" },
  teemo: { script: "feishu_vs_teemo_me2026_test.cjs", defaults: [], defaultOut: "/tmp/feishu-vs-teemo-me2026-test.pptx" },
  "compare:teemo": { script: "feishu_vs_teemo_me2026_test.cjs", defaults: [], defaultOut: "/tmp/feishu-vs-teemo-me2026-test.pptx" },
  eclick: { script: "feishu_vs_eclick_me2026_test.cjs", defaults: [], defaultOut: "/tmp/feishu-vs-eclick-me2026-test.pptx" },
  "compare:eclick": { script: "feishu_vs_eclick_me2026_test.cjs", defaults: [], defaultOut: "/tmp/feishu-vs-eclick-me2026-test.pptx" },
  "ai-capability": { script: "feishu_ai_capability_me2026_test.cjs", defaults: [], defaultOut: "/tmp/feishu-ai-capability-me2026-test.pptx" },
  ai: { script: "feishu_ai_capability_me2026_test.cjs", defaults: [], defaultOut: "/tmp/feishu-ai-capability-me2026-test.pptx" },
  "video-localization": { script: "video_localization_engine_me2026_test.cjs", defaults: [], defaultOut: "/tmp/video-localization-engine-me2026-test.pptx" },
  video: { script: "video_localization_engine_me2026_test.cjs", defaults: [], defaultOut: "/tmp/video-localization-engine-me2026-test.pptx" },
  "deloitte-white": { script: "deloitte_white_me2026_test.cjs", defaults: [], defaultOut: "/tmp/me2026-deloitte-white-style-test.pptx" },
  "component-catalog": { script: "generate_me2026_component_catalog.cjs", defaults: [], defaultOut: "/tmp/me2026-component-catalog.pptx" },
  "icon-catalog": { script: "generate_me2026_icon_catalog.cjs", defaults: [], defaultOut: "/tmp/me2026-icon-catalog.pptx" },
};

function readArg(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

function hasArg(name) {
  return process.argv.includes(name);
}

function usage() {
  const names = Object.keys(SCENARIOS).sort().join(", ");
  console.error(`Usage: node scripts/generate_me2026_deck.cjs --scenario <name> [--out <pptx>]`);
  console.error(`Scenarios: ${names}`);
}

const scenarioName = readArg("--scenario", "smoke");
const scenario = SCENARIOS[scenarioName];
if (!scenario || hasArg("--help") || hasArg("-h")) {
  usage();
  process.exit(scenario ? 0 : 2);
}

const passthrough = process.argv.slice(2).filter((arg, idx, arr) => {
  if (arg === "--scenario") return false;
  if (idx > 0 && arr[idx - 1] === "--scenario") return false;
  return true;
});

if (!passthrough.includes("--out")) {
  passthrough.push("--out", scenario.defaultOut);
}

const childArgs = [path.join("scripts", scenario.script), ...scenario.defaults, ...passthrough];
const result = spawnSync(process.execPath, childArgs, {
  cwd: SKILL_DIR,
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status || 0);
