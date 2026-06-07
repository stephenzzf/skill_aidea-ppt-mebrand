# Implementation Notes

## Runtime

Use Node.js and Python 3.

Required Node packages:

```bash
npm install pptxgenjs lucide sharp
```

If running inside Codex with a bundled runtime, prefer the bundled Node executable and bundled `node_modules` when available. Do not hard-code machine-specific runtime paths in generated scripts.

Recommended runtime bootstrap for generated `.cjs` scripts:

```js
if (process.env.CODEX_NODE_MODULES) {
  process.env.NODE_PATH = process.env.CODEX_NODE_MODULES;
  require("module").Module._initPaths();
}
```

When using the Codex bundled runtime, pass the module path through the environment instead of embedding machine-specific cache paths in the script:

```bash
CODEX_NODE_MODULES="/path/to/codex/node_modules" node build_<slug>.cjs
```

## Icon Strategy

- Prefer Lucide icons for generic symbols.
- Render SVG to transparent PNG with `sharp`.
- Do not embed raw SVG by default; Quick Look and some PPT renderers may show placeholder icons.
- Use official assets only when the user provides them or explicitly authorizes their use.
- For ME2026 pages, use the public-safe `ME2026_ICON_LIBRARY` registry in `brand_ppt_helpers.cjs`. Prepare icons with `prepareME2026IconCache()` and place horizontal icon cards with `addME2026IconTitleCard()` so icon circles and titles share a vertical center.

## Visual Enhancement Strategy

- Keep final PPTX decks editable. Use PNGs only for icons, abstract accents, or decorative visual texture.
- Do not place a full-slide PNG into the final PPTX.
- Do not put essential slide text inside generated images.
- For strategic business decks, visual accents usually work best on the cover/positioning slide, core architecture slide, and closing/milestone slide. Dense matrix or roadmap slides should stay mostly editable shapes.
- Avoid unauthorized brand marks, competitor logos, customer screenshots, stock-photo-looking imagery, and fake product UIs.
- If using AI image generation for supporting visuals, generate abstract or texture-like assets only. Do not ask an image model to render Chinese body text or complete slide layouts.

## ME 2026 APP Asset Strategy

For the ME 2026 APP / WhatsApp industry template, use the extracted PPTX assets under `assets/me-2026-app/`.

- Do not use AI image generation for Cover, Index, Thank You, Logo, or footer assets.
- Cover and Index background files are extracted from the user-provided PPTX and processed only to apply the PPTX crop / horizontal flip.
- The default Thank You / Contact Us page uses `addME2026ThankYou()` with assets extracted from the source PPTX final slide. Do not reuse `addME2026Cover()` as the ME2026 closing page.
- Footer and cover logos are extracted from the PPTX and saved as renderer-safe PNG assets.
- Use `ME2026` color constants from `brand_ppt_helpers.cjs`; do not substitute the older generic blue/purple palette for this template.
- When running `inspect_pptx.py --check-no-fullslide-images`, allow only decorative cover/index/thank-you background pages with `--allow-fullslide-image-slides`; content pages should still fail if they contain full-slide images.

## Slide Image Preview Path

Use this path only after the outline is approved and the user wants to confirm visual style before the editable PPTX is generated.

- Generate one deterministic 16:9 PNG per slide, for example `slide_01.png` through `slide_06.png`.
- Generate a contact sheet for quick review.
- Treat preview PNGs as disposable visual confirmation artifacts. They are not final deliverables and should be recreated as editable PPTX objects after confirmation.
- After confirmation, recreate the same visual direction with editable PPTX objects and local visual accents.

## Human Confirmation Gate

For new deck creation, stop after content planning and path recommendation. Do not generate the final PPTX or slide previews until the user confirms.

The confirmation summary should include:
- slide count and outline
- narrative spine
- one core claim per slide
- missing facts and non-fabrication boundaries
- brand/layout constraints
- recommended path: direct editable PPTX or preview-first editable PPTX

This gate still applies when the recommended path is direct editable PPTX. Skip it only when the user explicitly says no confirmation is needed or directly asks to generate without review.

## Numbered Circles

Always draw the circle and number with the same x/y/w/h:

```js
numberedCircle(slide, pptx, 1, x, y, 0.54, C.blue, 16)
```

Do not place a tiny text box inside the circle by manual offsets.

## PPTX Rules

- HEX colors must not include `#`.
- Do not use 8-character HEX values.
- Use `opacity` or transparency fields supported by the library.
- Keep text boxes larger than the exact text footprint to allow font fallback.
- Avoid `fit: "shrink"` as the only protection for dense content.
- Use native bullets or explicit dot shapes consistently; avoid duplicate bullet glyphs.
- Prefer `Source Han Sans CN` for every text box, including footers, numbered circles, tags, source notes, and helper-generated labels.
- Use integer font sizes by default. Recommended hierarchy: page title 24 bold, subtitle 18, card titles 12-18 bold, body 10-16, source notes 8.
- Do not use a large decorative border around the page title area. Use `topTitleCompact()` by default: short vertical blue stripe, 24pt bold title, 18pt subtitle, no eyebrow.
- Keep a `1.55"` header safe zone on standard content slides. Do not place cards, timeline rows, icon grids, or body text inside the title/subtitle area.
- For icon + text rows/cards, use `iconBadge()` and `iconTextRow()` or calculate a shared row center. Do not leave icons pinned to the top while text sits lower.
- Before delivery, inspect obvious overflow risks: source notes near the footer, large metrics below cards, long labels in pills, title/subtitle safe-zone intrusion, and bullet text inside cards. If text touches or overlaps another block, enlarge the container, move the block, reduce the font within the approved range, or shorten the copy.
- The final PPTX should have meaningful editable text. `inspect_pptx.py --print-style-summary` should report non-zero `text_chars`.
- If a deck has zero editable text, stop and rebuild it as an editable PPTX unless the user only requested image previews.
- When producing multiple variants, use names that expose editability:
  - `*_可编辑版.pptx`
  - `*_可编辑视觉版.pptx`
  - `*_图片确认稿/slide_01.png`

## QA Limitations

If LibreOffice/ImageMagick are unavailable, use package checks plus Quick Look thumbnail as minimum QA. State the limitation clearly.

## ME 2026 APP Smoke Commands

```bash
node "$SKILL_DIR/scripts/generate_me2026_icon_catalog.cjs" \
  --out /tmp/me2026-icon-catalog.pptx

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
  --print-style-summary
```

## ME 2026 Comparison Analysis Test Commands

```bash
node "$SKILL_DIR/scripts/feishu_vs_teemo_me2026_test.cjs" \
  --out /tmp/feishu-vs-teemo-me2026-test.pptx

python3 "$SKILL_DIR/scripts/inspect_pptx.py" \
  /tmp/feishu-vs-teemo-me2026-test.pptx \
  --expected-slides 8 \
  --check-no-fullslide-images \
  --allow-fullslide-image-slides 1,2,8 \
  --check-header-safe-zone \
  --header-safe-y-in 1.55 \
  --check-integer-font-sizes \
  --min-font-size 8 \
  --check-me2026-footer-logo-alignment \
  --check-icon-card-alignment \
  --print-style-summary
```

## ME 2026 Realistic Simulation Commands

```bash
node "$SKILL_DIR/scripts/realistic_me2026_app_test.cjs" \
  --out /tmp/aidea-sop-ppt-mebrand-realistic-me2026-app.pptx

python3 "$SKILL_DIR/scripts/inspect_pptx.py" \
  /tmp/aidea-sop-ppt-mebrand-realistic-me2026-app.pptx \
  --expected-slides 8 \
  --check-no-fullslide-images \
  --allow-fullslide-image-slides 1,2,8 \
  --check-header-safe-zone \
  --header-safe-y-in 1.55 \
  --check-integer-font-sizes \
  --min-font-size 8 \
  --check-me2026-footer-logo-alignment \
  --check-icon-card-alignment \
  --print-style-summary
```
