# Implementation Notes

## Runtime

Use Node.js and Python 3.

Required Node packages:

```bash
npm install pptxgenjs lucide sharp
```

If running inside Codex with a bundled runtime, prefer the bundled Node executable and bundled `node_modules` when available. Do not hard-code machine-specific runtime paths in generated scripts.

## Icon Strategy

- Prefer Lucide icons for generic symbols.
- Render SVG to transparent PNG with `sharp`.
- Do not embed raw SVG by default; Quick Look and some PPT renderers may show placeholder icons.
- Use official assets only when the user provides them or explicitly authorizes their use.

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

## QA Limitations

If LibreOffice/ImageMagick are unavailable, use package checks plus Quick Look thumbnail as minimum QA. State the limitation clearly.
