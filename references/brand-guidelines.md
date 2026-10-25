# Brand Guidelines

## Palette

Use HEX values without `#`.

Primary:
- `1A4FFF` main blue: titles, data, brand accents, CTAs.
- `1FA5F0` bright blue: links, data accents, small highlights.
- `0E3CCC` dark blue: deeper blue panels and emphasis.

Secondary:
- `7C3AED` purple: secondary topic areas and service panels.
- `4C1D95` dark purple: purple footer bars or deep accents.
- `7DD3FC` sky: light decorations.
- `5EEAD4` mint: connectors, data-flow, ecosystem links.

Tertiary:
- `C084FC` lavender: tags.
- `F59E0B` amber: caution or process arrows.
- `F97316` orange: commercialization or action highlights.
- `0E7490` teal and `1E5F8E` deep teal: third category / operating principle blocks.
- `64748B` muted text.

Soft backgrounds:
- `EEF2FF`, `F4F6FF`, `F5F3FF`, `EDE9FE`, `ECFDF5`, `CCFBF1`, `FFF7ED`, `FED7AA`, `FFFFFF`.

Core implementation palette:
- `ink`: `0F172A`
- `text`: `1E293B`
- `divider`: `E2E8F0`
- `cardBorder`: `E5E7EB`

## ME2026 Template Palette

Use this palette for the unified ME2026 template based on the uploaded PPTX reference. These values come from the PPTX master `Colour order` theme and swatch transforms, not from screenshot approximation.

Primary MEET EXPERIENCE colours:
- `1161F7` primary blue.
- `398BBF` steel blue, derived from `accent5` with `lumMod=75000`.
- `0D49B9` dark primary blue, derived from `accent1` with `lumMod=75000`.

Secondary MEET EXPERIENCE colours:
- `8801DF` primary purple.
- `6601A7` dark purple, derived from `accent2` with `lumMod=75000`.
- `4CB9FF` bright sky blue.
- `45D0E4` cyan.

Tertiary MEET EXPERIENCE colours:
- `B867EC` lavender purple, derived from `accent2` with `lumMod=60000` and `lumOff=40000`.
- `FFC000` amber.
- `403C3C` warm dark gray, derived from `tx2` with `lumMod=50000`.
- `226872` deep teal, derived from `accent6` with `lumMod=50000`.
- `265C80` deep blue, derived from `accent5` with `lumMod=50000`.

Theme base:
- `FFFFFF`, `000000`, `E7E5E5`, `545354`, `D5D8F5`.

## Typography

Use installed Chinese fonts first:
- Preferred: `Source Han Sans CN` / 思源黑体.
- Fallback: `Noto Sans CJK SC`, `PingFang SC`, `Microsoft YaHei`.
- Latin fallback: `Arial`.

Recommended sizes:
- Page title: 24pt bold.
- Page subtitle: 18pt regular or semibold muted text.
- Card title: 12-18pt bold.
- Body: 10-16pt regular.
- Notes/source: 8pt muted.
- Key metrics: 20-28pt bold main blue.

Use integer font sizes by default. Avoid decimal font sizes unless a renderer-specific adjustment is required and documented.

Keep all production text editable. Convert only non-text icon or visual assets to PNG.

## Page System

- Slide size: 16:9 widescreen, `13.333 x 7.5` inches.
- Default background: white.
- Optional brand stripe: left vertical `0.10 x 0.55` main blue near page header.
- Footer on standard body slides: MEET EXPERIENCE logo, a vertical divider, and the MeetSocial Group logo at the left; right page number, 10pt bold muted.
- Margins: at least `0.5"` outer margin; `0.30"` between major elements.

ME2026 template:
- Cover, index, and Thank You pages use extracted PPTX visual assets, not AI-generated images. The cover and Thank You pages share the full-slide light blue/purple glass background `assets/me-2026-app/cover-glass-bg.png` from `slideLayout1` / `ppt/media/image1.png`.
- Full-bleed backgrounds remain decorative; titles, subtitles, directory rows, contact copy, and placeholders stay editable PPT text. The cover uses the compact color bilingual ME logo at the upper left, deep-purple title (`5C0BE0`) and INK subtitle by default, without a blue overlay or white logo plate. Explicit helper options may override these defaults.
- Thank You / Contact Us pages use `addME2026ThankYou()` with the same glass background, not a reused cover slide. Keep the bilingual logo at the upper left, the editable deep-purple `THANK YOU` title and INK tagline on the left, and the existing contact text, official-account QR, labels, and editable personal-contact placeholder in the right panel. The white rounded panel uses 12% transparency by default. Omit the source personal-contact QR from the public template and replace its slot with editable text `黏贴个人联系方式`.
- Standard body pages use a white background, top-left title, the original MEET EXPERIENCE + divider + MeetSocial Group footer, and page number on the right.
- New decks use the extracted transparent color bilingual logo `assets/me-2026-app/meet-experience-bilingual.png` on the cover, index, and closing page, matching the user's selected brand treatment. Keep the cover logo compact and do not add a white backing plate. The extracted light/reverse logo `assets/me-2026-app/meet-experience-bilingual-reverse.png` is retained as an alternate source, not the default; use it only when explicitly selected. Its source part, crop, and hash are recorded in `meet-experience-bilingual-reverse.source.json`. Preserve both assets' original colors, aspect ratio, and transparency.
- Body pages use the separate MEET EXPERIENCE and MeetSocial Group logos with their divider. The extracted bilingual logo must not appear in body-page footers. Never redraw, recolor or regenerate any official logo with AI.
- Design tokens: use `ME2026_TOKENS`, `ME2026`, and `ME2026_LAYOUT` as the source of truth for colors, font scale, spacing, minimum component heights, and footer coordinates. New helper scripts should not introduce scattered magic numbers when a token exists.

## Icon And Layout Grammar

- Default title system: use `topTitleCompact()` with no eyebrow. Main title starts near `y=0.42-0.52`, subtitle near `y=0.94-1.10`, and body content starts at or below `y=1.55`.
- Use eyebrow / section labels only when the user explicitly asks for them. Do not add English labels such as `EXECUTIVE PROFILE` by default.
- Public helper `addME2026IconBadge()` supports bare glyphs, circular badges, and rounded-square badges. Use `appearance: "bare"` for large process cards and `appearance: "rounded-square"` for compact rows; keep the old appearance as the compatibility default for existing calls. Tune the glyph with `tone`, `glyphScale` and `strokeWidth` when needed.
- For `addME2026IconTitleCard()` and `addME2026StackedIconRow()`, use `iconAppearance`, `iconTone`, `iconScale` and `iconStrokeWidth` when the task needs an explicit treatment. New ME2026 cards should normally use one of the brand blue/purple tones aligned with the adjacent title. Preserve the helper's legacy defaults for older callers.
- Use a clear glyph with enough visible area and a consistent outline weight. Keep aspect ratio and optically center it in its slot. Do not let the tint or outline disappear against the actual card fill; a numerically legible icon can still look visually mismatched if its shape or hue conflicts with the card title or neighboring modules.
- Preferred icon areas: `0.54"` for list rows, `0.64-0.78"` for module cards, and `1.00-1.35"` for large process nodes. These are starting points; size the visible glyph, not only its badge container.
- Use `iconTextRow()` for proof rows and list rows. The icon, short label, and body text must share one row center. Compact rows may use a pale, same-family rounded-square container rather than a circle.
- For ME2026 pages, prefer `ME2026_ICON_LIBRARY` keys and `addME2026IconTitleCard()` for horizontal icon cards. Public-safe default keys include `comparison`, `strategy`, `diligence`, `growth`, `media`, `automation`, `conversion`, `retention`, `crm`, and `api`.
- `metricStrip`: horizontal blue or white cards with icon at left, large metric/phrase centered, and note below. Keep the metric inside the card with clear bottom padding.
- `processSteps`: three-stage path with large icon nodes, small step numbers, short title blocks, and bullet details below. Use editable lines/arrows, not a full-slide diagram image.
- `iconModuleGrid`: module cards with a slot-appropriate icon glyph or badge, card title, value/short phrase, and explanatory copy in separate vertical zones.
- Give each icon a semantic job tied to the adjacent content. Reuse the same icon key and blue/purple title-aligned tone for the same concept across pages; an icon may be omitted when the card title already carries the meaning. Do not assign unrelated colors to adjacent icons just to make each one different, and do not rely on color alone to distinguish categories.
- The icon treatment and spacing principles are informed by [IBM Carbon pictogram guidance](https://www.carbondesignsystem.com/building-blocks/foundations/pictograms/guidelines): preserve scale and proportions, provide clearance, optically center the glyph, and pair foreground/background colors deliberately. Use ME2026 assets and tones; do not copy third-party pictograms.
- Use consultation-ready modules inside the standard ME2026 system: capability cards, evidence cards, metric modules, comparison tables, process paths and layered architecture. Let the page claim determine the pattern; avoid making every page a rounded-card grid.
- For a 30-minute public talk, use a readable hierarchy: titles `28–30pt`, card titles `22–24pt`, primary body `20–22pt`, and table text `18–20pt`. Put citations, data caveats and long limitations in a separate compact note zone, and keep visible qualifications that change the claim beside the claim itself.
- The existing icon card/row helpers retain their legacy shrinking behavior by default. Set `autoShrink: false` when the agreed font size must remain fixed; then enlarge/reflow the card or simplify its wording if the content does not fit. Do not use shrink-to-fit to make a public-talk card appear to fit.
- For talk slides, use a few clearly related modules per page, commonly two to four. Use full-width blue emphasis only for a genuinely deck-level conclusion, not as a repeated footer band on ordinary content pages.

## Hard Rules

- Do not use full-width decorative title bars on normal content slides.
- Do not use a full-slide screenshot as a slide background for editable decks.
- Use no more than two dominant colors and two secondary colors per slide.
- Give each major content group a clear visual anchor such as an icon, chart, table, card or diagram where it helps explain the relationship; do not add icons as decoration to every text block.
- Maintain consistent footer and page-number placement.
- Keep shadows soft: opacity <= 0.12, blur 12-18.
- Avoid repeated rounded-card grids unless the content relationship requires containment.
- If text overflows, enlarge the container, shorten copy, or split the slide.
- Header treatment: avoid enclosing the title area in a large decorative border. Preferred rhythm is a compact top title with a short blue vertical stripe at left, a 24pt bold title, and an 18pt subtitle below.
- Reserve a compact header safe zone on normal content slides. Body cards, timeline rows, matrices, and diagrams should normally start at or below `1.55"` from the top, unless the page is a custom cover.
- Text must stay inside its intended containers. Do not let source notes, metrics, or card labels overlap footers or adjacent content.
- Dense tables and grids need breathing room. Follow-up process cards, conclusion bars, constraint notes, or long explanatory text should start at least `0.30"` below the table/grid bottom.
- Card body copy must stay inside the visible frame with bottom/right padding. If body text touches or crosses a card border, increase card height, move the body up, shorten the copy, or split the content.
- Text contrast: where OOXML text and fill colors are explicit, body text should meet a conservative contrast floor. If contrast QA fails, use a darker ME2026 text color, a lighter card fill, or a stronger title color.
- Large metric words must stay inside their cards. If a metric has more than 6 Chinese/Latin characters, reduce the metric font size or widen the card instead of letting it cross the lower border.
- In icon + text rows, vertically center the icon circle and text group as one unit. Bullets should align to the optical center of their corresponding text line.

### Compact cards and paired metrics

Keep the whole icon badge inside its card with visible padding and align its visual center with the adjacent title or full text row. Paired metrics must share value, label and note baselines; repeated context can move to a common heading. Compact Chinese labels must avoid accidental one-character final lines. See the [coordinate and label contract](implementation-notes.md#icon-and-metric-placement-contract).
