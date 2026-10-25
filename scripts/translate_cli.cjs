#!/usr/bin/env node
// Keep Python/runtime selection aligned with the existing QA entry.
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const python = process.env.AIDEA_PPT_PYTHON || "python3";
const result = spawnSync(python, [path.join(__dirname, "translate_pptx.py"), ...process.argv.slice(2)], { stdio: "inherit", env: process.env });
if (result.error) console.error(`Translation process failed: ${result.error.message}`);
if (result.signal) console.error(`Translation process terminated by ${result.signal}`);
process.exit(result.error || result.signal || !Number.isInteger(result.status) ? 1 : result.status);
