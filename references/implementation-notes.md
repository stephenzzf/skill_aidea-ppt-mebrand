# Implementation Notes

## Runtime

Use Node.js and Python 3.

Required Node packages:

```bash
npm ci
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
- For ME2026 pages, use the public-safe `ME2026_ICON_LIBRARY` registry in `brand_ppt_helpers.cjs`. Prepare icons with `prepareME2026IconCache()` and place horizontal icon cards with `addME2026IconTitleCard()` so icons and titles share a vertical center.
- For compact insight rows with an icon, title, and short body sentence, use `addME2026StackedIconRow()`. It reserves a fixed icon slot plus separated title/body zones so the title cannot sit on top of the explanation text or icon.
- For new layouts, use a bare transparent glyph in large process cards and a pale rounded-square badge in compact rows; use the helper's blue/purple tone that matches the title category. The public `addME2026IconBadge()` options are `appearance`, `tone`, `glyphScale` and `strokeWidth`; card and row options are `iconAppearance`, `iconTone`, `iconScale` and `iconStrokeWidth`. Keep legacy defaults for old calls. Match glyph optical size and line weight, preserve proportions, and center visually rather than relying only on the image box bounds.

## Icon and metric placement contract

`addME2026IconBadge(slide, pptx, key, cx, cy, d, opts)` takes the **badge center**, in inches. Its top-left is `(cx - d/2, cy - d/2)`. It does not take a top-left coordinate. `addIcon()` uses top-left coordinates; do not transfer its arguments unchanged to the badge helper.

For a custom card, derive the icon and title from one header center. This example keeps a 0.42-inch badge 0.16 inches inside the left edge and vertically aligned with the title:

```js
const d = 0.42, left = cardX + 0.16, centerY = cardY + 0.40;
addME2026IconBadge(slide, pptx, 'strategy', left + d / 2, centerY, d,
  { appearance: 'rounded-square', tone: 'blue' });
addText(slide, title, left + d + 0.16, centerY - titleH / 2,
  titleW, titleH, { size: 16, autoShrink: false });
```

- Check the full badge bounds against the parent card, with visible padding on all sides (normally at least 0.15 inches). The glyph fitting inside the canvas alone is insufficient. Prefer `addME2026IconTitleCard()` / `addME2026StackedIconRow()` when their content structure fits.
- Compact icon/text rows use a shared `centerY` for the badge and the full text block; a two-line label is centered as a two-line block, not aligned to its first line. Column text on the same row shares this center.
- Paired metric cards reserve identical value, label and note zones, with the same font sizes, heights, y offsets and alignment. Do not vertically center a two-line label in a one-line box. Move repeated context to a shared heading or shorten labels equivalently (for example, heading “AI 内容可见度” and labels “商品页 / 首页”); retain values, units and qualifications.
- For compact labels, inspect the rendered line breaks. Widen/reflow or choose an intentional semantic break such as “品牌与 / 商品事实”; do not accept a lone final character. Do not remove facts or silently shrink type to force a fit.

## Visual Enhancement Strategy

- Keep final PPTX decks editable. Photos, illustrations and backgrounds may be independent raster assets; core copy, tables, charts and flows stay native.
- Do not flatten a finished slide into a PNG. Explicitly declared decorative backgrounds may cover a section/body page while essential content remains native.
- Do not put essential slide text inside generated images.
- In standard ME2026, optional visual accents belong in body capability/explanation pages. Cover, Index and Thank You retain official assets. Dense matrices and roadmaps stay mostly native objects.
- Use sourced brand marks and screenshots only within the task authorization. Mark fictional AI scenes and conceptual UI where they could be mistaken for evidence.
- Supporting native-tool imagery may be a photo, illustration or background. Before generating an explanatory asset, record `page_claim`, `subject`, `action`, `inputs`, `outputs` and `required_cues`; choose an editable native chart/table/flow when it communicates exact relationships better. Images are optional. Do not ask image tools to render essential Chinese body text, facts, charts or complete final slide layouts. Review relevance, clarity and integration for each explained asset. See `native-imagery.md`.

## ME2026 Asset Strategy

For the unified ME2026 template, use the extracted PPTX assets under `assets/me-2026-app/`. The directory name is historical and may remain as an internal asset path; do not expose it as a separate template name.

- Do not use AI image generation for Cover, Index, Thank You, Logo, or footer assets.
- The retained `cover-bg.jpg` and current `index-bg.jpg` use the user-provided PPTX crop / horizontal-flip treatment. Cover and Thank You now use the same full-slide `assets/me-2026-app/cover-glass-bg.png`, extracted byte-for-byte from `slideLayout1` / `ppt/media/image1.png`; its source metadata is in `cover-glass-bg.source.json`.
- The default Thank You / Contact Us page uses `addME2026ThankYou()` with the shared glass background and preserved source-PPTX official-account QR. Do not reuse `addME2026Cover()` as the ME2026 closing page. Omit the source personal/contact QR from the public template and replace its slot with editable placeholder text `黏贴个人联系方式`, while keeping the original editable contact copy and labels.
- Use the transparent color `assets/me-2026-app/meet-experience-bilingual.png` on cover, index, and closing pages by default, following the user's selected branding. Keep the cover logo compact and do not add a white backing plate. Use a deep-purple (`5C0BE0`) cover/closing title and INK subtitle/tagline by default, without a blue overlay. The closing contact panel is a native rounded rectangle with white fill at 12% transparency, preserving the existing editable contact text and placeholder box. Retain `assets/me-2026-app/meet-experience-bilingual-reverse.png` as an alternate source only; its provenance identifies `image4.png` from the user-provided template and is recorded in its `.source.json`. Preserve original colors, aspect ratios and transparency. Do not replace supplied backgrounds or redraw/recolor either logo with AI.
- Use the separate MEET EXPERIENCE and MeetSocial Group logo PNGs, with the original divider, on standard body-page footers. These are the current body-footer assets, not legacy-only artwork. Keep them out of the cover/index/closing bilingual-logo slot unless preserving a source deck that already uses them.
- Use `ME2026` color constants from `brand_ppt_helpers.cjs`; do not substitute the older generic blue/purple palette for this template.
- When running `inspect_pptx.py --check-no-fullslide-images`, allow only explicitly declared decorative cover/index/thank-you or explicitly declared body background pages with `--allow-fullslide-image-slides`; body pages still fail when their required native content is missing or rasterized.
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

For every PPT route, including translation, targeted repair and test decks, present the concrete content/image plan and wait for human confirmation before candidate generation. Source inspection/extraction/rendering may precede confirmation.

The confirmation summary should include:
- slide count and outline
- narrative spine
- one core claim per slide
- missing facts and non-fabrication boundaries
- brand/layout constraints
- recommended path: direct editable PPTX or preview-first editable PPTX

There is no test/direct-generation bypass. Explicit acceptance of the plan already shown authorizes its scoped generation, QA and fixes; do not request that confirmation again.

## Numbered Circles

Always draw the circle and number with the same x/y/w/h:

```js
numberedCircle(slide, pptx, 1, x, y, 0.54, C.blue, 16)
```

Do not place a tiny text box inside the circle by manual offsets.

## PPTX Rules

- Use `createPresentation()` rather than a raw PptxGenJS instance so all supported exports use the shared package normalizer. It does not alter the globally installed PptxGenJS library.
- Tables use `valign: "middle"`; `"mid"` is tolerated for text but PptxGenJS writes it literally as an invalid table `anchor`. Do not assume text and table option aliases are interchangeable.
- Do not delete speaker notes or notes-master placeholders to suppress repair prompts. Keep a distinct notes theme and validate package relationships/child ordering. See [PowerPoint compatibility](powerpoint-compatibility.md).

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
- For icon + text rows/cards, use public helpers `addME2026IconBadge()` and `iconTextRow()` or calculate a shared row center. Do not leave icons pinned to the top while text sits lower.
- For stacked icon rows, reserve explicit vertical zones: icon centered to the full row, title in the upper text zone, body in the lower text zone. Do not place title and body text boxes with overlapping y ranges.
- For compact API/architecture/flow diagrams, use fewer larger nodes instead of many tiny labels. Keep body flow labels at 9pt or larger, keep text boxes at least `0.15"` high, keep long labels at least `0.18"` high, and avoid boxes narrower than `1.1"` for long English or mixed Chinese/English text.
- Use `ME2026_LAYOUT` constants for dense page spacing. A table/grid followed by process cards, conclusion bars, or constraint notes needs at least `0.30"` vertical separation; card body text needs visible bottom/right padding inside the parent frame.
- For `addME2026IconTitleCard()`, rely on the default body placement when possible. If you set `bodyY` manually, verify with `check_me2026_layout_risks.py` that the body text remains inside the parent card and does not touch the lower frame line.
- Do not rely on `fit: "shrink"` to make unreadable diagram text pass. If a label needs shrinking below the readable threshold, shorten the label, split the diagram, or redesign the page.
- Before delivery, inspect obvious overflow risks: source notes near the footer, large metrics below cards, long labels in pills, title/subtitle safe-zone intrusion, and bullet text inside cards. If text touches or overlaps another block, enlarge the container, move the block, reduce the font within the approved range, or shorten the copy.
- Each content page must satisfy its editable-object contract; deck-wide non-zero `text_chars` is insufficient.
- If a deck has zero editable text, stop and rebuild it as an editable PPTX unless the user only requested image previews.
- Prefer the unified generator and QA wrapper for built-in scenarios:

```bash
npm run generate -- --scenario eclick --out /tmp/feishu-vs-eclick-me2026-test.pptx
npm run qa -- --pptx /tmp/feishu-vs-eclick-me2026-test.pptx --slides 8 --allow-fullslide 1,2,8
```

- `qa_me2026.cjs` writes a hash-bound, layered JSON QA ledger and runs the shared OOXML checks and full-page renderer. Prefer this wrapper over repeating long command lines in new docs.
- `generate_me2026_deck.cjs` is the scenario router. Add new scenario scripts there before adding a new npm command.
- When editing a separate source repository, sync and compare the installed copy. When editing the installed non-Git directory directly, read back the changed files; do not self-sync, initialize Git, or claim a source commit.
- When producing multiple variants, use names that expose editability:
  - `*_可编辑版.pptx`
  - `*_可编辑视觉版.pptx`
  - `*_图片确认稿/slide_01.png`

## QA Limitations

If the renderer, Python rendering dependency, or required fonts are unavailable, keep structural results but mark rendering not_run/fail and overall incomplete/failed. A thumbnail cannot complete required rendering or visual review. See `qa-and-content-contract.md`.

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


## Index input contract

`addME2026Index(slide, pptx, items, opts)` retains its four arguments. Pass either a string array (automatic numbering) or `[number, title]` rows. Options such as `pageNum` belong in the fourth argument. Invalid objects/rows throw instead of silently selecting the default directory. Four rows preserve the established layout; up to six fit the content region. Split longer directories rather than shrinking text or clipping rows.

## Translation implementation boundary

The extract/apply helper owns one source-object locator contract and its atomic package write transaction; the separate read-only translation checker verifies that contract in existing QA. Keep these shared identifiers authoritative when extending supported objects. The first release blocks unsupported SmartArt/OLE/external charts and unresolved workbook references rather than building a generic import platform. See [translation](translation.md).
