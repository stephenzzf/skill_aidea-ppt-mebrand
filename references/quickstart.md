# ME2026 quickstart

The only creation style is standard ME2026. Routes: `new`, `rebuild`, `targeted-fix`, `translate`. Photos and AI illustrations are optional assets within this style.

For every task, inspect the input, clarify material gaps, show the content and image plan, and **wait for human confirmation** before producing a candidate or image. Clear requirements and test requests do not bypass this step. Once the shown plan is accepted, perform its generation, QA and fixes without repeated confirmation. See [confirmation](intake-and-confirmation.md).

## Commands after confirmation

```bash
npm run generate -- --scenario eclick --out /path/to/deck.pptx
npm run qa -- --pptx /path/to/deck.pptx --slides 8 --profile new --allow-fullslide 1,2,8 --page-role 1:cover --page-role 2:index --page-role 8:closing
npm run translate -- extract --pptx /path/to/source.pptx --out /path/to/extraction.json
npm run translate -- apply --pptx /path/to/source.pptx --mapping /path/to/mapping.json --out /path/to/deck_EN.pptx --report /path/to/translation-report.json
npm run qa -- --pptx /path/to/deck_EN.pptx --slides 12 --profile translate --source-pptx /path/to/source.pptx --translation-mapping /path/to/mapping.json --translation-report /path/to/translation-report.json
npm test
```

Use an appropriate `AIDEA_PPT_PYTHON` with lxml for translation, plus PyMuPDF/Pillow for rendering. Read [translation](translation.md) before creating the mapping; extract is read-only and may run before plan confirmation.

Scenarios: `smoke`, `realistic`, `teemo`, `eclick`, `ai-capability`, `video-localization`, `component-catalog`, `icon-catalog`. These are fixture topics, not template styles. Retired style parameters fail explicitly.

Deliver editable PPTX, confirmed plan, QA ledger, full-page renders and accepted limitations. Translations additionally deliver bilingual reconciliation, glossary and adjustment record. Automated regression success does not constitute human language/visual acceptance. Source-specific closing text and image exceptions must match the route; do not impose Chinese placeholders on an English translation.

Supporting native images follow [native imagery](native-imagery.md). A generation scenario command does not invoke an image service. Sync commands apply only from a real Git source checkout; an installed skill is not a source repository.
