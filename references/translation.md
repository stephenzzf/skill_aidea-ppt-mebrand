# Source-preserving Chinese-to-English PPT translation

## Confirm first

Use the `translate` task route. Inspect/extract/render the source, show a concrete translation and image plan, and wait for human confirmation before translating/write-back. Include source/hash/pages; audience and en-US business English; all native text plus notes/table/chart scope; protected terms/facts; source-design and fit limits; images/unsupported objects; bilingual, full-page and native-PowerPoint acceptance. A clear request or test does not bypass this step. An accepted plan authorizes its execution and scoped fixes without repeated confirmation.

The only **creation** style is standard ME2026. Translation preserves an existing source's design, including non-ME designs; it does not force a new template.

## Selected-page translation

For a confirmed partial delivery, first select the original pages with `npm run translate -- select --pptx source.pptx --slides 1-20 --out source-first20.pptx --report selection.json`, then extract and translate the subset. Selection is an OOXML package operation, not a restyle or translation. Keep the original page map and both source hashes. See [layout and source-exception review](translation-layout-review.md) for fitting and final acceptance.

## Two-stage workflow

Use Python 3 with lxml through `AIDEA_PPT_PYTHON` (the same runtime selector as QA). Scripts never call translation/image providers.

```bash
npm run translate -- extract --pptx /path/source.pptx --out /path/extraction.json
# After confirmation, the active agent translates complete paragraphs with slide context.
npm run translate -- apply --pptx /path/source.pptx --mapping /path/mapping.json --out /path/source_EN.pptx --report /path/translation-report.json
npm run qa -- --profile translate --pptx /path/source_EN.pptx --source-pptx /path/source.pptx --slides 12 --translation-mapping /path/mapping.json --translation-report /path/translation-report.json --preview-dir /path/previews --ledger /path/qa.json --write-review-template /path/review.json
```

After confirmed in-scope layout or image-text adaptation, create a strict journal and pass it to QA:

```bash
python scripts/translation_adaptations.py --source /path/source.pptx --mapping /path/mapping.json --baseline /path/deterministic-apply.pptx --candidate /path/source_EN.pptx --localization-plan /path/localization-plan.json --out /path/adaptations.json
npm run qa -- --profile translate --pptx /path/source_EN.pptx --source-pptx /path/source.pptx --slides 12 --translation-mapping /path/mapping.json --translation-report /path/translation-report.json --translation-adaptations /path/adaptations.json --preview-dir /path/previews --ledger /path/qa.json
```

If an image-localization pass produced a fresh journal with `slides -> new_shapes`, pass `--image-journal /path/image-localization-journal.json` instead of `--localization-plan`. The adapter reads the current shape IDs and source wording (including `note.source_text`) each time, then validates the exact candidate. Do not reuse an older normalized plan after the image journal changes.

The journal builder binds source, mapping, deterministic apply baseline and final PPTX hashes. It collects only allowlisted geometry/typography edits and explicitly registered native objects. `mask` and `decoration` shapes contain no text; `localized-text` records exact source text plus English and preserves protected numbers/terms; `annotation` is limited to fixed translation-disclosure sentences and cannot stand in for source-image translation. Every object binds its shape ID, bounds and canonical hash. Media hiding is limited to an existing `p:pic`, with a specific region reason and the exact internal image parts referenced by that picture; a journal cannot use a hidden attribute to suppress editable text. The validator independently enforces the same rule even for hand-authored journals. The builder rejects unregistered text, object, media, relationship, workbook or page changes. Without a journal, the existing strict translation contract remains unchanged. A journal records technical changes and does not claim human approval.

Pass the source's actual cover/index/closing page roles and image exceptions as needed. Do not pass the new-deck Chinese contact placeholder rule to the English deck. A raw CLI can perform write-back; human confirmation is enforced by the assistant's conversational workflow, not authenticated by a local field.

Extraction produces `schema_version:1`, `source_sha256`, all located `units`, and an object inventory. Each unit has `id`, `part/path`, `slide`, `kind`, `source_text`, ordered `segments`, `protected_tokens` and location information. `segments` correspond to original text nodes inside one paragraph (or a chart/cache/workbook text cell). Read the **whole paragraph and surrounding slide** before deciding its English wording; map equivalent emphasis back into its original text runs.

Create a mapping with the same source hash and exactly one entry per extracted unit:

```json
{
  "schema_version": 1,
  "source_sha256": "ACTUAL_SOURCE_SHA256",
  "translator": "actual translator identity",
  "plan_version": "accepted-plan-v1",
  "language": "en-US",
  "units": [
    {"id": "actual extraction id", "source_text": "exact extracted text", "segments": ["translated text"], "status": "translated"},
    {"id": "another extraction id", "source_text": "kimi-model-id", "segments": ["kimi-model-id"], "status": "preserve", "reason": "Protected model identifier"}
  ]
}
```

Do not synthesize IDs or omit English/code/number units. Keep segment count and field-backed text; preserve paragraph/list/rPr/hyperlink properties. If preserving inline styling conflicts with word order, review the mapping with full context; never drop highlighting or silently flatten all runs. A missing, duplicate, empty, stale or unlocatable mapping fails before exposing output. The first release blocks unsupported SmartArt/OLE/external charts and unresolved chart-to-workbook references; it does not silently preserve those objects as fully translated. Unsupported content must be resolved before apply; a generic “preserve” flag is not permission to leave native Chinese body text untranslated.

## Language and layout contract

- Use clear, concise business English. Preserve meaning, caution, vendor attribution, negation, process order and requested actions. Do not update source facts or infer that an old source date describes today's product.
- Maintain a task-local glossary. Protect product/model names, APIs, code, URLs, dates, amounts, unit scales and scores. Preserve code punctuation literally. Numerical unit/date localization must be semantically equivalent and explicitly reconciled; points are not percentages or percentage points unless the source says so.
- Translate titles/body, group text, table cells, notes, actual visible layout/master text and supported chart labels. Keep source notes metadata/fields that are not prose. Chart text caches and their backing workbook cells must agree; values, formulas and relationship targets remain unchanged.
- The confirmed plan authorizes **automatic typography and layout adaptation within the agreed scope**. Translation quality and visual balance come first: preserve meaning, facts and emphasis; then use concise equivalent English, line breaks/paragraph spacing, resize or reposition the existing text frame, adjust nearby spacing, and choose a suitable font fallback. Keep the original page count, reading order, content and editable objects.
- Font-size changes are allowed when needed for a polished fit. Prefer small, deliberate adjustments and maintain readable hierarchy; do not delete/reduce content, hide collisions, or use unreadable text as a fit strategy. Record each changed object and before/after box, position, typeface and size in the adjustment record.
- If the existing frame cannot fit the approved English text attractively, use the agreed native overlay/mask route for approved image text, or another in-scope layout adjustment. A page-count, meaning/facts, source, audience or image-scope change still requires an updated plan and fresh confirmation. Routine frame/font/position changes inside the confirmed plan do not.
- Record a pre-existing source defect separately from an introduced translation defect. Preserve native text, table/chart content, formulas, links, media and crop/alpha unless the confirmed image-localization plan explicitly registers a masking/visibility treatment.
- Inventory raster text, SmartArt, external charts and OLE. No blanket full-package search/replace. Unsupported visible Chinese remains a declared blocker/exception, never a silently translated success. Source brand-wordmark pictures may remain in Chinese when explicitly approved; new English body text stays editable.
- If raster labels cannot be read reliably, record the specific unreadable source image and region as an exception. A fixed disclosure annotation is transparent about uncertainty; it does not count as a translated image or make image review pass.
- Never use regex deletion of residual Chinese, arbitrary “translation pending” placeholders, inferred abbreviations or source fact omissions to pass coverage.

## QA and independent review

The existing `qa_me2026.cjs --profile translate` invokes `translation_checks.py` to re-read source/candidate/mapping and verify deterministic text, non-text OOXML, original media, native objects and workbook consistency. The apply report is hash-bound evidence, not a trusted success switch. Font environment failures remain rendering failures, not a reason to rewrite the source.

Render every source and target page. Review each pair, checking wrapping/clipping, line rhythm, emphasis, chart/table headers, caption/illustration placement, footer and contact area. Review the full bilingual mapping independently for fidelity, omissions, terminology and natural English; a back-translation score or zero residual Chinese does not establish quality.

Complete the ordinary review receipt only after review. Add:

```json
{
  "translation": {
    "mapping_sha256": "ACTUAL_CURRENT_MAPPING_HASH",
    "report_sha256": "ACTUAL_CURRENT_APPLY_REPORT_HASH",
    "language": {"status": "pass", "reviewer": "independent reviewer", "summary": "actual findings and reviewed scope", "evidence_paths": [{"path": "/actual/review.json", "sha256": "ACTUAL_HASH"}]}
  }
}
```

The language reviewer differs from the mapping's `translator`. Every visual page record also binds its actual `source_page_sha256` and `source_evidence_paths`; `source_evidence_paths` at receipt top level covers every slide. All target PNGs and renderer signatures must match the current candidate. Relevant mapping/artifact/image changes invalidate review.

Deliver only the separate English PPTX by default. Keep the glossary, bilingual reconciliation, source exceptions, fit-adjustment record, actual confirmation reference, full-page renders, QA ledger and native compatibility evidence in the internal task working/QA directory. Provide PDF, previews or those evidence files only when requested; follow [default output](../SKILL.md#default-output). PowerPoint open/save-copy/close/reopen and SDK validation are separate from LibreOffice preview. Missing required evidence remains partial.

## References and reuse boundaries

- [DeepL document/glossary workflow](https://support.deepl.com/hc/en-us/articles/28876387688604-About-DeepL-AI-connectors): borrow glossary/style separation, not implicit external upload/API billing.
- [TranslatePPTX](https://github.com/HomerReid/TranslatePPTX): extraction/replacement stages; GPL implementation is not copied.
- [pptx-translate](https://github.com/Vncntvx/pptx-translate): run-aware OpenXML and coverage ideas; repository claims do not prove ME runtime quality.
- [pptx-translator](https://github.com/abelgomez/pptx-translator): terminology protection and explicit post-review limits; LGPL code not copied.
- [python-pptx text documentation](https://python-pptx.readthedocs.io/en/stable/api/text.html): whole paragraph `.text` assignment replaces content/runs; avoid it for faithful OOXML patching.

The local historical 38-page translation script removed residual Chinese in a fallback. Its old zero-residual metric is not proof of completeness and that behavior is not reused. Examples and old artifacts do not create a cross-task factual knowledge base.

For language acceptance, `mapping.translator` is required and differs from the normalized reviewer identity. This records declared roles; it does not authenticate people. For source pictures, add `translation.image_review` to the receipt with `status`, `source_sha256` and one `items` record per inventory `media_parts` entry: `{part, disposition: "no_translation_needed"|"preserve_brand", reason}`. Review all visible uses of those parts. Chinese brand wordmarks are the accepted preserve exception; other untranslated raster text is unresolved and blocks completion. A missing image review is not_run, while a claimed pass with missing/duplicate/unresolved items fails.
