# Advanced Rebuild Playbooks

Use this file for existing PPTX/PDF rebuilds, near-identical editable reconstruction, or user-marked red-box repairs.

## Near-Identical Editable Rebuild

- State the boundary: pixel-perfect screenshots and fully editable content conflict. Keep core business text, labels, cards, arrows, tables, and diagrams editable; keep logos, badges, QR codes, photos, screenshots, and complex decorative assets as images when needed.
- Measure source coordinates from rendered previews before drawing: page bounds, lane centers, footer baseline, repeated card sizes, connector endpoints, and row centers.
- Treat a stronger prior single-page candidate as a golden candidate. If a full-deck pass regresses it, replace only the target slide XML/media rather than regenerating everything.
- Use dedicated helpers for repeated components: field rows, action cards, outcome boxes, channel tags, numbered circles, compact pills, and icon rows.
- Multi-line body text must use explicit multi-line boxes with enough height. Do not rely on `fit: "shrink"` to hide overflow.
- For dense icon/text rows, the row helper must own `rowX/rowY/rowW/rowH`, icon slot, text slot, shared `centerY`, and vertical padding.
- Normalize icon PNGs by visible glyph bounds; transparent canvas centering is not enough.
- Accept a small similarity drop when local red-box issues are actually fixed and risk counts improve.

## PDF-To-Editable PPT

- Render source pages first and use the renderer as the visual authority.
- Extract text by visual line or paragraph, not one PPT text box per PDF span.
- Preserve inline styling as rich text runs inside one PPT object where practical.
- Resolve duplicates before delivery: text+image, SVG path+image, emoji+image, or crop+editable text.
- Normalize PDF-only fonts to stable installed fonts. Convert emoji/status marks into controlled icons or retained source images.
- Preserve photos, screenshots, masks, and complex wordmarks as source images when editable reconstruction creates jagged or duplicated output.

## Red-Box Repair Gates

- Visible text crossing a card, row, pill, panel, or diamond boundary fails the page.
- Unexpected word splitting fails compact labels, especially `WhatsApp`, `Voice / Call Centre`, `Suggested Responses`, `Wrap-up Notes`, and similar labels.
- Icon/text rows fail when the icon center and text visual center do not share the same row center.
- Card rows fail if they protrude outside the parent card, overlap a connector, or sit across a parent border.
- Duplicate visible words, logos, checkmarks, crosses, or status icons fail the local crop.
- A fix must be validated by structural QA plus source/candidate rendered pages and a local crop, not coordinates alone.

## Required QA Artifacts

- Source and candidate previews for changed and affected adjacent pages; missing required rendering keeps acceptance incomplete.
- Local crops for every user-marked region.
- Text-risk report for long Latin tokens, tiny boxes, multi-line height risks, and literal `\n`.
- Duplicate-object report for PDF rebuilds and status matrices.
- Fix ledger with target slides, component family, old/new risk counts, preview status, and accepted limitations.

Use the `rebuild` or `targeted-fix` QA profile, not new-deck contact/closing-page assumptions. Preserve the source artifact and hash, classify source-existing risks separately from new defects, and compare unchanged-page content. Do not erase pre-existing 7–8pt warnings by loosening thresholds. A route-inapplicable closing-page rule is distinct from an actual readability defect. Record accepted source constraints explicitly; lower risk count alone is not acceptance. See `qa-and-content-contract.md`.
