const { spawnSync } = require("node:child_process");

const probe = `
import json, sys
from importlib.metadata import version
from PIL import Image
from lxml import etree
import fitz
print(json.dumps({"executable": sys.executable, "version": sys.version.split()[0],
                  "packages": {name: version(name) for name in ("lxml", "Pillow", "PyMuPDF")}}))
`;

let runtime;

function resolvePython() {
  if (runtime) return runtime;
  const command = process.env.AIDEA_PPT_PYTHON || "python3";
  const result = spawnSync(command, ["-c", probe], { encoding: "utf8", timeout: 15000 });
  if (result.status !== 0) {
    const detail = result.error?.message || result.stderr.trim().split("\n").at(-1) || result.signal || `exit ${result.status}`;
    throw new Error(`Python environment blocked (${command}): ${detail}. Set AIDEA_PPT_PYTHON to a Python with requirements.txt installed.`);
  }
  try {
    runtime = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Python environment blocked (${command}): runtime probe did not return JSON.`);
  }
  return runtime;
}

module.exports = { resolvePython };
