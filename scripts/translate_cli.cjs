#!/usr/bin/env node
const path = require("node:path");
process.argv.splice(2, 0, path.join(__dirname, "translate_pptx.py"));
require("./run_python.cjs");
