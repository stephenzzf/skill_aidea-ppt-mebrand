# Translation layout and source-exception review

Read after the translation plan is confirmed, especially for dense existing decks or a selected page range. This reference complements `translation.md`; it does not grant approval or relax the deterministic validator.

## Select pages before extraction

Use `npm run translate -- select --pptx source.pptx --slides 1-20 --out source-first20.pptx --report selection.json`. Extract and map this subset, binding its hash; retain the full source hash and the original-to-output page map in the selection report. Do not reuse a mapping extracted from the whole deck against a subset. Selection preserves original slide XML and reachable assets without rebuilding objects. The subset updates Slides/Notes/HiddenSlides metadata and clears stale title/statistics caches. When the first output page differs from original P1, it removes the stale package thumbnail rather than fabricating a preview. Cross-links to omitted slides require resolution; do not silently break navigation or drag untranslated pages into the package.

## Preserve identity and meaning

Review each source paragraph with its page and object locator. In a multi-column speaker or case page, verify the source name, role, company, photograph and quote as a tuple; similar paragraph order does not imply the same person. Use one task glossary. If an official Latin name is absent, disclose a transliteration rather than inventing an official spelling.

Translate complete paragraphs before assigning English back into the original runs. Protect emphasis and hyperlinks. Chart units such as 万/亿 need semantically equivalent English scales; a numeral written out as a word must not become a different amount. A chart cache already disagreeing with its workbook is a source issue to record, not permission to update either dataset during translation.

## Fit English into the original design

1. Inspect actual frame geometry, parent-group transforms, paragraph margins, explicit breaks, shape text rectangles and font inheritance. An ellipse's usable text area is narrower than its bounding box.
2. Use concise equivalent phrasing and intentional line breaks; widen or reposition the frame, adjust spacing, then deliberately adjust font size. Preserve the page count, hierarchy, facts and object editability. Avoid word-internal breaks, one-letter lines and orphan numerals or units.
3. Check narrow workflow captions, central-circle labels, table row headers, chapter titles and source notes explicitly. Keep source text and footnotes clear of the footer. Translated labels may move within the approved layout scope; document shortened headers with their original meanings in the bilingual reconciliation.
4. Image-localization masks must not cover adjacent editable text. Review their full extent, including antialiased source glyph edges. If local masks cannot reliably clear the source text, reconstruct the approved diagram area with native shapes and English text, retaining every business label and relationship. Preserve the original image in the package and record the covering object. Do not use an image as a replacement for an editable diagram.
5. Render again after every relevant change. A readable previous preview is stale when the mapping, geometry, media or artifact changes. Inspect the actual final exported file, not only the generator source.

The task-specific heuristic fitting and OLE exception adapters used during a repair are not a universal automatic-fit engine and must not be copied into the skill as one.

## OOXML implementation details

- `wrap` belongs to `a:bodyPr`; `latinLnBrk` and `eaLnBrk` belong to `a:pPr`. Do not put paragraph-only attributes on `bodyPr`.
- Child order is significant. For text properties, fills precede `latin/ea/cs`, which precede hyperlinks and `extLst`. An autofit element belongs before the 3-D children of `bodyPr`.
- Re-read original ZIP entries after writing a copy. `ZipFile.writestr()` mutates a passed `ZipInfo`; copy it before reusing source entries, or use immutable source bytes when comparing.
- Do not serialize with a different library merely to obtain fitting behavior. Patch the permitted original XML and use the existing adaptation journal boundary.

## Validate and report source exceptions

Keep all five QA categories and their `pass / fail / not_run` states. Report content mapping, native-object retention, rendered appearance and application compatibility separately. No generic OLE allowance, empty-font alias, deleted Chinese text or source-asset exception may turn an unresolved check into PASS.

For inherited schema findings, validate the source and final artifact with the same SDK and format. Compare `(error ID, part URI, XPath, description)`, not just counts, and bind both hashes. Identical findings mean no new findings in that comparison; they do not mean SDK validation passed. Unknown plugin payloads remain unknown even if their visible frames are microscopic. The current translation `apply` still blocks unsupported OLE and unresolved chart/workbook references.

When a PDF is requested, prefer the native PowerPoint PDF for that deliverable when available. Otherwise keep any PDF export needed for visual review internal; default delivery remains the English PPTX only. On macOS, the PDF option for electronic distribution may use Microsoft's online service; choose the local print-quality export unless external transfer is authorized. A successful native open/save-copy/close/reopen does not erase LibreOffice font-audit failures or source schema errors. Keep their diagnostics separately.

## Real-case validation boundary

A 52-page source was translated as a separate first-20-page deck: 504 mapped units, seven native charts, full bilingual reconciliation and 20 native-PDF previews. The recipient accepted the English version. Ten non-brand image labels in one diagram were localized with editable native objects. Native PowerPoint open/save-copy/close/reopen passed.

Strict automated QA did not pass: the source and output retained the same 18 Office2016 / 25 Microsoft365 schema findings, source chart/workbook disagreements, opaque think-cell objects and LibreOffice font-audit limitations. This is evidence for the reviewed document workflow, not proof that all such documents are generically supported. Private documents, mappings, screenshots and repair adapters are not part of the public skill.
