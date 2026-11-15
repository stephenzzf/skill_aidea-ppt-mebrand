const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { renderCodeVisual } = require("./render_code_visual.cjs");

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
  const html = fs.readFileSync(path.join(root, "chat", "visual.html"), "utf8");
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);

  await assert.rejects(render("chat", {
    ...fixture.chat, height: 260, introduction: "This does not fit. ".repeat(150),
  }, "overflow"), /exceeds viewport/);
  assert.equal(fs.existsSync(path.join(root, "overflow")), false);

  const previous = fs.readFileSync(path.join(root, "search", "render.json"));
  await assert.rejects(render("search", fixture.search), /already exists/);
  assert.deepEqual(fs.readFileSync(path.join(root, "search", "render.json")), previous);
});
