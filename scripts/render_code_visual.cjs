#!/usr/bin/env node
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");
const sharp = require("sharp");
const { makeVisual } = require("./code_visual_templates.cjs");

function findChrome() {
  const paths = process.env.AIDEA_PPT_CHROME ? [process.env.AIDEA_PPT_CHROME] : [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "google-chrome", "chromium", "chromium-browser",
  ];
  for (const candidate of paths) {
    const probe = spawnSync(candidate, ["--version"], { encoding: "utf8", timeout: 5000 });
    if (probe.status === 0) return { executable: candidate, version: probe.stdout.trim() };
  }
  throw new Error("Chrome/Chromium unavailable; set AIDEA_PPT_CHROME");
}

function openBrowser(executable, profile) {
  const child = spawn(executable, [
    "--headless", "--remote-debugging-pipe", `--user-data-dir=${profile}`,
    "--no-first-run", "--disable-background-networking", "--disable-component-update",
    "--no-default-browser-check", "about:blank",
  ], { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] });
  const pending = new Map();
  const writer = child.stdio[3];
  let id = 0;
  let buffer = "";
  function stop(error) {
    for (const item of pending.values()) item.reject(error);
    pending.clear();
    child.kill();
  }
  child.on("error", stop);
  child.on("exit", (code, signal) => stop(new Error(`Chrome exited: ${code ?? signal}`)));
  writer.on("error", stop);
  child.stdio[4].setEncoding("utf8").on("data", chunk => {
    buffer += chunk;
    const lines = buffer.split("\0");
    buffer = lines.pop();
    for (const line of lines) {
      const message = JSON.parse(line);
      const item = pending.get(message.id);
      if (!item) continue;
      pending.delete(message.id);
      if (message.error) item.reject(new Error(message.error.message));
      else item.resolve(message.result);
    }
  });
  const timer = setTimeout(() => stop(new Error("Chrome rendering timed out after 30 seconds")), 30000);
  return {
    send(method, params = {}, sessionId) {
      return new Promise((resolve, reject) => {
        const message = { id: ++id, method, params, sessionId };
        pending.set(id, { resolve, reject });
        writer.write(JSON.stringify(message) + "\0");
      });
    },
    async close() {
      clearTimeout(timer);
      if (child.exitCode !== null || child.signalCode !== null) return;
      await new Promise(resolve => {
        child.once("close", resolve);
        child.kill();
      });
    },
  };
}

async function capture(visual, width, height, profile, browser) {
  const cdp = openBrowser(browser.executable, profile);
  try {
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const send = (method, params) => cdp.send(method, params, sessionId);
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 2, mobile: false });
    await send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
    const { frameTree } = await send("Page.getFrameTree");
    await send("Page.setDocumentContent", { frameId: frameTree.frame.id, html: visual.html });
    const { result, exceptionDetails } = await send("Runtime.evaluate", {
      expression: `(async () => {
        await document.fonts.ready;
        const visual = document.getElementById('visual');
        const fontFaces = [...document.fonts];
        if (!${visual.isDiagram} && !fontFaces.some(font => font.status === 'loaded')) {
          return { error: 'Source Han Sans CN font did not load' };
        }
        const rect = visual.getBoundingClientRect();
        const bottom = rect.bottom + (${visual.isDiagram} ? 0 : 12);
        if (bottom > innerHeight || document.documentElement.scrollWidth > innerWidth) {
          return { error: 'Visual content exceeds viewport: ' + Math.ceil(bottom) + 'px high, ' + document.documentElement.scrollWidth + 'px wide' };
        }
        return { fonts: fontFaces.filter(f => f.status === 'loaded').map(f => f.family),
          contentHeight: Math.ceil(bottom) };
      })()`,
      awaitPromise: true, returnByValue: true,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? result.description ?? "Browser layout check failed");
    if (result.value.error) throw new Error(result.value.error);
    const { data } = await send("Page.captureScreenshot", {
      format: "png", clip: { x: 0, y: 0, width, height: result.value.contentHeight, scale: 1 },
    });
    return { png: Buffer.from(data, "base64"), ...result.value };
  } finally {
    await cdp.close();
  }
}

const hash = data => createHash("sha256").update(data).digest("hex");

async function renderCodeVisual(input, output) {
  if (fs.existsSync(output)) throw new Error("Output directory already exists; choose a new directory");
  const source = fs.readFileSync(input);
  const spec = JSON.parse(source);
  const visual = makeVisual(spec);
  const browser = findChrome();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "me-code-visual-"));
  let captureResult;
  try {
    captureResult = await capture(visual, spec.width, spec.height, profile, browser);
  } finally {
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
  }
  const { png, fonts, contentHeight } = captureResult;
  const stats = await sharp(png).stats();
  if (stats.entropy < 0.05 || stats.channels[3]?.max === 0) throw new Error("Visual PNG is blank");
  const info = await sharp(png).metadata();
  if (info.width !== spec.width * 2 || info.height !== contentHeight * 2) {
    throw new Error("Unexpected visual PNG dimensions");
  }
  const receipt = {
    status: "pass", kind: spec.kind, width: info.width, height: info.height,
    browser: browser.version, fonts, source_sha256: hash(source),
    html_sha256: hash(visual.html), png_sha256: hash(png),
  };
  // Publish only into a new directory. A retry can never inherit an earlier PNG.
  fs.mkdirSync(output);
  fs.writeFileSync(path.join(output, "source.json"), source);
  fs.writeFileSync(path.join(output, "visual.html"), visual.html);
  fs.writeFileSync(path.join(output, "visual.png"), png);
  fs.writeFileSync(path.join(output, "render.json"), JSON.stringify(receipt, null, 2) + "\n");
  return receipt;
}

if (require.main === module) {
  const [input, output, extra] = process.argv.slice(2);
  if (!input || !output || extra) {
    console.error("Usage: node scripts/render_code_visual.cjs <spec.json> <new-output-directory>");
    process.exitCode = 1;
  } else {
    renderCodeVisual(input, output).then(
      receipt => console.log(JSON.stringify(receipt)),
      error => { console.error(error.message); process.exitCode = 1; },
    );
  }
}
module.exports = { renderCodeVisual };
