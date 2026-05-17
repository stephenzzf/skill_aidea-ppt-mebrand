---
name: aidea-sop-ppt-mebrand
description: Generate editable 16:9 PPTX decks in the Aidea SOP / ME / Meet Experience / 觅跃科技 / 飞书深诺 brand system from outlines, SOPs, solution briefs, or business-review content. Use for ME-branded presentation creation, white-template business decks, industry-solution proposal decks, and PPT quality/brand validation workflows where Codex should use pptxgenjs, Lucide icons, and built-in QA checks.
---

# Aidea SOP PPT ME Brand

Use this skill to create editable ME / Meet Experience brand PPTX decks from structured outlines, solution briefs, SOPs, or business review content. Default to `pptxgenjs + Lucide + sharp`, not full-slide screenshots. Keep text editable; render generic icons as transparent PNGs for reliable PowerPoint / Keynote / Quick Look preview.

## Workflow

1. Create a thread-scoped workspace under `/tmp/aidea-sop-ppt-mebrand/<task-slug>` for generated scripts, notes, previews, and QA output. Put only final deliverables in the user-requested output folder.
2. Read the relevant references:
   - Always read `references/brand-guidelines.md`.
   - Read `references/layout-templates.md` when choosing slide layouts or matching a white-template business deck rhythm.
   - Read `references/solution-patterns.md` for industry-solution or proposal decks.
   - Read `references/official-presentations-method.md` for story/design/QA workflow.
   - Read `references/implementation-notes.md` before writing or editing scripts.
3. Write a short source/reference audit: source content, reference style, missing facts, and any identity assets.
4. Write a claim spine before building: thesis, audience, slide claims, proof objects, and omissions.
5. Lock the design system: size, fonts, palette, footer, title rules, icon grammar, card grammar, and banned motifs.
6. Build a `build_<slug>.cjs` deck script using `scripts/brand_ppt_helpers.cjs`.
7. Run `scripts/inspect_pptx.py` on every final PPTX.
8. Render at least a Quick Look thumbnail when available. If no renderer exists, report that visual QA was limited to structural checks.
9. Deliver the PPTX plus a concise QA ledger: checks run, failures fixed, accepted limitations.

## Task Modes

- `create`: default. Generate a new ME brand deck from a user outline.
- `template-following`: preserve a white-template business deck rhythm, restrained page chrome, and small-icon style.
- `solution-deck`: use proposal / industry-solution narrative patterns for client-facing solution decks.
- `targeted-fix`: fix a generated PPTX for icons, fonts, numbering circles, footer drift, text overflow, or brand compliance.
- `official-presentations`: use Codex official `Presentations` / artifact-tool only when the user explicitly requests that path or a reference-beating editorial deck.

## Build Rules

- Use 16:9 widescreen (`13.333 x 7.5` inches).
- Do not embed a whole slide as a background image unless the user explicitly chooses visual-only fidelity.
- Use editable text, shapes, tables, lines, and chart primitives wherever practical.
- Render Lucide icons to transparent PNG with `sharp`; direct SVG embedding can show as placeholder icons in some previewers.
- Use `numberedCircle()` for numbered circles; the text box and circle must share the same x/y/w/h.
- Keep every slide footer consistent: `觅跃科技 | 飞书深诺` on the left and page number on the right unless the user provides another brand footer.
- If content is too dense, split the slide or ask for a scope reduction. Do not shrink text below readable thresholds to force fit.
- Do not invent product screenshots, official logos, customer proof, metrics, or dates that are not provided by the user.

## QA Gates

Run these before final delivery:

```bash
python3 "$SKILL_DIR/scripts/inspect_pptx.py" "$FINAL_PPTX" \
  --expected-slides <N> \
  --required-text "觅跃科技" \
  --required-text "飞书深诺" \
  --check-numbered-circles \
  --check-no-fullslide-images
```

For smoke testing the skill itself:

```bash
node "$SKILL_DIR/scripts/smoke_generate_deck.cjs" \
  --out /tmp/aidea-sop-ppt-mebrand-smoke.pptx

python3 "$SKILL_DIR/scripts/inspect_pptx.py" \
  /tmp/aidea-sop-ppt-mebrand-smoke.pptx \
  --expected-slides 3 \
  --required-text "觅跃科技" \
  --required-text "飞书深诺" \
  --check-no-fullslide-images \
  --print-style-summary
```

If available, generate a thumbnail:

```bash
qlmanage -t -s 1200 -o /tmp/aidea-sop-ppt-mebrand-preview "$FINAL_PPTX"
```

## Delivery Notes

Final response should include modified/generated files, key changes, validation results, unexecuted checks with reasons, and user-visible impact. If this skill was used from memory or older references, say when facts may be stale.
