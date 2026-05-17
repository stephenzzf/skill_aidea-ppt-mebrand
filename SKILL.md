---
name: aidea-sop-ppt-mebrand
description: Generate editable 16:9 PPTX decks in the Aidea SOP / ME / Meet Experience / 觅跃科技 / 飞书深诺 brand system from outlines, SOPs, solution briefs, or business-review content. Use for ME-branded presentation creation, white-template business decks, industry-solution proposal decks, and PPT quality/brand validation workflows where Codex should use pptxgenjs, Lucide icons, and built-in QA checks.
---

# Aidea SOP PPT ME Brand

Use this skill to create editable ME / Meet Experience brand PPTX decks from structured outlines, solution briefs, SOPs, or business review content. Default to `pptxgenjs + Lucide + sharp`, not full-slide screenshots. Keep text editable; render generic icons and local visual accents as transparent PNGs only when they improve rendering reliability or visual polish.

## Workflow

1. Create a thread-scoped workspace under `/tmp/aidea-sop-ppt-mebrand/<task-slug>` for generated scripts, notes, previews, and QA output. Put only final deliverables in the user-requested output folder.
2. Read the relevant references:
   - Always read `references/brand-guidelines.md`.
   - Read `references/layout-templates.md` when choosing slide layouts or matching a white-template business deck rhythm.
   - Read `references/solution-patterns.md` for industry-solution or proposal decks.
   - Read `references/official-presentations-method.md` for story/design/QA workflow.
   - Read `references/implementation-notes.md` before writing or editing scripts.
3. Write a short source/reference audit: source content, reference style, missing facts, and any identity assets.
4. Write a claim spine before building: thesis, audience, slide claims, proof objects, and omissions.
5. Lock the design system: size, fonts, palette, footer, title rules, icon grammar, card grammar, and banned motifs.
6. Stop for human confirmation after content planning:
   - Show the PPT outline, slide count, narrative spine, each slide's core claim, missing facts, non-fabrication boundaries, and brand/layout constraints.
   - Recommend a production path based on the task, but do not choose silently.
   - Wait for the user to confirm the outline and path before generating any PPTX or slide preview artifacts.
   - Skip this stop only when the user explicitly says no confirmation is needed or directly asks to generate without review.
7. After the user confirms, use one production path:
   - Direct path: build the editable PPTX immediately.
   - Preview-first path: generate slide PNG previews/contact sheet for visual confirmation, then build the final editable PPTX from the same slide plan.
8. Build a `build_<slug>.cjs` deck script using `scripts/brand_ppt_helpers.cjs`.
9. Run `scripts/inspect_pptx.py` on every final PPTX.
10. Render at least a Quick Look thumbnail when available. If no renderer exists, report that visual QA was limited to structural checks.
11. Deliver the editable PPTX plus a concise QA ledger: checks run, failures fixed, accepted limitations.

## Task Modes

- `create`: default. Generate a new ME brand deck from a user outline.
- `editable-visual-deck`: generate an editable PPTX with local visual accents or abstract PNGs, while keeping titles, body text, cards, diagrams, timelines, and footers editable.
- `slide-image-preview`: after the outline is approved, generate 16:9 slide PNG previews and a contact sheet for visual confirmation before creating the final editable PPTX.
- `template-following`: preserve a white-template business deck rhythm, restrained page chrome, and small-icon style.
- `solution-deck`: use proposal / industry-solution narrative patterns for client-facing solution decks.
- `targeted-fix`: fix a generated PPTX for icons, fonts, numbering circles, footer drift, text overflow, or brand compliance.
- `official-presentations`: use Codex official `Presentations` / artifact-tool only when the user explicitly requests that path or a reference-beating editorial deck.

## Build Rules

- Use 16:9 widescreen (`13.333 x 7.5` inches).
- For new deck creation, the content plan and production path require explicit human confirmation before generation unless the user clearly opted out of confirmation.
- Final deliverables from this skill must be editable PPTX decks by default. Do not make a full-slide-image PPTX as the final deliverable.
- Slide PNG previews are intermediate confirmation artifacts only. If the user asks to "generate PPT images first, then generate PPT", treat that as preview-first editable PPTX production unless they explicitly ask only for preview images.
- Do not embed a whole slide as a background image in the final PPTX.
- Use editable text, shapes, tables, lines, and chart primitives wherever practical.
- Use `topTitleCompact()` by default for white-template ME business pages. Do not add eyebrow labels unless the user asks for them.
- Use `iconBadge()` and `iconTextRow()` for circular icon modules and proof rows; icon circles and text groups must share a vertical center.
- Visual accents may be PNGs when they are decorative or renderer-safe, but they must not contain essential body copy, claims, metrics, or slide titles.
- Render Lucide icons to transparent PNG with `sharp`; direct SVG embedding can show as placeholder icons in some previewers.
- Use `numberedCircle()` for numbered circles; the text box and circle must share the same x/y/w/h.
- Keep every slide footer consistent: `觅跃科技 | 飞书深诺` on the left and page number on the right unless the user provides another brand footer.
- If content is too dense, split the slide or ask for a scope reduction. Do not shrink text below readable thresholds to force fit.
- Do not invent product screenshots, official logos, customer proof, metrics, or dates that are not provided by the user.
- Do not use AI image generation for full-slide Chinese text layouts; image models can distort Chinese text. Use deterministic SVG/PNG previews or editable PPTX objects instead.

## QA Gates

Run these before final editable PPTX delivery:

```bash
python3 "$SKILL_DIR/scripts/inspect_pptx.py" "$FINAL_PPTX" \
  --expected-slides <N> \
  --required-text "觅跃科技" \
  --required-text "飞书深诺" \
  --check-numbered-circles \
  --check-no-fullslide-images \
  --check-header-safe-zone \
  --header-safe-y-in 1.55 \
  --check-integer-font-sizes \
  --min-font-size 8 \
  --print-style-summary
```

The style summary must show non-zero editable text (`text_chars > 0`). If `text_chars` is zero or near-zero, the deck is likely non-editable and is not an acceptable final deliverable for this skill.

For `slide-image-preview`, validate the preview artifacts before asking for confirmation:

```bash
# Expected output: one 16:9 PNG per slide plus a contact sheet.
node - <<'NODE'
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const dir = process.env.PREVIEW_DIR;
(async () => {
  for (const name of fs.readdirSync(dir).filter((n) => /^slide_\d+\.png$/.test(n)).sort()) {
    const meta = await sharp(path.join(dir, name)).metadata();
    console.log(name, `${meta.width}x${meta.height}`);
  }
})();
NODE
```

For smoke testing the skill itself:

```bash
node "$SKILL_DIR/scripts/smoke_generate_deck.cjs" \
  --out /tmp/aidea-sop-ppt-mebrand-smoke.pptx

python3 "$SKILL_DIR/scripts/inspect_pptx.py" \
  /tmp/aidea-sop-ppt-mebrand-smoke.pptx \
  --expected-slides 3 \
  --required-text "觅跃科技" \
  --required-text "飞书深诺" \
  --check-no-fullslide-images \
  --check-header-safe-zone \
  --header-safe-y-in 1.55 \
  --check-integer-font-sizes \
  --min-font-size 8 \
  --print-style-summary
```

If available, generate a thumbnail:

```bash
qlmanage -t -s 1200 -o /tmp/aidea-sop-ppt-mebrand-preview "$FINAL_PPTX"
```

## Delivery Notes

Final response should include modified/generated files, key changes, validation results, unexecuted checks with reasons, and user-visible impact. State clearly whether the delivered PPTX is editable. If slide image previews were generated, label them as preview artifacts, not final PPTX deliverables. If this skill was used from memory or older references, say when facts may be stale.
