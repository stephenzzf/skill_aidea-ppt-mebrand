#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const Module = require("module");
const { spawnSync } = require("child_process");

const SKILL_DIR = path.resolve(__dirname, "..");
const NODE_MAJOR = Number(process.versions.node.split(".")[0]);
let failed = false;

function logOk(message) {
  console.log(`OK ${message}`);
}

function logWarn(message) {
  console.log(`WARN ${message}`);
}

function logFail(message) {
  failed = true;
  console.error(`FAIL ${message}`);
}

function addModulePath(dir) {
  if (!dir || !fs.existsSync(dir)) return;
  const current = process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter) : [];
  if (!current.includes(dir)) {
    process.env.NODE_PATH = [dir, ...current].join(path.delimiter);
    Module._initPaths();
  }
}

function commandExists(command, args = ["--version"]) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return !result.error && result.status === 0;
}

function requireAvailable(name) {
  try {
    const resolved = require.resolve(name);
    logOk(`${name} -> ${resolved}`);
  } catch (err) {
    logFail(
      [
        `missing Node dependency "${name}"`,
        `Run: cd "${SKILL_DIR}" && npm install`,
        "Or set AIDEA_PPT_NODE_MODULES, NODE_PATH, or CODEX_NODE_MODULES to a directory containing the dependency.",
      ].join("\n")
    );
  }
}

if (NODE_MAJOR < 18) {
  logFail(`Node.js >=18 is required; found ${process.version}`);
} else {
  logOk(`Node.js ${process.version}`);
}

addModulePath(path.join(SKILL_DIR, "node_modules"));
addModulePath(process.env.AIDEA_PPT_NODE_MODULES);
addModulePath(process.env.CODEX_NODE_MODULES);

["pptxgenjs", "lucide", "sharp"].forEach(requireAvailable);

if (commandExists("python3")) {
  logOk("python3 available");
} else {
  logFail("python3 is required for scripts/inspect_pptx.py");
}

if (commandExists("npm")) {
  logOk("npm available");
} else {
  logWarn("npm not found; package scripts may not be available in this host runtime");
}

if (commandExists("qlmanage", ["-h"])) {
  logOk("qlmanage available for optional Quick Look thumbnails");
} else {
  logWarn("qlmanage not available; visual QA can fall back to structural PPTX checks");
}

for (const relativePath of [
  "SKILL.md",
  "references/brand-guidelines.md",
  "references/layout-templates.md",
  "references/implementation-notes.md",
  "scripts/brand_ppt_helpers.cjs",
  "scripts/inspect_pptx.py",
  "scripts/check_me2026_layout_risks.py",
  "scripts/smoke_generate_deck.cjs",
  "scripts/deloitte_white_me2026_test.cjs",
  "scripts/extract_deloitte_white_icons.py",
  "assets/me-2026-app/deloitte-white-icons/catalog.json",
]) {
  const fullPath = path.join(SKILL_DIR, relativePath);
  if (fs.existsSync(fullPath)) logOk(relativePath);
  else logFail(`missing required skill file: ${relativePath}`);
}

const deloitteCatalogPath = path.join(SKILL_DIR, "assets/me-2026-app/deloitte-white-icons/catalog.json");
if (fs.existsSync(deloitteCatalogPath)) {
  const catalog = JSON.parse(fs.readFileSync(deloitteCatalogPath, "utf8"));
  const icons = catalog.icons || [];
  const badSlides = icons.filter((item) => {
    const match = String(item.sourceSlide || "").match(/^slide(\d+)\.xml$/);
    if (!match) return true;
    const slideNo = Number(match[1]);
    return slideNo < 296 || slideNo > 315 || slideNo === 205;
  });
  const missingIcons = icons.filter((item) => {
    const filePath = path.join(path.dirname(deloitteCatalogPath), item.file || "");
    return !item.file || !fs.existsSync(filePath) || fs.statSync(filePath).size < 1024;
  });
  if (icons.length < 20) logFail(`Deloitte white icon catalog has too few icons: ${icons.length}`);
  else logOk(`Deloitte white icon catalog icons=${icons.length}`);
  if (badSlides.length) logFail(`Deloitte white icon catalog has invalid source slides: ${badSlides.map((i) => i.alias).join(", ")}`);
  else logOk("Deloitte white icon catalog uses only allowed white appendix slides");
  if (missingIcons.length) logFail(`Deloitte white icon PNGs missing or too small: ${missingIcons.map((i) => i.alias).join(", ")}`);
  else logOk("Deloitte white icon PNG assets present");
}

process.exit(failed ? 1 : 0);
