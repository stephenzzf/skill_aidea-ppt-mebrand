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

## Near-Identical Editable Rebuild Protocol

Use this protocol whenever the user asks for "100%一致", "接近100%还原", "高保真", "反复对比", or image-heavy PPTX-to-editable conversion.

1. State the boundary clearly: pixel-perfect visual identity and fully editable body content conflict when the source page is a screenshot. The final deliverable should make titles, labels, cards, arrows, tables, flow nodes, and business text editable. Logos, badges, platform marks, QR codes, photos, and complex decorative assets may remain images when they are not practical to redraw.
2. Build from measured source coordinates. Render the source page and candidate with the same renderer/resolution, define pixel-to-inch mapping, and record major frame bounds, lane centers, branch axes, footer baseline, repeated card sizes, connector endpoints, and result-strip item centers before drawing.
3. Treat any previously approved or visually stronger single-page rebuild as a golden candidate for the matching page in a whole-deck rebuild. If a whole-deck pass is worse than a prior single-page pass, transplant the higher-fidelity page objects/slide XML and then apply targeted repairs. Do not recreate a dense page from a reduced outline just to keep one generation script uniform.
4. Prefer object-preserving repair over full regeneration. If the source or a prior candidate already has usable native objects, start there and only replace broken, image-backed, overflowing, or misaligned regions.
5. Average rendered similarity is not enough. White background can make a simplified but incomplete page score higher than a complete editable reconstruction. Always compare module inventory: icons, branch cards, bottom result strips, side panels, dashed arrows, decision diamonds, and channel tags.
6. For each branch or outcome column, define one shared axis. Place title, icon, vertical arrow, action boxes, and downstream result boxes from that axis. Avoid locally centering title/icon while the overall group drifts away from the child boxes below.
7. Use dedicated helpers for repeated components. Field rows, action cards, outcome boxes, channel tags, bottom-strip items, and numbered circles should be generated from one tuned helper per component family.
8. Narrow icon+text pills such as `Email`, `SMS`, `WhatsApp`, `API`, `CRM`, and similar channel/status labels must use a mini-pill helper with measured icon slot, text slot, width, height, and no-wrap behavior. Do not reuse a generic icon-card helper inside tiny tags.
9. Multi-line body text needs a real multi-line text box with explicit height, line spacing, and vertical alignment. Do not put multiple lines into a single-line box and rely on `fit: shrink`; PowerPoint and LibreOffice can wrap or clip differently.
10. Run a text-risk scan for long Latin tokens, tiny text boxes, and multi-line boxes with insufficient height, but treat it as advisory. Merge a fix only after a local render/crop confirms the text no longer wraps, clips, or drifts.
11. Do not globally enlarge text boxes or apply broad shrink rules across many pages just to silence warnings. First repair the user-flagged region, then compare local crops and page-level similarity. Broad "safe text" edits can reduce visual fidelity.
12. For every user-flagged issue, create a named local crop/contact sheet and re-check it before delivery. Do not claim the slide is fixed from OOXML coordinates alone; renderer crops catch text wrapping, icon overflow, clipping, and perceived misalignment.
13. For dense `icon + text` rows inside cards, use one row helper that owns the full row rectangle. The helper must define `rowX/rowY/rowW/rowH`, an icon slot, a text slot, a shared `centerY`, and vertical padding. The visible icon center and the text baseline/box center must be computed from the same row center.
14. Do not place card-row icons and text as unrelated objects with independent `x/y/h` values. This creates the recurring failure where icons look centered but text crosses the row border, or text looks centered but the icon drifts upward/downward.
15. Set text-box capacity from content, not only from visual row height. Before rendering, estimate whether the longest Latin token and the expected line count fit the text slot. Increase row height, reduce font size within the source style range, or add an intentional line break; never allow renderer-driven splitting such as `WhatsA pp`, `Voice / Call Centre`, or `Suggested Responses` breaking outside the pill.
16. If a source row contains a two-line label, reproduce it intentionally with a taller row or explicit line break and aligned icon center. If the source row is one-line, treat unexpected wrapping in the candidate as a layout failure even when the text remains technically inside the slide.
17. Normalize icon PNGs by visible glyph bounds, not only by the transparent image canvas. Lucide or exported icons can have asymmetric padding; crop or compensate for the visible bbox before using the icon in a row helper, otherwise the image box may be centered while the visible glyph appears misaligned.
18. Iterate dense fixes as single-page candidates before touching the full deck. For each target page, generate a one-slide PPTX, run structural inspection, render it, inspect user-flagged crops, and run the text-risk scan. Merge into the deck only after the single page passes local crop review.
19. When inserting improved single pages into a multi-slide deck, surgically replace only the target slide XML plus its relationships/media from a clean base deck. Do not regenerate unchanged pages, because whole-deck regeneration can regress pages that were already acceptable.
20. For panels containing repeated rows, compute parent containment before drawing: `maxBottom = parentH - bottomPadding`; if `itemY + (n - 1) * rowGap + rowH > maxBottom`, compress row gap, reduce row height within legibility limits, or enlarge the parent. Never allow a child row to protrude across a parent border.
21. For cards with a large icon and row list in the same parent, reserve an explicit `iconSlot` and start row backgrounds after that slot. A row background must not overlap the visible icon area, even if the text itself fits.
22. For right-side execution panels and other narrow stacks, give channel/action labels explicit `textW` and `textH`, plus intentional line breaks for two-line labels. Prefer a controlled small font-size reduction over renderer-driven wrapping.
23. Local defect fixes can legitimately reduce page-level rendered similarity slightly. If a candidate fixes visible red-box failures, reduces text-risk count, and passes local crop review, accept and document a small average-similarity decrease instead of reverting to a higher-scoring but visibly broken page.
   - Example pattern: a pass that reduces text-risk count materially and fixes `WhatsApp` / `Voice / Call Centre` / `Suggested Responses` wrapping may be better than a higher-similarity pass, even if average rendered similarity drops by about 0.1-0.5 percentage points.
24. For PDF-to-editable-PPT rebuilds, do not emit one PPT text box per PDF span/run. Extract text by visual line or paragraph, preserve inline styling as rich-text runs inside one PPT object, and use explicit line boxes. Span-level output is a common cause of duplicated words, overprinted headings, and different PowerPoint/LibreOffice wrapping.
25. For reconstructed single-line text, default to `wrap: false`, zero margins, explicit vertical centering, and a measured horizontal safety buffer. If the text still needs wrapping, create intentional source-matched lines instead of allowing the renderer to split words unexpectedly.
26. Normalize unavailable or embedded PDF fonts before generation. Subset fonts and uncommon web fonts such as `InstrumentSans`, `NotoColorEmoji`, and symbol-only fonts should not be passed through blindly; map body text to a stable installed font and convert status glyphs into controlled icons or source images.
27. Treat logos, wordmarks, platform marks, certification badges, and small complex decorative paths as retained image assets unless they can be reproduced as clean editable vector/text without distortion. Complex PDF paths for wordmarks often render as smeared or jagged text in PPT; use source crops and suppress overlapping editable text/path duplicates.
28. Pure status glyphs such as `✅`, `☑`, `🅧`, `❌`, `✓`, and `×` require a duplicate-resolution pass. If the PDF already exposes the visible mark as an image, keep the image and remove the extracted glyph text. If there is no image, draw one controlled centered icon. Never leave both the emoji text and image in the same cell.
29. For comparison tables and status matrices, validate status marks by column/row center, not just by object bbox. Checkmarks, crosses, badges, and labels must share the original cell axis and must not float across row boundaries.
30. For PDF pages with extractable text plus large images, keep the original image XObject or mask whenever possible. Avoid page-region crops that overlap extractable text; they create a hidden raster copy underneath editable text and cause ghosting in review tools.

## PDF-To-Editable PPT Playbook

Use this playbook when a source PDF or PDF-derived deck must become a mostly editable PPTX while preserving visual fidelity.

1. Start with a source audit before generating anything: page count, source page size, extractable text volume, image count, font list, pages with tables/status marks, pages with photos/screenshots, and pages that combine text with large image masks.
2. Use the PDF renderer as the visual authority. Render source pages first, then render every candidate with the same renderer/resolution. Keep all source and candidate PNGs in the task workspace for side-by-side comparison.
3. Extract editable text by visual line or paragraph, not by PDF span. Preserve inline styles as rich-text runs inside the same PPT text object. Only split a line when the source visibly splits it.
4. Give every reconstructed single-line text object `wrap: false`, zero margin, explicit height, vertical center alignment, and a small measured width buffer. A line that wraps only in the candidate is a defect, not an acceptable renderer variation.
5. Normalize PDF-only fonts before generation. Use stable installed fonts for body text and headings unless the original font is available and verified in the renderer. Convert emoji and symbol fonts into controlled icons or retained image marks.
6. Resolve duplicate carriers before rendering the candidate: remove one of text+image, SVG path+image, emoji+image, or crop+editable text when they describe the same visible content. The preferred carrier order is editable text for normal copy, retained image for logos/wordmarks/badges/screenshots/photos, and controlled icon/image for status marks.
7. For photos, screenshots, torn-paper masks, and other complex bitmap regions, preserve the original image/mask pipeline. Do not substitute a page crop if the crop contains editable text; that creates hidden raster text under native text.
8. For logo and wordmark regions, prefer source-cropped image assets over complex reconstructed PDF paths when a path preview looks jagged, smeared, or overprinted. Logos do not need to be editable if they are identity marks.
9. For status tables, preserve the source checkmark image when available and draw a controlled centered mark only when no source image exists. Check for duplicate status text after generation; `✅`, `🅧`, `❌`, and similar glyphs should not remain as plain body text.
10. Use page-level similarity only as a triage signal. A candidate with slightly worse similarity can be better if it removes visible ghosting, duplicate symbols, text overlap, and word splitting. Local crop review of red-box issues overrides average RMS.
11. Keep a conversion ledger for each iteration: extraction strategy, font normalization, duplicate-removal rules, text-risk count, duplicate-object count, wrap report, page-level similarity, local crop status, and accepted limitations.
12. Deliver only after three gates pass: structural inspection (`inspect_pptx.py`), object-level scans for duplicate/status/font/wrap risks, and rendered side-by-side review of the user-flagged pages plus worst-scoring pages.

## Task Modes

- `create`: default. Generate a new ME brand deck from a user outline.
- `editable-visual-deck`: generate a new editable PPTX with local visual accents or abstract PNGs, while keeping titles, body text, cards, diagrams, timelines, and footers editable. Do not use this mode for converting an existing screenshot-like PPTX.
- `slide-image-preview`: after the outline is approved, generate 16:9 slide PNG previews and a contact sheet for visual confirmation before creating the final editable PPTX.
- `template-following`: preserve a white-template business deck rhythm, restrained page chrome, and small-icon style.
- `solution-deck`: use proposal / industry-solution narrative patterns for client-facing solution decks.
- `me2026-app-template`: use the uploaded ME 2026 APP / WhatsApp industry PPTX visual system, including extracted Cover/Index/Logo/footer assets and the `ME2026` color system.
- `targeted-fix`: repair or rebuild an existing PPTX. Use `light fix` for icons, fonts, numbering circles, footer drift, text overflow, small overlaps, or brand compliance; use `rebuild path` when the source deck is image-heavy, non-editable, or contains full-slide images, tile backgrounds, large subject images carrying core content, blank occlusion layers, or main-content text-bearing `grpSp`.
- `official-presentations`: use Codex official `Presentations` / artifact-tool only when the user explicitly requests that path or a reference-beating editorial deck.

Mode routing:

- Use `create`, `solution-deck`, or `template-following` for new decks.
- Use `me2026-app-template` when the user references the ME 2026 APP / WhatsApp industry template or asks for the uploaded PPTX Cover/Index/Logo/footer style.
- Use `editable-visual-deck` for new editable decks that need local visual accents.
- Use `targeted-fix` for existing PPTX repair, optimization, or image-to-editable conversion.
- Use `slide-image-preview` only as an intermediate preview path before final editable PPTX delivery.

## Build Rules

- Use 16:9 widescreen (`13.333 x 7.5` inches).
- For new deck creation, the content plan and production path require explicit human confirmation before generation unless the user clearly opted out of confirmation.
- Final deliverables from this skill must be editable PPTX decks by default. Do not make a full-slide-image PPTX as the final deliverable.
- For `me2026-app-template`, Cover, Index, and Thank You may use extracted decorative assets from `assets/me-2026-app/`; they are assets from the uploaded PPTX, not AI-generated images. Essential titles, directory items, body content, diagrams, tables, prices, and page numbers must remain editable.
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
- For `me2026-app-template`, use `ME2026_ICON_LIBRARY` and helpers such as `prepareME2026IconCache()`, `addME2026IconBadge()`, and `addME2026IconTitleCard()` for public-safe small icons. Prefer business keys such as `comparison`, `strategy`, `diligence`, `growth`, `media`, `automation`, `conversion`, `retention`, `crm`, and `api` instead of ad hoc icon choices.
- For `me2026-app-template`, use `addME2026LabelTextRow()` for every short label + long explanation row, such as "建议补充材料". Do not hand-place a separate `pill()` and `addText()` with independent y coordinates. The label box, label text, and neighboring explanation text must share one vertical center.
- For `me2026-app-template`, use `addME2026ThankYou()` as the default closing page. It is based on the source PPTX final Contact Us / Thank You page (`slide37` in the source package), with editable text plus extracted background/logo/official-account QR images. The right-side contact QR is intentionally omitted from the public template and replaced with editable placeholder text `黏贴个人联系方式`. Do not generate a closing page by reusing `addME2026Cover()`.
- Visual accents may be PNGs when they are decorative or renderer-safe, but they must not contain essential body copy, claims, metrics, or slide titles.
- Render Lucide icons to transparent PNG with `sharp`; direct SVG embedding can show as placeholder icons in some previewers.
- Use `numberedCircle()` for numbered circles; the text box and circle must share the same x/y/w/h.
- Keep every slide footer consistent: `觅跃科技 | 飞书深诺` on the left and page number on the right unless the user provides another brand footer.
- For `me2026-app-template`, use the extracted ME / MeetSocial footer logo on the left and the editable page number on the right, matching the uploaded PPTX version. The ME logo, divider, and MeetSocial logo must share one vertical center.
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

For near-identical editable rebuilds, also keep these QA artifacts in the task workspace:

- Same-renderer source and candidate PNGs for every target page.
- `render_diff.csv` or equivalent page-level metric report, plus a contact sheet sorted or labeled by target page.
- Local crops for every user-flagged issue, including icon/text alignment, narrow channel tags, branch centerlines, footer overlap, and text overflow.
- A text-risk report for long Latin tokens, tiny text boxes, and multi-line text boxes with insufficient height. This report is a triage list, not an automatic pass/fail result.
- A duplicate-object report for PDF rebuilds, including pure emoji/status text left in the PPT, status icons overlapping image marks, wordmark/logo regions rebuilt as fragile paths, and text-bearing image crops that overlap editable text.
- A renderer-wrap report or OOXML scan confirming that single-line objects that should not wrap have `wrap="none"` and that no unsupported PDF-only fonts or emoji fonts remain in body text.
- A fix ledger recording target slides, changed component families, old/new text-risk counts, old/new rendered similarity, and any accepted similarity tradeoff.
- A short accepted-limitations note for pages that remain below the visual target because of the editable-vs-image tradeoff or source-image ambiguity.

For user-marked red-box issues, apply stricter local gates before delivery:

- Any visible text crossing its card, row, pill, diamond, or panel boundary fails the page, even if the page-level rendered similarity is high.
- Any unintended word split or vertical label in compact Latin text fails the page, especially `Email`, `SMS`, `WhatsApp`, `Voice / Call Centre`, `Suggested Responses`, `Wrap-up Notes`, `Lead Scoring`, and similar labels.
- Any icon/text row where the icon center and text visual center do not share the same row center fails the local crop.
- Any card row that protrudes outside its parent card, overlaps a connector, or sits across a parent border fails the local crop.
- Any duplicate rendering of the same visible word, logo, checkmark, cross, or status icon fails the local crop, even if it comes from different object types such as text plus image, SVG path plus image, or emoji plus image.
- Any heading/body pair where a heading wraps into the first body line, or a body line renders on top of another extracted span, fails the page. Fix by regrouping text into visual lines/paragraphs, not by hiding the duplicate under an occlusion shape.
- A fixed version must show the source crop and candidate crop side by side at 2x or higher; do not accept a fix based only on object coordinates or the absence of `inspect_pptx.py` errors.
- If page-level similarity worsens while local defects are fixed, report both numbers plainly. The page can pass only when the red-box crop is visibly improved and the risk scan no longer flags the original labels or rows.
- For repeated dense components, include zoom crops of the exact component families that failed: right-side execution panels, long English labels, CRM/status row lists, Agent/Copilot rows, parent-card row containment, and large-icon-plus-row cards.

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

For ME 2026 APP template smoke testing:

```bash
node "$SKILL_DIR/scripts/generate_me2026_icon_catalog.cjs" \
  --out /tmp/me2026-icon-catalog.pptx
```

```bash
node "$SKILL_DIR/scripts/smoke_generate_deck.cjs" \
  --scenario me2026-app \
  --out /tmp/aidea-sop-ppt-mebrand-me2026-app-smoke.pptx

python3 "$SKILL_DIR/scripts/inspect_pptx.py" \
  /tmp/aidea-sop-ppt-mebrand-me2026-app-smoke.pptx \
  --expected-slides 4 \
  --check-no-fullslide-images \
  --allow-fullslide-image-slides 1,2 \
  --check-header-safe-zone \
  --header-safe-y-in 1.55 \
  --check-integer-font-sizes \
  --min-font-size 8 \
  --check-me2026-footer-logo-alignment \
  --check-icon-card-alignment \
  --check-label-text-row-alignment \
  --print-style-summary
```

For ME 2026 comparison-analysis simulation testing:

```bash
node "$SKILL_DIR/scripts/feishu_vs_teemo_me2026_test.cjs" \
  --out /tmp/feishu-vs-teemo-me2026-test.pptx

python3 "$SKILL_DIR/scripts/inspect_pptx.py" \
  /tmp/feishu-vs-teemo-me2026-test.pptx \
  --expected-slides 8 \
  --required-text "黏贴个人联系方式" \
  --check-no-fullslide-images \
  --allow-fullslide-image-slides 1,2,8 \
  --check-header-safe-zone \
  --header-safe-y-in 1.55 \
  --check-integer-font-sizes \
  --min-font-size 8 \
  --check-me2026-footer-logo-alignment \
  --check-icon-card-alignment \
  --check-label-text-row-alignment \
  --print-style-summary
```

For ME 2026 Feishu Shenno vs Eclicktech comparison simulation testing:

```bash
node "$SKILL_DIR/scripts/feishu_vs_eclick_me2026_test.cjs" \
  --out /tmp/feishu-vs-eclick-me2026-test.pptx

python3 "$SKILL_DIR/scripts/inspect_pptx.py" \
  /tmp/feishu-vs-eclick-me2026-test.pptx \
  --expected-slides 8 \
  --required-text "黏贴个人联系方式" \
  --check-no-fullslide-images \
  --allow-fullslide-image-slides 1,2,8 \
  --check-header-safe-zone \
  --header-safe-y-in 1.55 \
  --check-integer-font-sizes \
  --min-font-size 8 \
  --check-me2026-footer-logo-alignment \
  --check-icon-card-alignment \
  --check-label-text-row-alignment \
  --print-style-summary
```

For ME 2026 Feishu Shenno AI capability research simulation testing:

```bash
node "$SKILL_DIR/scripts/feishu_ai_capability_me2026_test.cjs" \
  --out /tmp/feishu-ai-capability-me2026-test.pptx

python3 "$SKILL_DIR/scripts/inspect_pptx.py" \
  /tmp/feishu-ai-capability-me2026-test.pptx \
  --expected-slides 10 \
  --required-text "黏贴个人联系方式" \
  --check-no-fullslide-images \
  --allow-fullslide-image-slides 1,2,10 \
  --check-header-safe-zone \
  --header-safe-y-in 1.55 \
  --check-integer-font-sizes \
  --min-font-size 8 \
  --check-me2026-footer-logo-alignment \
  --check-icon-card-alignment \
  --check-label-text-row-alignment \
  --alignment-tolerance-in 0.08 \
  --print-style-summary
```

For realistic ME 2026 APP simulation testing:

```bash
node "$SKILL_DIR/scripts/realistic_me2026_app_test.cjs" \
  --out /tmp/aidea-sop-ppt-mebrand-realistic-me2026-app.pptx

python3 "$SKILL_DIR/scripts/inspect_pptx.py" \
  /tmp/aidea-sop-ppt-mebrand-realistic-me2026-app.pptx \
  --expected-slides 8 \
  --required-text "黏贴个人联系方式" \
  --check-no-fullslide-images \
  --allow-fullslide-image-slides 1,2,8 \
  --check-header-safe-zone \
  --header-safe-y-in 1.55 \
  --check-integer-font-sizes \
  --min-font-size 8 \
  --check-me2026-footer-logo-alignment \
  --check-icon-card-alignment \
  --check-label-text-row-alignment \
  --print-style-summary
```

If available, generate a thumbnail:

```bash
qlmanage -t -s 1200 -o /tmp/aidea-sop-ppt-mebrand-preview "$FINAL_PPTX"
```

## Delivery Notes

Final response should include modified/generated files, key changes, validation results, unexecuted checks with reasons, and user-visible impact. State clearly whether the delivered PPTX is editable. If slide image previews were generated, label them as preview artifacts, not final PPTX deliverables. If this skill was used from memory or older references, say when facts may be stale.

For existing PPTX rebuilds, also state the clean baseline used, output version, retained image categories, custom QA result, and whether visual QA was structural-only, Quick Look, or renderer-export based. Do not claim pixel-level fidelity unless a rendered page comparison was actually performed.
