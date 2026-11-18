const { C, ME2026, addText, card } = require("./brand_ppt_helpers.cjs");

/** Draw two independent editable workflows, each with its own result. */
function addME2026DualPath(slide, pptx, { x = 0.72, y = 2.15, w = 11.9, lanes }) {
  if (!Array.isArray(lanes) || lanes.length !== 2 ||
      lanes.some((lane) => !lane.label || !lane.outcome || !lane.detail ||
        !Array.isArray(lane.steps) || lane.steps.length < 2 || lane.steps.length > 4 ||
        lane.steps.some((step) => typeof step !== "string" || !step.trim()))) {
    throw new Error("Dual path requires two labeled lanes with 2–4 steps and separate outcome text.");
  }
  const laneH = 1.65;
  const outcomeW = 3.1;
  const outcomeX = x + w - outcomeW;
  const gap = 0.30;
  const leftW = outcomeX - x - gap;
  const text = (value, tx, ty, tw, th, options) =>
    addText(slide, value, tx, ty, tw, th, { autoShrink: false, ...options });
  lanes.forEach(({ label, steps, outcome, detail }, index) => {
    const rowY = y + index * (laneH + 0.22);
    const accent = index ? ME2026.secondaryPurple : ME2026.primaryBlue;
    const flowY = rowY + 0.61;
    const nodeW = (leftW - gap * (steps.length - 1)) / steps.length;
    const nodeH = 0.78;
    text(label, x, rowY + 0.08, leftW, 0.39, { size: 22, color: accent, bold: true });
    steps.forEach((step, stepIndex) => {
      const nodeX = x + stepIndex * (nodeW + gap);
      card(slide, pptx, nodeX, flowY, nodeW, nodeH, { fill: accent, line: accent, shadow: false });
      text(step, nodeX + 0.08, flowY + 0.11, nodeW - 0.16, 0.56,
        { size: 20, color: C.white, align: "center" });
      slide.addShape(pptx.ShapeType.line, {
        x: nodeX + nodeW + 0.035, y: flowY + nodeH / 2, w: gap - 0.07, h: 0,
        line: { color: accent, width: 1.5, endArrowType: "triangle" },
      });
    });
    card(slide, pptx, outcomeX, rowY, outcomeW, laneH, { shadow: false, line: accent });
    text(outcome, outcomeX + 0.14, rowY + 0.13, outcomeW - 0.28, 0.39,
      { size: 22, color: accent, bold: true });
    text(detail, outcomeX + 0.14, rowY + 0.62, outcomeW - 0.28, 0.86,
      { size: 20, color: C.ink, valign: "top" });
  });
}

module.exports = { addME2026DualPath };
