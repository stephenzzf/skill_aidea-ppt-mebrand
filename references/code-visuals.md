# Code visuals in standard ME2026

Choose the required visual in the content plan. Record the slide, claim, the reason to use an interface or diagram, and the visible cues the audience should be able to point to. A product mockup shows a concrete example using fictional inputs and outcomes, with a separate editable label reading “界面示意”. An actual screenshot belongs to the existing user or URL provenance route. AI illustrations use the host imagery route.

Render the mockup from a JSON file and keep the slide title, business labels, evidence limitations and directional relationships editable in PowerPoint. For a business cycle or evidence hierarchy, use native objects for the labels and arrows. The code visual can provide an unlabelled ring or stack beneath them. Use one prominent visual where it explains the claim, and inspect the actual slide at presentation size. For a talk with a disputed visual direction, review representative pages before completing the deck when the task plan calls for it.

## Render directly from a Brief

For a `coded-diagram` slide, put the renderer's input object in `visual.spec` with `alt,x,y,w,h`. Keep the original `labels` and optional `connectors` on the slide. The normal dark-report CLI renders the spec through local Chrome at 2× and embeds the PNG in the PPTX. Local Chrome is needed for this inline route. The Brief is its reproducible source. To retain a separately viewable HTML, PNG and render receipt, pass the same spec to the standalone command below. Use one input method per visual: inline spec or a source/file pair.

Compare the first reading target and the location of qualifiers across consecutive pages. Use a native index when the reader needs to find a row. For independent measurements, make missing data visible and place the measurement conditions alongside them. Use a code drawing when its spatial structure communicates a branch, return or dependency. A small icon should identify a recurring object or action; a picture count cannot establish the origin, usefulness or quality of the picture.

## Render offline

```sh
node scripts/render_code_visual.cjs /task/visual-spec.json /task/assets/geo-demo-v1
```

The output directory must be new and its parent must exist. Chrome/Chromium is needed only for this route. The renderer discovers macOS Chrome or a Chrome/Chromium command. Set `AIDEA_PPT_CHROME` to an installed executable when needed. Text mockups use the locally installed Source Han Sans CN. Each successful run retains `source.json`, offline `visual.html`, `visual.png` at 2× density and `render.json` with source/output hashes, renderer and font results. Rendering errors, unloaded fonts and overflow stop the run. Increase the viewport or shorten/reflow the approved example if it overflows.

Use `width` and `height` in CSS pixels (260–1600 each), where height is the maximum content height for interfaces. Fields are plain text. Interface output height follows actual content. Use the resulting PNG aspect ratio for placement. Keep meaningful callouts in PPTX text boxes.

| `kind` | Content fields |
| --- | --- |
| `chat`, `demo` | `question`, `introduction`, 1–3 `answers` with `title`, `text`, `source`, optional `highlight: true`. Optional `title`, `takeaway`; `demo` also accepts `activeStep`. |
| `search` | `query`, `summary`, 1–3 `answers` as above, optional `title`. |
| `messages` | `sender`, `otp`, `message`, `action`. Use a fictional message and sample code. |
| `comparison` | Two concept views side by side: `title` and exactly two `panes`, each with `title`, 1–4 plain-text `items` and optional `view` (`list` or `messages`). Use it when the audience needs to see how two choices manifest on screen. Keep actual decision criteria, numerical comparisons and material qualifications in editable PowerPoint objects. |
| `diagram` | Page-specific geometry in `svg`, an inline SVG string with namespace and a `viewBox` matching the canvas aspect ratio. Supported shapes are groups, paths, rectangles, circles, ellipses, lines, polylines and polygons. Use plain hex, white, black or none for paint, standard strokes, transforms and opacity. Put business labels and relationship arrows that must change in native PPT objects aligned to the same coordinates. Geometry is regenerated from source. |
| `cycle`, `layers` | Dimensions only. Add business labels and connectors in PowerPoint. |

For example, a field instrument may route a measurement to two destinations and receive an acknowledgement from one of them. Sketch the sensor and the two distinct receiving objects with `diagram`. Use native labelled arrows for the outbound paths and the return. A row of three generic panels would conceal the return. If all that is needed is three sequential steps and their owners, use native shapes directly. For authentic product results, request the original capture and identify what is observable there. Keep SVG drawings self-contained, with no scripts, linked assets, embedded copy or external styles.

Run the focused browser checks with `npm run test:code-visuals`. Other deck routes do not require Chrome.

Use the [coded-diagram page role](analytical-layouts.md) to place a rendered PNG at its original aspect ratio and overlay editable labels and direction markers inside the report body. Retain the SVG or HTML source beside the asset.

## Reconcile with the planned visual

In the existing asset manifest, record the PNG as `kind: "illustration"`, `placement: "illustration"` with its `file`, `sha256`, `slide`, `placement_box` and `semantic_brief`. Set `origin: {"type":"code","visual_kind":"demo","label_shape":"GEO interface label"}`. Here `label_shape` is the PPTX object name of a native text box containing exactly “界面示意”. It applies to the interface kinds, including paired concept views.

Copy the agreed asset requirement into `required_visuals`, for example `[{"asset_id":"geo-demo","slide":4,"visual_kind":"demo"}]`. Keep the planned entry even if the asset is unavailable so that QA reports the gap. Run the usual PPT QA with `--asset-manifest` and include named editable labels and business objects in `required_editable`. In visual review, compare the pictured inputs, steps, evidence and outcomes to the corresponding slide and speaker notes. Inspect the rendered deck for label visibility, readability, cropping and hierarchy. The package cannot establish semantic fidelity from image bytes alone.
