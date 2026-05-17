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

## Visual Enhancement Strategy

- Keep final PPTX decks editable. Use PNGs only for icons, abstract accents, or decorative visual texture.
- Do not place a full-slide PNG into the final PPTX.
- Do not put essential slide text inside generated images.
- For strategic business decks, visual accents usually work best on the cover/positioning slide, core architecture slide, and closing/milestone slide. Dense matrix or roadmap slides should stay mostly editable shapes.
- Avoid unauthorized brand marks, competitor logos, customer screenshots, stock-photo-looking imagery, and fake product UIs.
- If using AI image generation for supporting visuals, generate abstract or texture-like assets only. Do not ask an image model to render Chinese body text or complete slide layouts.

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
- Do not use a large decorative border around the page title area. Use the ME header rhythm: short vertical blue stripe, eyebrow, 24pt bold title, 18pt subtitle.
- For icon + text rows/cards, align icon circles and text groups vertically to the same optical center. Do not leave icons pinned to the top while text sits lower.
- Before delivery, inspect obvious overflow risks: source notes near the footer, large metrics below cards, long labels in pills, and bullet text inside cards. If text touches or overlaps another block, enlarge the container, move the block, or shorten the copy.
- The final PPTX should have meaningful editable text. `inspect_pptx.py --print-style-summary` should report non-zero `text_chars`.
- If a deck has zero editable text, stop and rebuild it as an editable PPTX unless the user only requested image previews.
- When producing multiple variants, use names that expose editability:
  - `*_可编辑版.pptx`
  - `*_可编辑视觉版.pptx`
  - `*_图片确认稿/slide_01.png`

## QA Limitations

If LibreOffice/ImageMagick are unavailable, use package checks plus Quick Look thumbnail as minimum QA. State the limitation clearly.
