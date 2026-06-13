#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const SKILL_DIR = path.resolve(__dirname, "..");
const TARGET_DIR = process.env.AIDEA_PPT_INSTALLED_SKILL_DIR || "/Users/stephen/.codex/skills/aidea-sop-ppt-mebrand";

const FILES = ["SKILL.md", "README.md", "package.json", "package-lock.json", ".gitignore"];
const DIRS = ["references", "scripts", "assets", "agents"];

fs.mkdirSync(TARGET_DIR, { recursive: true });
for (const file of FILES) {
  const src = path.join(SKILL_DIR, file);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(TARGET_DIR, file));
}
for (const dir of DIRS) {
  const src = path.join(SKILL_DIR, dir);
  if (!fs.existsSync(src)) continue;
  fs.cpSync(src, path.join(TARGET_DIR, dir), { recursive: true, force: true });
}

console.log(`Synced ${SKILL_DIR} -> ${TARGET_DIR}`);
