---
name: aidea-sop-ppt-mebrand
description: Create, rebuild, repair, and translate editable PowerPoint presentations with the standard ME2026 brand system. Use for ME / Meet Experience / 觅跃科技 / 飞书深诺 PPTX creation, source-preserving repairs, PDF-to-editable rebuilds, Chinese-to-English PPT translation, supporting native-host illustrations, and presentation QA. Show a concrete content and image plan and wait for human confirmation before producing any candidate deck, including test decks.
---

# Aidea SOP PPT ME Brand

Use one creation style: **standard ME2026**, editable 16:9 PPTX with the official Cover / Index / Thank You assets, brand colors, fonts, icons and footer. Existing-deck translation preserves the source design; it does not restyle the source. Never flatten core text, charts, tables or workflows into slide images.

## Workflow and mandatory confirmation

`Read source -> Clarify missing requirements -> Present content and image plan -> Wait for human confirmation -> Prepare assets / Translate -> Generate -> QA -> Internal visual review -> Deliver PPTX`

**Every new task requires a concrete plan and human confirmation before creating a candidate PPTX, writing translations, generating slide mockups or invoking image generation.** This includes new decks, translations, rebuilds, targeted repairs and test decks. A detailed request, “继续测试”, or “直接生成” does not replace confirmation of the plan you show. Read-only source extraction, inspection and source rendering are allowed before confirmation.

Ask only for missing information that materially changes the result. Put known requirements into the plan. Include purpose/audience, route, slide count or target pages, page claims or source-preservation scope, content permissions, sources, missing facts, image plan (including zero-image/reuse plans), deliverables and acceptance checks. Then stop and wait. If the user revises the plan, show its updated version before execution.

An explicit instruction to implement a plan already shown and confirmed authorizes its scoped generation, QA, regressions and fixes; do not ask again. Changes to page count, target pages/regions, repair method (local fix versus rebuild), factual/content permissions, sources or image scope require an updated confirmation. Record the actual conversation confirmation and plan version beside the artifact; scripts cannot manufacture human approval. See [intake and confirmation](references/intake-and-confirmation.md).

For translation, a confirmed plan includes automatic adjustments to text-frame size, position, spacing, typeface and font size needed for a polished layout. Do not ask again for these in-scope fit corrections; preserve the agreed page count, business facts, source design and editability. See the [translation layout contract](references/translation.md#language-and-layout-contract).

## Task routes

| Route / QA profile | Behavior |
| --- | --- |
| `new` | Standard ME2026 creation from a confirmed outline, sources and image plan |
| `rebuild` | Source-preserving editable reconstruction, including image-heavy PPTX/PDF; reconcile every source page |
| `targeted-fix` | Concrete page/region repair, whole-deck structural QA plus before/after target/adjacent-page review |
| `translate` | Chinese-to-English translation in the original deck, preserving page count, objects, formatting and protected facts |

Whitepaper and white consulting creation styles are retired. Do not offer or emulate them as alternative templates. This retires separate page systems, not the consulting-style information grammar already used within ME2026: semantic icons, proof cards, metric modules, comparisons and process diagrams remain available. Built-in scenarios are regression fixtures in standard ME2026, not additional styles.

## References by task

- Read [quickstart](references/quickstart.md), [intake](references/intake-and-confirmation.md), [brand rules](references/brand-guidelines.md), and [implementation notes](references/implementation-notes.md).
- For translation read [translation](references/translation.md) and its [layout/source-exception review](references/translation-layout-review.md); use the deterministic extract/apply helpers instead of rebuilding imported decks.
- For images read [native imagery](references/native-imagery.md). Supporting photos/illustrations are available within standard ME2026.
- For layout selection read [layout templates](references/layout-templates.md); for proposals read [solution patterns](references/solution-patterns.md).
- For rebuilds and marked repairs read [advanced rebuild](references/advanced-rebuild-playbooks.md).
- For an explicitly requested official presentation method read [method reference](references/official-presentations-method.md).
- Before delivery read [QA contract](references/qa-and-content-contract.md). After a repair warning or serialization change read [PowerPoint compatibility](references/powerpoint-compatibility.md).

## Standard ME2026 authoring

- Create new decks with `createPresentation()` from `scripts/brand_ppt_helpers.cjs`. Its export boundary corrects known PptxGenJS package defects for write/writeFile/stream; do not bypass it with a raw constructor.
- Use `ME2026_TOKENS`, `ME2026`, `ME2026_LAYOUT` and a 13.333 × 7.5 inch canvas. Body pages use `addME2026WhiteBase()`.
- Cover/Index/Thank You and logos retain extracted brand assets. Titles, body, directory rows, workflows, tables, charts, page numbers and closing text stay editable. Use `addME2026ThankYou()`; Chinese new-deck contact placeholder is `黏贴个人联系方式`, translated decks localize it.
- Reuse the public semantic icon registry and icon/title/row helpers to give related concepts a consistent visual cue. New ME2026 icon cards/rows should use a coherent icon appearance and a blue or purple theme aligned with the title; retained icon-card/row helper signatures and defaults remain compatible. Choose among cards, proof rows, process paths, tables and diagrams according to each page's claim; do not repeat one card grid across the deck. Keep table-to-follow-up spacing at least `ME2026_LAYOUT.tableAfterGap` / `tableNoteGap` and visible parent-card padding. For public-talk decks use the readable type hierarchy in [brand rules](references/brand-guidelines.md), and set `autoShrink: false` on the icon card/row helpers when the planned type size must be preserved. For creation, enlarge or reflow content rather than silently shrinking it; after a translation plan is confirmed, automatically refine text boxes, positions, font sizes and suitable font fallback within that scope, without repeated confirmation.
- Custom icon placement must respect the center-coordinate contract of `addME2026IconBadge()`; keep the entire badge inside its parent card and align it with its text row. Paired metrics use matching value/label/note zones; reject accidental one-character wraps in compact labels. See the concrete [placement contract](references/implementation-notes.md#icon-and-metric-placement-contract).
- Never invent official screenshots/logos, customer proof, metrics or facts. Distinguish simulated examples and fictional AI scenes from real evidence.
- Use only the current host's available native image tool after the image plan is confirmed. For an explanatory image, define its page claim, subject, action, inputs, outputs and required visual cues before choosing style; first decide whether an editable native diagram, table or chart explains the relationship better. Images are optional, and decorative assets do not carry factual claims. Review each image's relevance, clarity and integration separately; a missing review is not a pass. Scripts consume saved assets and never silently select an API, cloud project or paid fallback. Keep semantic brief, prompt/origin/hash/placement in an asset manifest. See [native imagery](references/native-imagery.md).
- Independent photos, illustrations and quiet body decorations are optional. Keep core copy/data editable, preserve aspect/alpha and label fictional scenes where needed. Do not force imagery onto data/table pages.

## Commands after plan confirmation

```bash
npm run generate -- --scenario eclick --out /path/to/deck.pptx
npm run translate -- select --pptx /path/to/source.pptx --slides 1-20 --out /path/to/source-first20.pptx --report /path/to/selection.json
# Omit select when translating the whole deck. Extract the selected file if used.
npm run translate -- extract --pptx /path/to/source-first20.pptx --out /path/to/extraction.json
npm run translate -- apply --pptx /path/to/source-first20.pptx --mapping /path/to/mapping.json --out /path/to/deck_EN.pptx --report /path/to/translation-report.json
# For approved layout/image-text adaptation, build a journal with scripts/translation_adaptations.py and pass --translation-adaptations <journal.json> to QA.
npm run qa -- --pptx /path/to/deck.pptx --slides 8 --profile new --allow-fullslide 1,2,8 --page-role 1:cover --page-role 2:index --page-role 8:closing
npm test
```

Scenario names: `smoke`, `realistic`, `teemo`, `eclick`, `ai-capability`, `video-localization`, `component-catalog`, `icon-catalog`. Test execution belongs to the confirmed task; it does not confirm a future user deck.

## Default output

For all routes, deliver **one final editable `.pptx` by default**. “PPT” means PPTX, not the legacy binary `.ppt` format. The plan should say “deliverable: editable PPTX” when no other formats were requested; do not add an extra format-selection question.

PDFs, slide images/contact sheets, bilingual spreadsheets, glossaries, QA reports, source code/assets and ZIP bundles are optional user-facing deliverables. Provide them only when explicitly requested, including requests already present in the confirmed plan. Do not automatically create a polished delivery PDF or an all-files bundle.

Keep required full-page rendering, visual checks, bilingual reconciliation and audit records as internal working evidence. Store the plan, mapping, glossary, adjustment records, render PDFs/PNGs, validation copies and QA ledgers in a separate task working/QA directory; keep the delivery directory limited to the final PPTX unless additional files were requested. This changes the delivery surface, not the quality gate.

In the final response, link the PPTX and briefly state the actual QA outcome and any material limitations. Do not list or attach internal evidence, extra formats or intermediate versions by default. Missing required checks still prevent full acceptance, even though only one file is delivered.

## QA and delivery

Use `scripts/qa_me2026.cjs`. Content, structure, editability, render and visual review each use `pass / fail / not_run`. Missing mandatory evidence is incomplete, never PASS. Translation adds source/mapping reconciliation to these existing categories.

Check native objects and transformed groups, package relationships/IDs/chart/workbook validity, actual font resolution, all-page rendering and per-page visual evidence. Image coverage, tiny type and density are risks to adjudicate against source and page role. Zero measured contrast coverage requires visual review. Bind evidence to the current artifact hash and rendering environment; relevant changes invalidate review.

Deliver only the final editable PPTX unless extra files were requested, following [default output](#default-output). Retain the confirmed plan and QA evidence internally; translation also retains its bilingual reconciliation, glossary and adjustment record internally. Report native PowerPoint open/save-copy/close/reopen separately from LibreOffice and SDK validation. Commit task-owned changes only in an actual Git source checkout; never initialize a repository or manufacture an empty commit in an installed non-Git skill.
