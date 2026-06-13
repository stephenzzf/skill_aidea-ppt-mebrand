# Layout Templates

Use these layout patterns inside the unified ME2026 template. Mix patterns only when the story requires it.

## A. Five-Step Timeline

Use for product evolution, business stages, capability maturation, or roadmap pages.
- Top horizontal rule with numbered circles.
- Use `numberedCircle()` for every number.
- Each step: pale circle icon, stage title, short label, date or phase, short tags.
- Bottom: one or two white/pale cards for summary capabilities or implications.

## A2. ME2026 Compact Content Title

Use inside ME2026 content pages when a compact business-page rhythm is needed.
- No eyebrow by default.
- Use the ME2026 content-page title area and footer.
- Title: compact bold title near the top; optional subtitle directly below.
- Body starts at or below `1.55"` from the top.

## B. Results Overview

Use for achievements or current-state summaries.
- Top row: four statistic cards with icon + large metric or phrase.
- Middle row: three cards for business result, coverage, capability system.
- Bottom row: process strip such as `诊断 -> 交付 -> 产品化 -> AI 化`.

## B2. Metric Strip

Use for KPI, identity, or proof-object summaries.
- Use three or four horizontal cards.
- Each card: circular icon badge, short label, large metric/phrase, small note.
- Blue cards may use white icon circles; white cards use pale icon circles.
- Keep metric text inside the card, with visible bottom padding.

## B3. Icon Module Grid

Use for capability modules, business pillars, service modules, or proof objects.
- Each card: icon badge at top, title aligned to icon center, value/short phrase below, explanatory text in its own zone.
- Use consistent icon badge size and row centers across cards.
- Use arrows only when cards have a real flow relationship.

## B4. Process Steps / Process Arc

Use for 3-step growth paths, capability upgrades, service methodology, or roadmap simplification.
- Large icon node for each stage; optional small step number above.
- Title block sits below each icon node; bullets or short notes sit below title block.
- Connectors should be editable grey curves/lines or blue arrows.
- Do not paste a full process diagram as a non-editable image.

## B5. Icon Text Rows

Use for personal introductions, proof rows, and compact capability summaries.
- Each row has a fixed row height and one shared vertical center.
- The icon circle, label, and body text are all aligned to that center.
- Divider lines sit between rows, not through text or icon circles.

## C. Growth Path / Driver / Outcome

Use for transformation stories.
- Left: vertical timeline.
- Middle: stacked growth drivers.
- Right: 2x2 outcome grid.
- Bottom: one concise foundation statement.

## D. Dual-Wheel Strategy

Use for strategy, comparison, or two-sided operating models.
- Left and right large panels with solid header bars.
- Middle column shows data flow, operating loop, or AI linkage.
- Keep arrows semantic, not decorative.

## E. 2x2 Operating Matrix

Use for four principles or operating lessons.
- Four equal cards, same dimensions and padding.
- Colors: purple, blue, teal, orange.
- Each card: numbered circle, title, subtitle, 3 bullets, divider, bottom motto.
- Number circles must use same bounding box for circle and text.

## F. Three-Row Lessons

Use for three insights or reflection points.
- Three full-width rows.
- Each row: numbered circle, title/subtitle, bullet list, icon circle + tag.
- Bottom: one takeaway band.

## G. ME2026 Template

Use this as the single public ME template path. It is based on the uploaded ME2026 reference deck assets, but it is no longer limited to APP or WhatsApp pages.
- Cover: full-bleed extracted triangular background, extracted MeetSocial Group logo near upper-left, large editable white title, extracted MEET EXPERIENCE logo near lower-left.
- Index: left white panel with `目录 / INDEX`, right extracted triangular background with a blue overlay, editable numbered list, footer logo on the left and page number on the right.
- Thank You: left extracted triangular background panel with editable `THANK YOU` and tagline; right white Contact Us area with editable city text, extracted MeetSocial logo, retained official-account QR, editable `黏贴个人联系方式` placeholder in place of the personal/contact QR, and editable page number.
- Content base: white page, compact top-left Chinese title, optional blue subtitle, extracted logo footer on the left, page number on the right.
- High-end consulting content page: conclusion-first title, one main proof object or screenshot, insight/value panel, and concise takeaway.
- Journey matrix: four-column customer journey, left vertical labels, blue pain-point pills, editable solution cards, and bottom service band.
- API flow: left capability blocks for account/template/message management; right message-flow diagram between WhatsApp customer, Meetbot, and enterprise system. Use two clear zones plus one connector, not a dense architecture poster. Capability labels should be shortened, grouped into larger cards, and kept at 9pt or larger. Flow nodes should be large enough for readable labels, with arrows aligned to lane centers and no tiny grey node clusters.
- Comparison analysis: use editable matrices and horizontal icon cards for strategy, diligence, growth, operations, and scenario advice. Use ME2026 icon keys instead of competitor logos or screenshots.
- Icon/title card rows: the icon circle and card title must use one shared vertical center; body copy starts in a separate text zone.
- Stacked insight rows: when a compact card contains an icon, title, and one-line explanation, use a fixed row rectangle with an icon slot and two non-overlapping text zones. Do not squeeze a full card component into a short row.
- White consulting timeline: use `addME2026ConsultingTimeline()` for sparse white-background milestone pages. The grammar is a left-top two-line title, one light grey horizontal axis, large month nodes, small event nodes, and alternating vertical date annotations. Use ME2026 blue/purple/teal colors, not third-party green/yellow/black.
- White consulting icon grid: use `addME2026ConsultingIconGrid()` for sparse icon + short-title + explanation modules. Icons may come from `assets/me-2026-app/deloitte-white-icons/`, but card text remains editable and color is normalized to ME2026.
- White consulting process rows: use `addME2026ConsultingProcessRows()` for numbered rows with one icon, one short title, and one explanation. The row number, icon, title, and body text share a single row centerline.

For this template, cover/index/thank-you images are allowed only as decorative extracted assets. Body diagrams, titles, labels, bullets, flows, tables, prices, and closing-page text must stay editable.
