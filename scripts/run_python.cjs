#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const { resolvePython } = require("./python_runtime.cjs");

try {
  const { executable } = resolvePython();
  const result = spawnSync(executable, process.argv.slice(2), { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`Python terminated by ${result.signal}`);
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
