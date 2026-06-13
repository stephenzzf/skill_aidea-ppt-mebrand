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
- For compact insight rows with an icon, title, and short body sentence, use `addME2026StackedIconRow()`. It reserves a fixed icon slot plus separated title/body zones so the title cannot sit on top of the explanation text or icon.
- For white-background consulting pages, use the Deloitte-derived ME2026 icon subset only through `ME2026_ICON_LIBRARY` aliases such as `consult-target`, `consult-search`, `consult-dashboard`, `consult-calendar`, and `consult-shield`. These assets are extracted from white appendix slides and recolored to ME2026; do not use Deloitte dark pages, logo, footer, or palette.

## Visual Enhancement Strategy

- Keep final PPTX decks editable. Use PNGs only for icons, abstract accents, or decorative visual texture.
- Do not place a full-slide PNG into the final PPTX.
- Do not put essential slide text inside generated images.
- For strategic business decks, visual accents usually work best on the cover/positioning slide, core architecture slide, and closing/milestone slide. Dense matrix or roadmap slides should stay mostly editable shapes.
- Avoid unauthorized brand marks, competitor logos, customer screenshots, stock-photo-looking imagery, and fake product UIs.
- If using AI image generation for supporting visuals, generate abstract or texture-like assets only. Do not ask an image model to render Chinese body text or complete slide layouts.

## ME2026 Asset Strategy

For the unified ME2026 template, use the extracted PPTX assets under `assets/me-2026-app/`. The directory name is historical and may remain as an internal asset path; do not expose it as a separate template name.

- Do not use AI image generation for Cover, Index, Thank You, Logo, or footer assets.
- Cover and Index background files are extracted from the user-provided PPTX and processed only to apply the PPTX crop / horizontal flip.
- The default Thank You / Contact Us page uses `addME2026ThankYou()` with assets extracted from the source PPTX final slide. Do not reuse `addME2026Cover()` as the ME2026 closing page. The right-side personal/contact QR is omitted from the public template and replaced with editable placeholder text `黏贴个人联系方式`.
- Footer and cover logos are extracted from the PPTX and saved as renderer-safe PNG assets.
- Use `ME2026` color constants from `brand_ppt_helpers.cjs`; do not substitute the older generic blue/purple palette for this template.
- When running `inspect_pptx.py --check-no-fullslide-images`, allow only decorative cover/index/thank-you background pages with `--allow-fullslide-image-slides`; content pages should still fail if they contain full-slide images.
- The Deloitte white icon subset can be rebuilt with:

```bash
NODE_PATH="$SKILL_DIR/node_modules" python3 "$SKILL_DIR/scripts/extract_deloitte_white_icons.py" \
  --source "/path/to/Deloitte_16_9_Timesaver Template_SC.potx" \
  --out-dir "$SKILL_DIR/assets/me-2026-app/deloitte-white-icons"
```

This script parses OOXML custom geometry from `slide296-slide315` only, writes transparent SVG/PNG icons, and records source slide/label metadata in `catalog.json`.

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
- Do not use a large decorative border around the page title area. Use `addME2026WhiteBase()` by default for ME2026 content pages: compact title, optional subtitle, ME2026 footer, and no eyebrow.
- Keep a `1.55"` header safe zone on standard content slides. Do not place cards, timeline rows, icon grids, or body text inside the title/subtitle area.
- For icon + text rows/cards, use `iconBadge()` and `iconTextRow()` or calculate a shared row center. Do not leave icons pinned to the top while text sits lower.
- For stacked icon rows, reserve explicit vertical zones: icon centered to the full row, title in the upper text zone, body in the lower text zone. Do not place title and body text boxes with overlapping y ranges.
- For compact API/architecture/flow diagrams, use fewer larger nodes instead of many tiny labels. Keep body flow labels at 9pt or larger, keep text boxes at least `0.15"` high, keep long labels at least `0.18"` high, and avoid boxes narrower than `1.1"` for long English or mixed Chinese/English text.
- Use `ME2026_LAYOUT` constants for dense page spacing. A table/grid followed by process cards, conclusion bars, or constraint notes needs at least `0.30"` vertical separation; card body text needs visible bottom/right padding inside the parent frame.
- For `addME2026IconTitleCard()`, rely on the default body placement when possible. If you set `bodyY` manually, verify with `check_me2026_layout_risks.py` that the body text remains inside the parent card and does not touch the lower frame line.
- Do not rely on `fit: "shrink"` to make unreadable diagram text pass. If a label needs shrinking below the readable threshold, shorten the label, split the diagram, or redesign the page.
- Before delivery, inspect obvious overflow risks: source notes near the footer, large metrics below cards, long labels in pills, title/subtitle safe-zone intrusion, and bullet text inside cards. If text touches or overlaps another block, enlarge the container, move the block, reduce the font within the approved range, or shorten the copy.
- The final PPTX should have meaningful editable text. `inspect_pptx.py --print-style-summary` should report non-zero `text_chars`.
- If a deck has zero editable text, stop and rebuild it as an editable PPTX unless the user only requested image previews.
- Prefer the unified generator and QA wrapper for built-in scenarios:

```bash
npm run generate -- --scenario eclick --out /tmp/feishu-vs-eclick-me2026-test.pptx
npm run qa -- --pptx /tmp/feishu-vs-eclick-me2026-test.pptx --slides 8 --allow-fullslide 1,2,8
```

- `qa_me2026.cjs` writes a JSON QA ledger and runs `inspect_pptx.py`, `check_me2026_layout_risks.py`, and Quick Look when available. Prefer this wrapper over repeating long command lines in new docs.
- `generate_me2026_deck.cjs` is the scenario router. Add new scenario scripts there before adding a new npm command.
- Use `npm run sync:installed && npm run check:installed` after changing Skill files so the installed Codex copy matches the Git repository.
- When producing multiple variants, use names that expose editability:
  - `*_可编辑版.pptx`
  - `*_可编辑视觉版.pptx`
  - `*_图片确认稿/slide_01.png`

## QA Limitations

If LibreOffice/ImageMagick are unavailable, use package checks plus Quick Look thumbnail as minimum QA. State the limitation clearly.

## ME2026 Smoke Commands

```bash
node "$SKILL_DIR/scripts/generate_me2026_icon_catalog.cjs" \
  --out /tmp/me2026-icon-catalog.pptx

node "$SKILL_DIR/scripts/smoke_generate_deck.cjs" \
  --scenario me2026 \
  --out /tmp/aidea-sop-ppt-mebrand-me2026-smoke.pptx

python3 "$SKILL_DIR/scripts/inspect_pptx.py" \
  /tmp/aidea-sop-ppt-mebrand-me2026-smoke.pptx \
  --expected-slides 5 \
  --check-no-fullslide-images \
  --allow-fullslide-image-slides 1,2,5 \
  --check-header-safe-zone \
  --header-safe-y-in 1.55 \
  --check-integer-font-sizes \
  --min-font-size 8 \
  --check-me2026-footer-logo-alignment \
  --check-icon-card-alignment \
  --print-style-summary

python3 "$SKILL_DIR/scripts/check_me2026_layout_risks.py" \
  /tmp/aidea-sop-ppt-mebrand-me2026-smoke.pptx
```

## ME2026 Comparison Analysis Test Commands

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

## ME2026 Realistic Simulation Commands

```bash
node "$SKILL_DIR/scripts/realistic_me2026_app_test.cjs" \
  --out /tmp/aidea-sop-ppt-mebrand-realistic-me2026.pptx

python3 "$SKILL_DIR/scripts/inspect_pptx.py" \
  /tmp/aidea-sop-ppt-mebrand-realistic-me2026.pptx \
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

python3 "$SKILL_DIR/scripts/check_me2026_layout_risks.py" \
  /tmp/aidea-sop-ppt-mebrand-realistic-me2026.pptx
```

## ME2026 Video Localization PRD Regression Commands

```bash
node "$SKILL_DIR/scripts/video_localization_engine_me2026_test.cjs" \
  --out /tmp/video-localization-engine-me2026-test.pptx

python3 "$SKILL_DIR/scripts/inspect_pptx.py" \
  /tmp/video-localization-engine-me2026-test.pptx \
  --expected-slides 16 \
  --required-text "黏贴个人联系方式" \
  --check-no-fullslide-images \
  --allow-fullslide-image-slides 1,2,16 \
  --check-header-safe-zone \
  --header-safe-y-in 1.55 \
  --check-integer-font-sizes \
  --min-font-size 8 \
  --check-me2026-footer-logo-alignment \
  --check-icon-card-alignment \
  --check-label-text-row-alignment \
  --print-style-summary

python3 "$SKILL_DIR/scripts/check_me2026_layout_risks.py" \
  /tmp/video-localization-engine-me2026-test.pptx
```

## ME2026 White Consulting Layout Commands

```bash
node "$SKILL_DIR/scripts/deloitte_white_me2026_test.cjs" \
  --out /tmp/me2026-deloitte-white-style-test.pptx

python3 "$SKILL_DIR/scripts/inspect_pptx.py" \
  /tmp/me2026-deloitte-white-style-test.pptx \
  --expected-slides 6 \
  --required-text "黏贴个人联系方式" \
  --check-no-fullslide-images \
  --allow-fullslide-image-slides 1,2,6 \
  --check-header-safe-zone \
  --header-safe-y-in 1.55 \
  --check-integer-font-sizes \
  --min-font-size 8 \
  --check-me2026-footer-logo-alignment \
  --check-icon-card-alignment \
  --check-label-text-row-alignment \
  --print-style-summary
```
