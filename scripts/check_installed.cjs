#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SKILL_DIR = path.resolve(__dirname, "..");
const TARGET_DIR = process.env.AIDEA_PPT_INSTALLED_SKILL_DIR || "/Users/stephen/.codex/skills/aidea-sop-ppt-mebrand";
const ROOTS = ["SKILL.md", "README.md", "package.json", "references", "scripts", "assets/me-2026-app"];

function hashFile(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function walk(root) {
  const fullRoot = path.join(SKILL_DIR, root);
  if (!fs.existsSync(fullRoot)) return [];
  if (fs.statSync(fullRoot).isFile()) return [root];
  const out = [];
  for (const item of fs.readdirSync(fullRoot)) {
    if (item === "node_modules" || item === ".git") continue;
    const rel = path.join(root, item);
    const full = path.join(SKILL_DIR, rel);
    if (fs.statSync(full).isDirectory()) out.push(...walk(rel));
    else out.push(rel);
  }
  return out;
}

const files = ROOTS.flatMap(walk);
const mismatches = [];
for (const rel of files) {
  const src = path.join(SKILL_DIR, rel);
  const target = path.join(TARGET_DIR, rel);
  if (!fs.existsSync(target)) {
    mismatches.push(`${rel}: missing in installed skill`);
    continue;
  }
  if (hashFile(src) !== hashFile(target)) mismatches.push(`${rel}: hash mismatch`);
}

if (mismatches.length) {
  console.error(`FAIL: installed skill differs from repo (${mismatches.length} file(s))`);
  for (const item of mismatches.slice(0, 50)) console.error(`- ${item}`);
  if (mismatches.length > 50) console.error(`... ${mismatches.length - 50} more`);
  process.exit(1);
}

console.log(`OK installed skill matches repo key files: ${TARGET_DIR}`);
