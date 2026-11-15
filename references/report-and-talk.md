# Report and talk planning in standard ME2026

Choose the content scenario at the existing Content Gate. Record audience, reading distance or time available, source version, permission to preserve/summarize/reorganize, and evidence requirements. Write the main claim and its support for each page. Approve page count, retained facts and image scope before generation. Use the same ME cover, index, white base, closing, footer and editable objects.

| Scenario | Plan each page around | Carry in notes or appendix |
| --- | --- | --- |
| Report / whitepaper content | Judgment, evidence, qualifying condition, decision or action | Complete method, source and page references, detailed tables and definitions |
| Public talk | One judgment, a visual or demonstration that makes it clear, and a transition | Talking points, timing, fallback demonstration steps and complete source details |

For new report pages, plan 16pt body text, 12pt minimum for table text and chart labels, and 10pt minimum for source notes. Screen-readable tables can split into a summary and a marked continuation with repeated headers and row keys. Keep auto-pagination off when the count is confirmed. For a public talk follow the [ME typography hierarchy](brand-guidelines.md), including 20–22pt primary text. Use `autoShrink: false` for fixed-size content, reflow or shorten within the approved scope, and ask for a revised plan if changing page count or omitting a fact. Apply source-specific requirements to repair and translation.

## Composition recipes

- **Judgment and evidence.** Use an editable headline, native chart or matched metric boxes, adjacent qualification and readable source line. Keep dates, denominators, samples, units and forecast status with the numbers. Prefer separate charts for different measures. A native chart should include the underlying workbook and match its labels and numbers.
- **Phase and deliverable.** Draw directional connectors only for sequence. Put parallel evaluation criteria in a separate row. Align each phase with its owner, decision, artifact or acceptance test. Use native shapes and labels so changing a name or step does not require editing a picture.
- **Two workflows.** Use `addME2026DualPath` from `scripts/scene_components.cjs` with two labeled lanes, 2–4 short steps in each, and a distinct outcome and detail for each lane. Call on a standard white base; review text fit in the rendered slide. If the lanes share a feedback step, put that in a separate text zone.
- **Case and boundary.** Describe what happened, who was responsible, where the evidence came from, what was observed, and what cannot be inferred. Distinguish historical facts, retrospective interpretations and suggested methods. Treat absent baselines or unverified attribution as visible limitations. Evidence labels such as E1–E4 are optional.
- **Product fit.** Use an editable table with product, fit, non-fit, integration and evaluation. Keep delivery or service activities distinct from native product functions. Preserve the scope qualifiers in the visible table or immediately adjacent text.

## Sources, page references and demo materials

Assign stable source IDs. In the plan or speaker notes bind each claim to title, publisher, date/version, URL or internal locator, and verification status with basis. Display the material qualification beside the claim. In the finished deck use a native hyperlink where a public URL is verified and a textual locator where an internal reference has no appropriate public link. Check that each in-deck reference points to the final page and that appendix “used on” values match the visible claim pages. A marker inherited from a source deck is not verification.

For the talk, plan the visual subject first. Choose a product interface, business diagram, evidence panel or native flow according to the slide’s claim. When an approved plan calls for an interface, a text-only slide cannot fulfill it. Use [code visuals](code-visuals.md) for concept interfaces with concrete content, and use a standard editable slide around the image. For a demo, specify what happens at each step, the time budget, expected outcome and static fallback. An embedded video requires a recorded insertion location and actual playback verification when playback is part of the approved plan. Label pending media and static alternatives explicitly. Use screenshots as evidence only where provenance and permission are clear. For an explanatory illustration, verify its relationship to the page claim and to the editable diagram. Apply [native imagery](native-imagery.md) and [QA](qa-and-content-contract.md).
