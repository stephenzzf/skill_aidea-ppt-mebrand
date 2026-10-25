# ME2026 QA and content contract

The shared entry point is `scripts/qa_me2026.cjs`. Do not create a second QA pipeline or treat a total score as acceptance.

## Routes and states

| Profile | Required evidence |
| --- | --- |
| `new` | Confirmed content/brand contract, per-page editability, all-page rendering and visual review |
| `rebuild` | Above plus `--source-pptx`, source-content comparison, duplicate-object review and justified retained images |
| `translate` | `--source-pptx`, `--translation-mapping`, `--translation-report`, optional `--translation-adaptations`, complete bilingual reconciliation, all source/candidate page renders and language/layout review |
| `targeted-fix` | `--source-pptx`, `--target-slides`, whole-deck structure, source/candidate target and adjacent-page review, marked crops and unchanged-page preservation |

Each of content, structure, editability, render and visual is `pass`, `fail` or `not_run`. Exit code 0 is full acceptance; 1 is failure; 2 is partial. `--no-preview` still runs available checks but cannot complete final acceptance. Quick Look thumbnails do not replace full-page renders.

Example (use unique task paths):

```bash
node scripts/qa_me2026.cjs \
  --pptx /path/to/task/deck.pptx --profile new --slides 8 \
  --allow-fullslide 1,2,8 --page-role 1:cover --page-role 2:index --page-role 8:closing --required-text '黏贴个人联系方式' \
  --preview-dir /path/to/task/previews --ledger /path/to/task/qa.json \
  --write-review-template /path/to/task/review.json
```

The review template starts with `not_run`. Inspect the actual pages and reconcile source content before recording pass. Supply the completed file via `--review-receipt /path/to/task/review.json`. Never sign a receipt automatically as part of generation or regression tests. Reviewers must record evidence and limitations, not just a success boolean. A regenerated artifact, changed page image, or changed rendering environment invalidates affected review evidence.

Use `--page-role 1:cover` (repeat per page) where the default role does not represent the document. `--allow-fullslide` permits a known decorative background; it does not authorize picture-only body content or an editable text requirement to disappear. Review source-specific photo/logo exceptions explicitly. Do not pass a new-deck contact rule to a one-page source repair.

## Rendering environment

Use installed LibreOffice, Fontconfig and a Python with PyMuPDF/Pillow. Select a non-default runtime with `AIDEA_PPT_PYTHON` and `AIDEA_PPT_SOFFICE`; dependencies and their actual versions belong in the ledger. The renderer creates a private Fontconfig configuration/cache and LibreOffice profile. It must verify requested fonts resolve correctly before rendering. Missing fonts are an environment failure, not evidence that the slide text should be rewritten.

Keep all slide PNGs, page count and artifact hashes. Preserve PDF parser warnings separately; successful rendering does not establish that PowerPoint will behave identically. PowerPoint-native and commercial-product tests require their own evidence.

## Interpreting checks

- Native text, tables/charts and nested group coordinates participate in structural inspection. An entirely off-canvas object is a defect.
- The QA entry also enables focused [PowerPoint package compatibility checks](powerpoint-compatibility.md). The checker never rewrites its input. An old file with a repair warning must fail these checks even if LibreOffice renders it; repair into a separate file, rerun the checks and invalidate the old review receipt.
- When native PowerPoint is available, verify open, save to a separate validation copy, close and reopen after a compatibility repair. Record the actual application/version, artifact hash and observed result. Discover the installed app by bundle identity rather than assuming a fixed filename. Report this separately from LibreOffice and SDK validation.
- Object-level editability is separate from total text count. A body page containing two half-page images and no editable text must fail its editable-body contract.
- Image union/coverage, small text, density, narrow boxes and overlap are clues. Classify them by page role, visible effect and the user's source-preservation requirements.
- For new ME2026 decks, visually compare each page with the confirmed visual plan: the chosen pattern should make its claim easier to follow, related concepts should use consistent icons, cards should have visible padding, and title/body/table/source-note levels should remain distinct. Do not treat the number of icons or cards as a quality score, or require every page to contain a card.
- For public talks, check that the planned `28–30pt` title, `22–24pt` card title, `20–22pt` body and `18–20pt` table type remain legible in the rendered page. Source notes may be smaller, but qualifications that materially change a claim must remain adjacent to it. If `autoShrink: false` is used, resolve fit risks by adjusting geometry or copy and confirm the requested size stayed intact.
- For custom icon cards, inspect a crop that includes the parent border: the whole badge must be inside with visible padding. Compare badge center with the adjacent title/full text row, including two-line labels. A generic overlap or canvas-boundary pass does not prove this alignment.
- For repeated metric cards, compare value, label and note baselines in the same crop; reject accidental one-character final lines or mixed one-/two-line labels that displace the hierarchy. For a marked repair, retain before/after crops for every marked region and check the final rendered version after the last layout change.
- Definite text/container backgrounds permit contrast calculation. Unknown image/gradient backgrounds require visual review; zero measured coverage cannot mean contrast passed.
- For faithful repairs, separate route-inapplicable checks, source-existing risks and introduced defects. Retain original risk counts and before/after details. Do not lower thresholds to make a baseline pass.
- Manually review duplicate text/image layers in rebuilds. A structure scan alone cannot prove that no duplicate visual content exists.

## Lightweight content plan

Store the confirmed outline beside the PPTX (Markdown is sufficient). Record audience, purpose, `preserve|summarize|reorganize`, allowed layout changes, source references, page roles, key facts, required editable objects, image exceptions and unresolved placeholders. Optional JSON is a portable plan, not a mandatory `--spec` compiler.

For every page, reconcile the title, core claim, amounts, dates, product names, SOP ordering and action requests. Preserve is the default for repairs/rebuilds. Summarization/reorganization needs the corresponding authorization and a record of omissions or movements. A visual adjustment cannot silently remove facts.

Built-in scenarios are simulation/regression fixtures. Their screenshots, market comparisons and sample facts are not verified customer evidence. Do not promote them to real business claims merely because they render correctly.

## Regression evidence

`npm test` runs contract tests plus all built-in scenarios and the icon catalog in a fresh task directory. Its summary distinguishes automated status from final acceptance. It never fills visual receipts with pass. Review the rendered pages and retained negative fixtures separately. Retain incomplete and failing cases; do not omit them from aggregate totals.

## Design references

The workflow borrows the separation of preservation and recreation from [Gamma import](https://help.gamma.app/en/articles/11047840-how-can-i-import-slides-or-content-into-gamma), content permissions from [Plus AI Remix](https://guide.plusai.com/ai-for-presentations/remix-slides), explicit editable export/font limits from [Beautiful.ai](https://support.beautiful.ai/hc/en-us/articles/30629528652685-Exporting-your-slides-and-presentations), render/review discipline from [PPTAgent](https://github.com/icip-cas/PPTAgent), and separate content/visual/editability dimensions from [SlidesGen-Bench](https://github.com/YunqiaoYang/SlidesGen-Bench). These are methodological references, not imported code or proof of present competitor quality. No telemetry, cloud-project selection or implicit API image generation is introduced. Optional native-host imagery follows the confirmed image plan and host usage limits.

## Native image assets

Use optional `--asset-manifest` with the existing QA entry. The ledger and review receipt bind its hash; file/source/media/page/alpha/object mismatches fail their applicable categories. `--page-role N:section` identifies source section pages. A decorative background exception does not exempt core text or data from editability. Use per-object `required_editable` declarations for critical tables, charts, flows and body text. See [the manifest guide](native-imagery.md).

New explanatory images should carry `asset.semantic_brief` with `page_claim`, `subject`, `action`, `inputs`, `outputs` and `required_cues`. Existing manifest entries without a brief stay compatible, but that legacy path is not evidence that an explanatory image passed semantic review. When a brief exists, record one `asset_manifest.asset_reviews` entry per asset:

```json
{
  "asset_id": "workflow-illustration",
  "relevance": "pass",
  "clarity": "pass",
  "integration": "pass",
  "notes": "Required source, review and approved-output cues are visible at the placed size.",
  "evidence_paths": ["previews/slide-07.png", "previews/slide-07-asset-crop.png"]
}
```

Each status is `pass`, `fail` or `not_run`. A semantic visual pass requires all three to be `pass` and concrete evidence paths. Review `relevance` against the claim and required cues; `clarity` against whether the subject/action remain legible at the placed size; and `integration` against crop, scale, palette, surrounding native content and slide balance. If the brief is absent or evidence is missing, do not describe the image's semantic review as passed. Decorative images may be labelled decorative and reviewed for clarity/integration without being treated as claim evidence.

For controlled monochrome icons, compare the actual rendered PNG glyph with its actual badge/card background. Use `3:1` as an internal minimum legibility baseline for meaningful non-text graphics, based on [W3C WCAG 2.2 non-text contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html); this is not a claim that the PowerPoint deck or all its content meets WCAG. Thin strokes and antialiasing may look fainter, so a numerical pass does not replace visual inspection. Unknown, multicolor or image/gradient backgrounds remain `not_run` until visually reviewed. Color coherence with the title and neighboring cards is a separate design check; contrast alone does not make a mismatched icon look right.

Font matching preserves Unicode, rejects empty names and validates aliases against selected font-file metadata. Every visible OOXML text run is checked by script against its corresponding PDF span: the Latin face must cover the Latin text and the East Asian face must cover East Asian text. Repeated identical text occurrences are checked separately; a page-level font union cannot hide a fallback. If span evidence is absent, the run is unverified and fails rendering acceptance. Referenced layout/master tables are visible translation content just like static shape text. The task-private Fontconfig may reference installed Microsoft Office DFonts and optional `AIDEA_PPT_FONT_DIRS`; it never copies/installs fonts or changes system configuration. Record PPTX embedded font parts separately from actual PDF font usage. An embedded part alone is not proof the renderer loaded it. Missing/substituted fonts retain diagnostic previews but fail rendering acceptance; never rewrite source text to accommodate missing fonts.

## Translation evidence

The translate profile revalidates the source/candidate/mapping hashes and deterministic write-back through `translation_checks.py`, not only a supplied success field. Without an adaptation journal, keep the original strict OOXML/geometry contract. When authorized layout or image-text adaptation changed the candidate, the journal must bind the deterministic apply baseline and final candidate, and every change must match the narrow object/property/localization allowlists. New mask/decoration objects contain no text; localized text binds the source wording, and annotations accept only fixed transparent disclosures that cannot replace translation. Every registration binds object ID, bounds and canonical hash. Hiding an original visual is permitted only for a `p:pic` with a specific region reason and an exact list of its related source image parts; it cannot hide a native text shape. Translation failures enter content/structure/editability within the existing five categories. Require page-level source PNG evidence for every translated page and independent language reconciliation; missing evidence stays not_run. Protect numeric values, dates, currencies, units, APIs, code, links and factual limits. Known raster brand text is an explicit exception, never a reason to delete editable Chinese. Hidden unused layout prompts are excluded only when OOXML relationships and placeholder metadata prove they are not slide content; visible layout/master text and speaker notes remain in coverage. See [translation](translation.md).

The internal task record retains the concrete plan and actual human confirmation reference, bound to the delivered deck. Default delivery is the final PPTX only; render PDFs/PNGs, bilingual records and QA ledgers remain internal unless the user requests them. Follow [default output](../SKILL.md#default-output); do not skip checks to reduce the number of delivered files. Regression receipts never invent this approval or mark language/visual checks as pass.
