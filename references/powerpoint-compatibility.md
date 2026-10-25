# PowerPoint package compatibility

Use this reference for a native repair prompt or serialization changes. ZIP integrity, parseable XML and a successful LibreOffice preview do not establish PowerPoint compatibility.

## Authoring boundary

Use `createPresentation()` from `brand_ppt_helpers.cjs`. It installs `pptx_compatibility.cjs` on the presentation instance's export boundary, shared by `write()`, `writeFile()` and stream output. It uses the already installed JSZip dependency; no cloud service, telemetry, Office repair or paid API is called. Preserve the existing PptxGenJS version until a replacement is separately tested.

The narrow normalizer corrects known serializer defects:

- Remove nonexistent slide-master content-type declarations; preserve actual custom masters.
- Clone a shared slide/notes theme to a separate notes theme, preserving the palette, fonts, all notes-master placeholders and every per-slide speaker note.
- Move the notes-master ID list before the slide ID list in `CT_Presentation` order.
- Remove an undefined extra axis from a 2D bar/line chart only when two defined axes remain; preserve valid 3D and secondary axes.
- Give colliding nonvisual object IDs unique values. If connectors reference a colliding ID, fail instead of guessing the connection target.
- Convert the known invalid `anchor="mid"` alias to `ctr`. Author native tables with `valign: "middle"`; unknown anchor values must still fail QA.
- Correct the known trailing apostrophe in an embedded workbook table range, retaining cell data and formulas.

It does not remove ordinary empty shapes, speaker notes, native tables/charts or arbitrary invalid elements. It is not a universal import/repair engine or a full XSD validator. Unknown corruption remains an error.

The read-only package checker also reports a `p:sp/p:txBody` with no direct `a:p` paragraph and `a:pPr` spacing children in an invalid relative order (`a:lnSpc`, `a:spcBef`, `a:spcAft`). These checks identify the slide/shape where PowerPoint may prompt to repair; they never strip or rewrite source structure. Keep Open XML SDK and native PowerPoint validation as separate acceptance evidence.

## Existing affected files

Preserve the original and write a separate candidate:

```bash
node scripts/pptx_compatibility.cjs original.pptx repaired.pptx > repair-changes.json
python3 scripts/pptx_package_checks.py repaired.pptx --json-report package-checks.json
```

Use the existing QA entry for final acceptance. It invokes `inspect_pptx.py --check-package-compatibility` and keeps findings in the structure category; other content, editability, render and visual categories retain their own states. Inspection is read-only and never normalizes the input to make it pass.

After repair compare native text, table values, chart caches/workbooks, speaker notes and media. Then render every page and inspect changed regions. If PowerPoint is present, actually open the candidate without accepting a repair action, save a separate native validation copy, close and reopen it, and check tables/charts/images. A repair confirmation dialog is a failed open, not successful compatibility evidence.

Microsoft Open XML SDK validation is useful after a native error cannot be explained by the focused checks. Keep its version, validation target and hash-bound report. SDK schema validation, native application behavior and visual/content acceptance remain separate evidence.

## Reference strength

These upstream reports informed the focused checks; the emitted package and native repro determine which issues apply:

- [Phantom masters, PptxGenJS #1444](https://github.com/gitbrent/PptxGenJS/issues/1444).
- [2D orphan chart axis, #1534](https://github.com/gitbrent/PptxGenJS/issues/1534).
- [Notes theme correction and placeholder-preservation discussion, PR #1458](https://github.com/gitbrent/PptxGenJS/pull/1458). Earlier proposals to strip the notes master were superseded; do not copy those destructive workarounds.
- [Microsoft CT_Presentation schema](https://github.com/dotnet/Open-XML-SDK/blob/main/data/schemas/schemas_openxmlformats_org_presentationml_2006_main.json).
- [Microsoft OpenXmlValidator](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.validation.openxmlvalidator.validate).

In the reproduced ME case the official SDK found table-anchor and presentation/chart structure errors that LibreOffice tolerated. Do not promote that result to a claim that every possible PPTX is now compatible with every PowerPoint version.
