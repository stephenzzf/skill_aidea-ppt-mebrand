const THEMES = ["#1759df", "#5842db", "#743bc1"];
const KINDS = ["chat", "search", "messages", "demo", "cycle", "layers"];
const escape = (value) => value.replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));

function field(input, key, fallback) {
  const value = input[key] ?? fallback;
  if (typeof value !== "string" || !value.trim()) throw new Error(`${key} must be nonempty text`);
  return escape(value.trim());
}

function list(input, key, min, max) {
  const items = input[key];
  if (!Array.isArray(items) || items.length < min || items.length > max) {
    throw new Error(`${key} requires ${min}–${max} items`);
  }
  return items;
}

function answers(spec) {
  return list(spec, "answers", 1, 3).map((item, index) => `
    <article class="answer ${item.highlight === true ? "highlight" : ""}">
      <b class="index">${index + 1}</b>
      <div><h2>${field(item, "title")}</h2><p>${field(item, "text")}</p>
      <span class="source">${field(item, "source")}</span></div>
    </article>`).join("");
}

function conversation(spec) {
  const context = spec.kind === "demo"
    ? `<span class="active">${field(spec, "activeStep", "看证据")}</span>`
    : "";
  return `<header><span class="mark">✦</span><strong>${field(spec, "title", "AI 助手")}</strong>${context}</header>
    <section class="content">
      <div class="query">${field(spec, "question")}</div>
      <p class="intro">${field(spec, "introduction")}</p>
      <div class="answers">${answers(spec)}</div>
      ${spec.takeaway ? `<div class="takeaway">${field(spec, "takeaway")}</div>` : ""}
    </section>`;
}

function search(spec) {
  return `<header><span class="mark">⌕</span><strong>${field(spec, "title", "搜索")}</strong></header>
    <section class="content">
      <div class="searchbar">${field(spec, "query")}</div>
      <h2>AI 摘要</h2><p class="intro">${field(spec, "summary")}</p>
      <div class="answers">${answers(spec)}</div>
    </section>`;
}

function messages(spec) {
  return `<div class="phone-status"><b>09:41</b><span aria-hidden="true">▰ ▰ ▰</span></div>
    <header class="phone-header"><span class="back" aria-hidden="true">‹</span>
    <span class="mark">↗</span><strong>${field(spec, "sender")}</strong></header>
    <section class="content messages">
      <div class="message"><span class="source">OTP 验证</span><p>${field(spec, "otp")}</p></div>
      <div class="message marketing"><span class="source">营销消息</span><p>${field(spec, "message")}</p>
      <span class="action">${field(spec, "action")}</span></div>
    </section>`;
}

function diagram(kind) {
  // The raster layer only supplies visual structure. Labels and directional
  // connectors are added in PowerPoint so the business meaning stays editable.
  const paint = THEMES.map((color, i) => `<linearGradient id="g${i}" x2="1" y2="1">
    <stop stop-color="${color}"/><stop offset="1" stop-color="${["#52b5f4", "#8299ff", "#b876ee"][i]}"/>
    </linearGradient>`).join("");
  const rings = THEMES.map((_, i) => `<circle cx="230" cy="180" r="124" fill="none" stroke="url(#g${i})"
    stroke-width="28" stroke-linecap="round" pathLength="360" stroke-dasharray="101 259"
    transform="rotate(${-82 + i * 120} 230 180)"/>`).join("");
  const plates = [88, 165, 242].map((y, i) => `<path d="M230 ${y-40}l156 40-156 48L74 ${y}Z"
    fill="${i === 2 ? "none" : `url(#g${i})`}" stroke="${THEMES[i]}"
    stroke-width="${i === 2 ? 3 : 1}" ${i === 2 ? 'stroke-dasharray="6 7"' : ""}/>`).join("");
  return `<svg class="diagram" viewBox="0 0 460 360" xmlns="http://www.w3.org/2000/svg">
    <defs>${paint}</defs>${kind === "cycle" ? rings : plates}</svg>`;
}

const STYLE = `
@font-face{font-family:MEVisual;src:local("Source Han Sans CN"),local("Source Han Sans CN Regular")}
*{box-sizing:border-box}
html,body{margin:0;background:transparent;color:#172441;font:22px/1.38 MEVisual,sans-serif}
#visual{margin:12px;border:1px solid #d3def4;border-radius:23px;background:#fff;
box-shadow:0 3px 9px #173c7b19;overflow-wrap:anywhere}
header{min-height:66px;padding:12px 25px;display:flex;gap:12px;align-items:center;
border-radius:22px 22px 0 0;border-bottom:1px solid #d3def4;background:linear-gradient(105deg,#edf5ff,#f2ecfc)}
header strong{font-size:24px}
.mark{background:#195add;color:white;width:34px;height:34px;border-radius:11px;text-align:center;line-height:34px}
.active{margin-left:auto;background:#e1ebff;color:#174898;font-size:19px;padding:4px 13px;border-radius:20px}
.content{padding:19px 25px 22px}
.query,.searchbar{padding:12px 18px;background:#eaf2ff;border-radius:15px;font-weight:bold;color:#164392}
.query{width:fit-content;max-width:94%;margin-left:auto}
p,h2{margin:0}
h2{font-size:23px}
.intro{margin:13px 0;font-size:21px}
.searchbar{margin-bottom:14px}
.answers{display:grid;gap:9px}
.answer{display:grid;grid-template-columns:30px 1fr;gap:10px;padding:10px 15px;border-radius:13px;background:#f5f7fc}
.highlight{background:#f0ecff;border:1px solid #ccbaf9}
.index{color:#5333ac}
.answer p{font-size:20px;margin:2px 0}
.source{display:inline-block;border-radius:16px;background:#ebeff8;color:#354869;padding:2px 10px;font-size:17px}
.takeaway{padding:9px 14px;margin-top:12px;border-left:4px solid #195add;background:#edf4ff;font-size:20px;font-weight:bold}
.phone{border:5px solid #273458!important;border-radius:32px!important;background:#f6f9ff!important}
.phone-status{display:flex;justify-content:space-between;padding:9px 24px 2px;font-size:15px}
.phone-header{border-radius:0;min-height:59px;padding:9px 17px;background:#f6f9ff}
.back{font-size:31px;line-height:1;color:#2e55ae}
.messages{display:grid;gap:13px;background:#f6f9ff;border-radius:0 0 26px 26px}
.message{padding:13px 16px;background:white;border:1px solid #d9e3f5;border-radius:14px}
.message p{margin:5px 0 0}
.marketing{background:#f9f5ff}
.action{display:inline-block;background:#6634cb;color:#fff;padding:6px 14px;margin-top:10px;border-radius:10px;font-weight:bold}
.picture{margin:0!important;border:0!important;box-shadow:none!important;background:transparent!important}
.diagram{display:block;width:100%;height:100%}
`;

function makeVisual(spec) {
  if (!spec || !KINDS.includes(spec.kind)) throw new Error(`kind must be one of ${KINDS.join(", ")}`);
  for (const key of ["width", "height"]) {
    if (!Number.isInteger(spec[key]) || spec[key] < 260 || spec[key] > 1600) {
      throw new Error(`${key} must be an integer between 260 and 1600 CSS pixels`);
    }
  }
  const isDiagram = ["cycle", "layers"].includes(spec.kind);
  const content = isDiagram ? diagram(spec.kind) : {
    chat: conversation, demo: conversation, search, messages,
  }[spec.kind](spec);
  const html = `<!doctype html><html lang="zh"><head><meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
  <style>${STYLE}</style></head><body>
  <main id="visual" ${isDiagram ? `class="picture" style="height:${spec.height}px"` : spec.kind === "messages" ? 'class="phone"' : ""}>${content}</main>
  </body></html>`;
  return { html, isDiagram };
}

module.exports = { makeVisual };
