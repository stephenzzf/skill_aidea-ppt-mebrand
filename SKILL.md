---
name: aidea-sop-ppt-mebrand
description: Generate, repair, or rebuild editable 16:9 PPTX decks in the Aidea SOP / ME / Meet Experience / 觅跃科技 / 飞书深诺 brand system from outlines, SOPs, solution briefs, business-review content, or existing image-heavy PPTX files. Use for ME-branded presentation creation, white-template business decks, industry-solution proposal decks, PPT quality/brand validation, and converting screenshot-like PPTX pages into editable text, shapes, tables, and diagrams where Codex should use pptxgenjs, Lucide icons, OOXML inspection when needed, and built-in QA checks.
---

# Aidea SOP PPT ME Brand

Use this skill to create, repair, or rebuild editable ME / Meet Experience brand PPTX decks from structured outlines, solution briefs, SOPs, business review content, or existing PPTX files. Default to `pptxgenjs + Lucide + sharp`, not full-slide screenshots. For existing image-heavy decks, preserve the original story and usable native objects, then rebuild screenshot-like content as editable text, shapes, tables, and diagrams. Render generic icons and local visual accents as transparent PNGs only when they improve rendering reliability or visual polish.

## Workflow

1. Create a thread-scoped workspace under `/tmp/aidea-sop-ppt-mebrand/<task-slug>` for generated scripts, notes, previews, and QA output. Put only final deliverables in the user-requested output folder.
2. Read the relevant references:
   - Always read `references/brand-guidelines.md`.
   - Read `references/layout-templates.md` when choosing slide layouts or matching a white-template business deck rhythm.
   - Read `references/solution-patterns.md` for industry-solution or proposal decks.
   - Read `references/official-presentations-method.md` for story/design/QA workflow.
   - Read `references/implementation-notes.md` before writing or editing scripts.
3. Write a short source/reference audit: source content, reference style, missing facts, identity assets, and for existing PPTX files the slide count, editable text volume, full-slide images, large subject images, text-bearing groups, native tables, footer layers, and likely occlusion risks.
4. Route after the audit:
   - New PPTX: continue to claim spine, design lock, confirmation, and generation.
   - `targeted-fix / light fix`: repair narrow issues such as icons, fonts, numbering circles, footer drift, text overflow, or small overlaps.
   - `targeted-fix / rebuild path`: use when an existing PPTX is image-heavy, non-editable, uses full-slide screenshots or tile backgrounds, contains large subject images carrying core content, has blank occlusion layers, or relies on text-bearing `grpSp` for main content.
5. For new PPTX creation, write a claim spine before building: thesis, audience, slide claims, proof objects, and omissions. For `targeted-fix / rebuild path`, replace the claim spine with an original-deck structure audit and an object-rebuild strategy.
6. Lock the design system: size, fonts, palette, footer, title rules, icon grammar, card grammar, and banned motifs. For rebuilds, prioritize the original deck's visual rhythm and coordinates over template beautification unless the user asks otherwise.
7. Stop for human confirmation after content planning:
   - Show the PPT outline, slide count, narrative spine, each slide's core claim, missing facts, non-fabrication boundaries, and brand/layout constraints.
   - Recommend a production path based on the task, but do not choose silently.
   - Wait for the user to confirm the outline and path before generating any PPTX or slide preview artifacts.
   - For `targeted-fix / light fix`, skip extra confirmation when the user gave concrete issues to fix.
   - For `targeted-fix / rebuild path`, confirm the output filename, allowed retained image types, and editable-content boundary unless the user already gave a detailed plan or explicitly says `PLEASE IMPLEMENT THIS PLAN`.
   - Skip confirmation only when the user explicitly says no confirmation is needed or directly asks to generate without review.
8. After the user confirms, use one production path:
   - Direct path: build the editable PPTX immediately.
   - Preview-first path: generate slide PNG previews/contact sheet for visual confirmation, then build the final editable PPTX from the same slide plan.
   - Rebuild path: start from the original PPTX or a clean baseline each pass; do not keep layering fixes on top of a failed generated version.
9. Build a `build_<slug>.cjs` deck script using `scripts/brand_ppt_helpers.cjs`. For OOXML-level rebuilds, use task-scoped Python/XML utilities in the thread workspace rather than adding permanent scripts by default.
10. Run `scripts/inspect_pptx.py` on every final PPTX.
11. Render at least a Quick Look thumbnail when available. If no renderer exists, report that visual QA was limited to structural checks.
12. Deliver the editable PPTX plus a concise QA ledger: checks run, failures fixed, accepted limitations.

## Task Modes

- `create`: default. Generate a new ME brand deck from a user outline.
- `editable-visual-deck`: generate a new editable PPTX with local visual accents or abstract PNGs, while keeping titles, body text, cards, diagrams, timelines, and footers editable. Do not use this mode for converting an existing screenshot-like PPTX.
- `slide-image-preview`: after the outline is approved, generate 16:9 slide PNG previews and a contact sheet for visual confirmation before creating the final editable PPTX.
- `template-following`: preserve a white-template business deck rhythm, restrained page chrome, and small-icon style.
- `solution-deck`: use proposal / industry-solution narrative patterns for client-facing solution decks.
- `targeted-fix`: repair or rebuild an existing PPTX. Use `light fix` for icons, fonts, numbering circles, footer drift, text overflow, small overlaps, or brand compliance; use `rebuild path` when the source deck is image-heavy, non-editable, or contains full-slide images, tile backgrounds, large subject images carrying core content, blank occlusion layers, or main-content text-bearing `grpSp`.
- `official-presentations`: use Codex official `Presentations` / artifact-tool only when the user explicitly requests that path or a reference-beating editorial deck.

Mode routing:

- Use `create`, `solution-deck`, or `template-following` for new decks.
- Use `editable-visual-deck` for new editable decks that need local visual accents.
- Use `targeted-fix` for existing PPTX repair, optimization, or image-to-editable conversion.
- Use `slide-image-preview` only as an intermediate preview path before final editable PPTX delivery.

## Build Rules

- Use 16:9 widescreen (`13.333 x 7.5` inches).
- For new deck creation, the content plan and production path require explicit human confirmation before generation unless the user clearly opted out of confirmation.
- Final deliverables from this skill must be editable PPTX decks by default. Do not make a full-slide-image PPTX as the final deliverable.
- Slide PNG previews are intermediate confirmation artifacts only. If the user asks to "generate PPT images first, then generate PPT", treat that as preview-first editable PPTX production unless they explicitly ask only for preview images.
- Do not embed a whole slide as a background image in the final PPTX.
- Use editable text, shapes, tables, lines, and chart primitives wherever practical.
- For `targeted-fix / rebuild path`, preserve native editable text, shapes, tables, local necessary images, and precise coordinates when they are usable; remove only full-slide screenshots, tile backgrounds, large subject images that carry core editable content, blank occlusion layers, and broken or duplicated reconstruction artifacts.
- Rebuild core titles, body copy, metrics, flows, cards, tables, diagrams, arrows, and grouping structures as editable PPT objects. Necessary retained images are limited to logos, certification badges, platform marks, case photos, product photos, real screenshots, or visual assets that are not practical or useful to redraw.
- For existing PPTX rebuilds, use this layer order on target pages: white or light background primitives, editable diagrams/cards/body text, necessary local image assets, then footer overlay as the last layer.
- Avoid keeping text-bearing `grpSp` objects for main content on rebuilt target pages. Split or replace them with normal editable shapes and text boxes.
- Metric cards should be a single filled shape with its visible metric label and value inside the same shape when possible; avoid a blue empty card plus independent overlapping text boxes.
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

For `targeted-fix / rebuild path`, add a task-scoped custom QA script in the thread workspace. It should inspect `p:sp`, `p:grpSp`, `p:pic`, and `graphicFrame` bbox, z-order, text, fills, and table presence. At minimum check:

- No full-slide screenshots, tile backgrounds, or large subject images carrying core content remain on rebuilt target pages.
- No large blank occlusion shape appears above subject content.
- Target pages do not keep main-content text-bearing `grpSp`.
- Non-footer text, diagrams, photos, and decoration stay out of header/footer safety zones; footer overlay is one of the last layers.
- Body text is left-aligned unless the original or component type clearly requires otherwise; metric cards may be centered.
- Metric cards are single text-bearing filled shapes where practical, not overlapping empty cards plus separate text boxes.
- Native editable tables, especially platform-fee or comparison tables, remain `graphicFrame` tables rather than images.
- The final PPTX has editable text volume comparable to or greater than the source's extractable text, unless unreadable image text is explicitly listed as an accepted limitation.

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

For existing PPTX rebuilds, also state the clean baseline used, output version, retained image categories, custom QA result, and whether visual QA was structural-only, Quick Look, or renderer-export based. Do not claim pixel-level fidelity unless a rendered page comparison was actually performed.
