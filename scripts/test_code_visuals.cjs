const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { renderCodeVisual } = require("./render_code_visual.cjs");

const { makeVisual } = require("./code_visual_templates.cjs");
const sharp = require("sharp");

const common = { width: 740, height: 680 };
const answer = { title: "字幕工作流", text: "先导出字幕，再校对产品术语。", source: "示例教程" };

test("Chrome renders all code visual types and rejects overflow or stale output", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "me-code-visuals-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = {
    chat: { ...common, question: "显示 <script> 操作指南", introduction: "一个示例", answers: [answer] },
    search: { ...common, query: "多语言教程工具", summary: "核对字幕导出。", answers: [answer] },
    demo: { ...common, question: "怎么处理术语一致性？", introduction: "核对来源。", answers: [{ ...answer, highlight: true }], takeaway: "补充术语表" },
    messages: { ...common, width: 420, sender: "Demo Studio", otp: "示例验证码 4826", message: "继续制作你的多语言产品教程。", action: "继续试用" },
    comparison: { ...common, title: "消息与共享工作台", panes: [
      { title: "消费者端", view: "messages", items: ["查询进度", "收到服务答复"] },
      { title: "工作台", items: ["待跟进工单", "已处理会话"] },
    ] },
    diagram: { width: 640, height: 420, svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420"><g fill="#512d99" transform="translate(24 16)"><rect x="40" y="60" width="100" height="80"/><circle cx="300" cy="100" r="50"/></g></svg>' },
    cycle: { width: 460, height: 360 },
    layers: { width: 460, height: 360 },
  };
  async function render(kind, spec, output = kind) {
    const input = path.join(root, output + ".json");
    fs.writeFileSync(input, JSON.stringify({ kind, ...spec }));
    return renderCodeVisual(input, path.join(root, output));
  }
  for (const [kind, spec] of Object.entries(fixture)) {
    const result = await render(kind, spec);
    assert.equal(result.width, spec.width * 2);
    assert.equal(result.kind, kind);
    if (spec.answers || kind === "messages") assert.deepEqual(result.fonts, ["MEVisual"]);
  }
  const sample = await sharp(path.join(root, "diagram", "visual.png"))
    .extract({ left: 170, top: 190, width: 1, height: 1 }).raw().toBuffer();
  assert.deepEqual([...sample], [81, 45, 153, 255]);
  const html = fs.readFileSync(path.join(root, "chat", "visual.html"), "utf8");
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);

  await assert.rejects(render("chat", {
    ...fixture.chat, height: 260, introduction: "This does not fit. ".repeat(150),
  }, "overflow"), /exceeds viewport/);
  assert.equal(fs.existsSync(path.join(root, "overflow")), false);

  await assert.rejects(render("comparison", {
    ...fixture.comparison, panes: [fixture.comparison.panes[0]],
  }, "missing-alternative"), /panes requires 2/);
  const diagram = body => ({ width: 400, height: 400,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">${body}</svg>` });
  const circle = '<circle cx="200" cy="200" r="100" fill="black"/>';
  await render("diagram", diagram(circle), "black-silhouette");
  await assert.rejects(render("diagram", diagram(circle + '<path d="M200 200 L"/>'),
    "incomplete-path"), /Invalid SVG path geometry/);
  await assert.rejects(render("diagram", diagram('<circle cx="200" cy="200" r="100" fill="none"/>'),
    "transparent"), /blank/);
  const previous = fs.readFileSync(path.join(root, "search", "render.json"));
  await assert.rejects(render("search", fixture.search), /already exists/);
  assert.deepEqual(fs.readFileSync(path.join(root, "search", "render.json")), previous);
});

test("custom diagrams accept only self-contained, unlabelled geometry", () => {
  const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">${body}</svg>`;
  for (const drawing of [
    svg('<text x="1" y="1">Metric</text>'),
    svg('<image href="https://example.invalid/image.png"/>'),
    svg('<path d="M5 5L20 20" stroke="url(#external)"/>'),
    svg('<rect onload="alert(1)"/>'),
    svg('').replace('0 0 400 400', '0 0 800 400'),
    svg('<g/>'),
    svg('<circle r="-2"/>'),
    svg('<g transform="scale(1 2 3)"><rect width="20" height="20"/></g>'),
  ]) {
    assert.throws(() => makeVisual({ kind: "diagram", width: 400, height: 400, svg: drawing }),
      /unsupported SVG|viewBox|no shapes|negative SVG|invalid SVG transform/);
  }
});
