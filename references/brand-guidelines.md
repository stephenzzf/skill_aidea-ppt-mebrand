# Brand Guidelines

## Palette

Use HEX values without `#`.

Primary:
- `1A4FFF` main blue: titles, data, brand accents, CTAs.
- `1FA5F0` bright blue: links, data accents, small highlights.
- `0E3CCC` dark blue: deeper blue panels and emphasis.

Secondary:
- `7C3AED` purple: secondary topic areas and consulting/service panels.
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
- Footer: left `觅跃科技 | 飞书深诺`, 10pt muted; right page number, 10pt bold muted.
- Margins: at least `0.5"` outer margin; `0.30"` between major elements.

## Icon And Layout Grammar

- Default title system: use `topTitleCompact()` with no eyebrow. Main title starts near `y=0.42-0.52`, subtitle near `y=0.94-1.10`, and body content starts at or below `y=1.55`.
- Use eyebrow / section labels only when the user explicitly asks for them. Do not add English labels such as `EXECUTIVE PROFILE` by default.
- Use `iconBadge()` for circular icon treatments. Preferred sizes: `0.54"` for list rows, `0.64-0.78"` for module cards, and `1.00-1.35"` for large process nodes.
- Use `iconTextRow()` for proof rows and list rows. The icon circle, short label, and body text must share one row center.
- `metricStrip`: horizontal blue or white cards with icon at left, large metric/phrase centered, and note below. Keep the metric inside the card with clear bottom padding.
- `processSteps`: three-stage path with large icon nodes, small step numbers, short title blocks, and bullet details below. Use editable lines/arrows, not a full-slide diagram image.
- `iconModuleGrid`: module cards with icon circle, card title, value/short phrase, and explanatory copy in separate vertical zones.

## Hard Rules

- Do not use full-width decorative title bars on normal content slides.
- Do not use a full-slide screenshot as a slide background for editable decks.
- Use no more than two dominant colors and two secondary colors per slide.
- Every content block should carry a clear proof object, icon, chart, table, or diagram.
- Maintain consistent footer and page-number placement.
- Keep shadows soft: opacity <= 0.12, blur 12-18.
- Avoid repeated rounded-card grids unless the content relationship requires containment.
- If text overflows, enlarge the container, shorten copy, or split the slide.
- Header treatment: avoid enclosing the title area in a large decorative border. Preferred rhythm is a compact top title with a short blue vertical stripe at left, a 24pt bold title, and an 18pt subtitle below.
- Reserve a compact header safe zone on normal content slides. Body cards, timeline rows, matrices, and diagrams should normally start at or below `1.55"` from the top, unless the page is a custom cover.
- Text must stay inside its intended containers. Do not let source notes, metrics, or card labels overlap footers or adjacent content.
- Large metric words must stay inside their cards. If a metric has more than 6 Chinese/Latin characters, reduce the metric font size or widen the card instead of letting it cross the lower border.
- In icon + text rows, vertically center the icon circle and text group as one unit. Bullets should align to the optical center of their corresponding text line.
