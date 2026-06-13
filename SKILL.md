---
name: aidea-sop-ppt-mebrand
description: Generate, repair, rebuild, or style-upgrade editable 16:9 PPTX decks in the Aidea SOP / ME / Meet Experience / 觅跃科技 / 飞书深诺 brand system from outlines, SOPs, solution briefs, business-review content, internal AI application showcases, or existing image-heavy PPTX files. Use the unified ME2026 template for ME-branded presentation creation, high-end technical consulting style upgrades, industry-solution proposal decks, PPT quality/brand validation, and converting screenshot-like PPTX pages into editable text, shapes, tables, and diagrams where Codex should use pptxgenjs, Lucide icons, OOXML inspection when needed, and built-in QA checks.
---

# Aidea SOP PPT ME Brand

Default to the unified `ME2026 模板`: editable 16:9 PPTX, extracted ME2026 Cover / Index / Thank You assets, ME2026 color tokens, public-safe icons, consistent footer, and automated QA. Do not create final decks from full-slide screenshots or AI-generated slide images.

## Workflow

Use this production flow for formal PPT work:

`Intake -> Content Gate -> Generate -> QA -> Preview -> Deliver`

1. Create a task workspace under `/tmp/aidea-sop-ppt-mebrand/<task-slug>` for generated scripts, previews, and QA output.
2. Read references by route:
   - Always read `references/quickstart.md`, `references/intake-and-confirmation.md`, `references/brand-guidelines.md`, and `references/implementation-notes.md`.
   - Read `references/layout-templates.md` for ME2026 component/layout selection.
   - Read `references/solution-patterns.md` for industry-solution or proposal decks.
   - Read `references/official-presentations-method.md` only when the user asks for the official presentation path.
   - Read `references/advanced-rebuild-playbooks.md` for high-fidelity rebuilds, PDF-to-PPT, or red-box repair workflows.
3. Run `Intent Gate` for formal new decks: confirm goal, audience, source boundary, success criteria, and deliverables.
4. Run `Content Gate` before formal generation: show slide count, outline, one core claim per slide, proof object, missing facts, non-fabrication boundary, and visual path.
5. Generate an editable PPTX using `scripts/brand_ppt_helpers.cjs`, preferably through `scripts/generate_me2026_deck.cjs` for built-in scenarios.
6. Run `scripts/qa_me2026.cjs` or equivalent `inspect_pptx.py + check_me2026_layout_risks.py + Quick Look` checks.
7. Deliver the PPTX plus QA ledger, preview path, and accepted limitations.

## Confirmation Gates

Do not generate a formal new PPTX until the user confirms the plan, unless the prompt clearly opts out.

Compressed confirmation is allowed when the user says:

- `继续测试`
- `做一个测试`
- `PLEASE IMPLEMENT THIS PLAN`
- `无需确认直接生成`
- A concrete red-box repair with screenshots/pages already provided

Compressed gates still require QA.

## Task Routing

- `me2026-template`: default for all normal ME-branded creation, repair, style upgrade, solution decks, and internal showcases.
- `new deck`: use Intent Gate and Content Gate, then generate.
- `long-form conversion`: first propose page split and claims; generate after Content Gate.
- `scenario test`: use `npm run generate -- --scenario <name>` and `npm run qa -- ...`; do not ask unnecessary questions.
- `targeted-fix / light fix`: repair concrete issues such as footer drift, icons, text overflow, alignment, spacing, or small overlaps.
- `targeted-fix / rebuild path`: use when the source is image-heavy, non-editable, has full-slide screenshots, tile backgrounds, blank occlusion layers, or text-bearing `grpSp` as main content.
- `high-end consulting style`: keep ME2026 assets/colors/footer but use claim-first structure, one primary proof object, restrained insight/value panels, and fewer larger modules.

## ME2026 Build Rules

- Slide size is `13.333 x 7.5`.
- Use `ME2026_TOKENS`, `ME2026`, and `ME2026_LAYOUT` from `brand_ppt_helpers.cjs`; avoid new magic numbers.
- Cover, Index, and Thank You use extracted PPTX assets only. Body text, titles, diagrams, tables, page numbers, and closing-page text remain editable.
- Thank You must use `addME2026ThankYou()`. The right contact QR is replaced by editable placeholder text `黏贴个人联系方式`.
- Content pages use `addME2026WhiteBase()` by default.
- Use `ME2026_ICON_LIBRARY`, `prepareME2026IconCache()`, `addME2026IconBadge()`, `addME2026IconTitleCard()`, `addME2026StackedIconRow()`, and `addME2026LabelTextRow()` instead of hand-placing icon/text coordinates.
- Use white consulting components only through `addME2026ConsultingTimeline()`, `addME2026ConsultingIconGrid()`, and `addME2026ConsultingProcessRows()`. Do not use Deloitte dark pages, logos, footer, or palette.
- Keep table/grid follow-up modules at least `0.30"` below the table bottom. Use `ME2026_LAYOUT.tableAfterGap` or `ME2026_LAYOUT.tableNoteGap`.
- Keep text inside its parent card/frame with visible bottom/right padding. If content is too dense, enlarge, shorten, or split; do not shrink below readable thresholds.
- Do not invent product screenshots, official logos, customer proof, metrics, dates, or factual claims not provided or sourced.

## Standard Commands

Generate a built-in scenario:

```bash
npm run generate -- --scenario eclick --out /tmp/feishu-vs-eclick-me2026-test.pptx
```

Run the unified ME2026 QA:

```bash
npm run qa -- \
  --pptx /tmp/feishu-vs-eclick-me2026-test.pptx \
  --slides 8 \
  --allow-fullslide 1,2,8
```

Run all regression tests:

```bash
npm test
```

Sync to the installed Codex skill:

```bash
npm run sync:installed
npm run check:installed
```

## QA Gates

Every final PPTX must pass:

- Editable text exists (`inspect_pptx.py --print-style-summary` reports meaningful `text_chars`).
- No full-slide images on content pages; only Cover / Index / Thank You may be allowlisted.
- Header safe zone, integer font sizes, minimum font size, ME2026 footer logo alignment, icon card alignment, and label row alignment.
- `check_me2026_layout_risks.py`: tiny text boxes, long narrow labels, text/icon overlap, table-to-module crowding, parent-card containment, and low contrast where OOXML colors are explicit.
- Quick Look preview when available.

Use `scripts/qa_me2026.cjs` as the default wrapper.

## Scenario Names

Built-in `generate_me2026_deck.cjs` scenarios:

- `smoke`
- `realistic`
- `teemo`
- `eclick`
- `ai-capability`
- `video-localization`
- `deloitte-white`
- `component-catalog`
- `icon-catalog`

## Delivery Notes

Final responses should include:

- Generated/modified files.
- Main changes and why.
- Tests and validation results.
- Unexecuted checks with reasons.
- QA ledger and preview paths.
- Whether the PPTX is editable.
- User-visible change summary.

If code or skill files changed in the repository, create a local conventional commit. Do not push unless the user explicitly asks.
