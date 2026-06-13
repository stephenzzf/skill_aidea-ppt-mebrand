#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const SKILL_DIR = path.resolve(__dirname, "..");

function readArg(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

function readArgs(name) {
  const values = [];
  for (let i = 2; i < process.argv.length; i += 1) {
    if (process.argv[i] === name && process.argv[i + 1]) values.push(process.argv[i + 1]);
  }
  return values;
}

function hasArg(name) {
  return process.argv.includes(name);
}

function runStep(label, command, args, opts = {}) {
  const result = spawnSync(command, args, {
    cwd: SKILL_DIR,
    encoding: "utf8",
    env: process.env,
  });
  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  if (!opts.quiet) {
    if (stdout.trim()) process.stdout.write(stdout);
    if (stderr.trim()) process.stderr.write(stderr);
  }
  return {
    label,
    command: [command, ...args].join(" "),
    status: result.status,
    ok: !result.error && result.status === 0,
    error: result.error ? result.error.message : null,
    stdout,
    stderr,
  };
}

function usage() {
  console.error("Usage: node scripts/qa_me2026.cjs --pptx <file> --slides <n> [--allow-fullslide 1,2,n] [--required-text text]");
}

if (hasArg("--help") || hasArg("-h")) {
  usage();
  process.exit(0);
}

const pptx = readArg("--pptx");
const slides = readArg("--slides") || readArg("--expected-slides");
if (!pptx || !slides) {
  usage();
  process.exit(2);
}

const requiredTexts = readArgs("--required-text");
if (!requiredTexts.length) requiredTexts.push("黏贴个人联系方式");
const allowFullslide = readArg("--allow-fullslide", `1,2,${slides}`);
const allowSlides = allowFullslide.split(",").map((item) => item.trim()).filter(Boolean).join(",");
const previewDir = readArg("--preview-dir", path.join("/tmp", `me2026-preview-${path.basename(pptx).replace(/[^A-Za-z0-9_.-]/g, "_")}`));
const ledgerPath = readArg("--ledger", path.join("/tmp", `me2026-qa-ledger-${path.basename(pptx).replace(/[^A-Za-z0-9_.-]/g, "_")}.json`));

const inspectArgs = [
  path.join("scripts", "inspect_pptx.py"),
  pptx,
  "--expected-slides",
  String(slides),
  "--check-no-fullslide-images",
  "--allow-fullslide-image-slides",
  allowSlides,
  "--check-header-safe-zone",
  "--header-safe-y-in",
  "1.55",
  "--check-integer-font-sizes",
  "--min-font-size",
  "8",
  "--check-me2026-footer-logo-alignment",
  "--check-icon-card-alignment",
  "--check-label-text-row-alignment",
  "--print-style-summary",
];
for (const text of requiredTexts) {
  inspectArgs.push("--required-text", text);
}

const steps = [];
steps.push(runStep("inspect", "python3", inspectArgs));
steps.push(runStep("layout-risk", "python3", [path.join("scripts", "check_me2026_layout_risks.py"), pptx]));

let previewFile = null;
if (!hasArg("--no-preview")) {
  fs.rmSync(previewDir, { recursive: true, force: true });
  fs.mkdirSync(previewDir, { recursive: true });
  const preview = runStep("quicklook-preview", "qlmanage", ["-t", "-s", "1200", "-o", previewDir, pptx], { quiet: true });
  steps.push(preview);
  if (preview.ok) {
    const files = fs.readdirSync(previewDir).filter((name) => name.endsWith(".png"));
    previewFile = files.length ? path.join(previewDir, files[0]) : null;
  }
}

const ledger = {
  pptx,
  expectedSlides: Number(slides),
  allowFullslideSlides: allowSlides,
  requiredTexts,
  previewFile,
  generatedAt: new Date().toISOString(),
  steps: steps.map((step) => ({
    label: step.label,
    ok: step.ok,
    status: step.status,
    command: step.command,
    error: step.error,
  })),
};
fs.writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);

const failed = steps.filter((step) => !step.ok);
if (failed.length) {
  console.error(`FAIL: ME2026 QA failed (${failed.map((step) => step.label).join(", ")})`);
  console.error(`QA ledger: ${ledgerPath}`);
  process.exit(1);
}

console.log(`PASS: ME2026 QA passed`);
console.log(`QA ledger: ${ledgerPath}`);
if (previewFile) console.log(`Preview: ${previewFile}`);
