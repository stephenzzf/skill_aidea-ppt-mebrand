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
  "scripts/smoke_generate_deck.cjs",
]) {
  const fullPath = path.join(SKILL_DIR, relativePath);
  if (fs.existsSync(fullPath)) logOk(relativePath);
  else logFail(`missing required skill file: ${relativePath}`);
}

process.exit(failed ? 1 : 0);
