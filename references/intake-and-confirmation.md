# ME2026 intake and human confirmation

## Scope

Every PPT task follows: read source → clarify missing requirements → show concrete plan → wait for human confirmation → execute → QA → deliver. Applies to `new`, `rebuild`, `targeted-fix`, `translate`, test decks and image-supported decks.

## Presentation style

Resolve how the audience will use the deck **before** giving a slide-by-slide plan. Read the request, attachments and prior decisions together. A brief may support a recommendation without establishing the user’s choice. For “根据这份 Brief 做一份 PPT”, ask a concrete question such as “这份稿主要用于管理层现场讲解和决策，还是供管理层会前阅读与逐项审议？” Add a recommendation when the material supports one, then wait for the reply. Combine this with any essential request for missing sources.

- “集团管理层现场决策” establishes a management decision talk. “详细汇报版”“会前自读、逐项审议” establish a detailed management report. “正常版，不是演讲版” in a thread already about reporting to management selects the detailed report. State the mode in the plan and carry it forward across follow-ups. For a request for both outputs, plan each mode from the same source using the [comparison and acceptance criteria](report-and-talk.md#two-management-modes).
- “演讲感” can still describe several audiences. If the distinction changes the substance, ask only who will hear it and what the speaker wants them to do. Choose between plausible options grounded in the brief.
- When a reference deck could supply facts, visual treatment or the complete source design, resolve only the ambiguity that affects the result. A translation or targeted repair with instructions to preserve the design can go straight to the scoped plan.
- Brand palette and rendering medium are separate choices. A request for ME colors or SVG drawings alone still needs a presentation-style decision. Format and tone give no implicit permission to omit, rewrite, reorder or move material into notes.

### Visual style in the plan

A **季度汇报** can use a standard ME2026 treatment or [深色汇报](dark-report.md). Briefly describe the latter’s deep-purple cover and section breaks, white content pages and product appendices. If the visual choice and intended use are both open, ask one combined question before planning pages. An explicit or previously chosen 深色汇报 settles the visual treatment; ask about purpose only when it would materially change the deck. If the request says only “要深色”, answer with the surface choice and stop: “正文也需要全深底，还是采用深色汇报的深紫封面、白底正文？” Wait for the reply before proposing page counts, a numbered outline or a page plan, even if the audience and data are clear. In a repair, inherit the source visuals unless the user requests a restyle.

Confirm the visual choice through the shared plan gate. Keep the same per-page evidence, editability and visual criteria below for every visual style. A user who already accepted the concrete plan can proceed directly to scoped production and QA.

## Clarification

Ask only unanswered questions that change purpose, audience, source boundary, slide scope, content permission, target English/tone, layout changes, image use or deliverables. Do not repeat information already supplied. When requirements are complete, summarize them in the plan rather than asking a fixed questionnaire.

For analytical briefs, include the decision axes, level transitions, statistical scope, source lookup route, or editable overlays in the page plan where relevant. See [analytical layouts](analytical-layouts.md).

## Page visuals

When converting a long HTML document, its navigation, tables and source images describe the source medium. Identify where the new slides need visual cues of their own. A lookup page can stay a native table; a page with independent capabilities can use icon labels; a dependency or choice can merit a code drawing. If there is a post-processing step, inspect the **final** package: check planned icon keys on their target pages and code images against their renderer outputs. Compare matched slides for reading order, editing behaviour and the location of evidence limits.

For each planned page, state what the reader or listener should understand, what visual will convey it and what they can edit in PowerPoint. The author chooses a method suited to the claim; ask the user about the method only when the tradeoff materially changes delivery and their preference is unknown.

| Audience task | Production choice | Verification |
| --- | --- | --- |
| Quickly distinguish capabilities, responsibilities or actions | Use a consistent family of semantic icons next to native labels. In dark reports, `icon-briefing` lays out labelled rows or columns. Select keys for each action in the Brief. | Review adjacent glyphs at reading size. Different registry keys can produce the same silhouette. If two actions look alike, choose a visibly different symbol or use the labels alone. Count meaningful body icons separately from brand marks and fallback copies. |
| Compare measures, follow steps or identify who approves a decision | Native PowerPoint charts, text, tables, shapes and connectors; HTML/CSS may support layout trials | Edit the value, unit, stage or owner in PowerPoint. Keep qualifications and provenance with the relevant objects. |
| Read an interface or understand a precise relationship between systems | Use the [offline code visual workflow](code-visuals.md) for a controlled HTML/CSS/SVG illustration. Use editable overlays where labels or relationships must change. | Verify the code source, embedded output and visible cues. Name the HTML/CSS/SVG layer in the plan. Identify separately the native labels, decision node and direction arrows. With the Brief CLI, the code bitmap, native labels and independent arrow lines are three separate layers. When moving a return label, reposition its arrow as well. Auto-attached or rerouted endpoints are outside the current coded-diagram contract. |
| Recognize people, actions, settings or physical objects | Reuse a suitable supplied asset or commission a scene illustration from the host image tool after confirmation | The action and business object should be recognizable at projected size. For AI-created business scenes, quote the visible caption “AI 情境示意” in the image plan and use it on the slide. Identify its origin in the notes. |
| Verify actual behavior or a customer result | Use a traceable, permitted screenshot or other genuine evidence | Identify the source and what it shows. When the record is missing, put the unresolved question or neutral status in the heading, e.g. “昨晚现场验收情况待核实”. List which records would resolve it. Do not state the outcome first and qualify it afterward. |

Start with a question the audience can answer by looking at the finished slide. Apply the following checks in order when two media look plausible.

1. **Is the presenter asserting something actually happened?** Identify the original record and what it proves. Show a supplied, traceable capture, artefact or measurement with its date, scope and source. If the record is missing, mark the evidence gap or ask for the specific source. A generated scene and a reconstructed interface cannot verify that event.
2. **What must the presenter or audience change or trace?** Use a native chart for values, a table for lookups and native connectors for simple sequences and owners. For a precisely positioned interface or nontrivial mechanism, specify exactly which input, state change, output, branch or return path the drawing makes visible. Build the illustration in HTML/CSS/SVG; separate editable business labels, values and relationships from the rendered layer. A generic frame with repeated bullet text adds little. A single discussion question or decision can stand on its own in native type.
3. **Does recognizing a person, gesture, setting or physical action teach the point?** Check available photos or illustrations for the same subject, action and object at the intended crop. Reuse a match. If the required action is missing, specify a new scene, the visible cues and the space needed around the subject. Use the confirmed host image route and label an AI-created scene “AI 情境示意” when presenting illustrative business situations.
4. **Could a listener point to the answer?** Inspect the rendered slide at the intended distance. Ask someone to locate the changed value, follow the connection, identify the physical action or find the supporting record. If the picture can be transferred to another page without changing its meaning, replace it or give the space to the native content.

For example, “scan a parcel” can require four different visuals. Training on physical handling needs a close view of the barcode and operator’s grip. Explaining propagation of the scan needs an event-to-stock diagram with its update or exception path. Proving yesterday’s deployment needs the dated event record. Comparing error rates needs a native chart with counts and denominators. In the page plan, state which question this page answers, the proposed medium, editable parts and any missing source. Do not ask the user to choose a technology for the entire deck.

## Required plan

Show purpose/audience; route; slide count/outline or source/target pages; one claim and proof object per new page or source-preservation contract; for each new page, its primary visual pattern, semantic icon (or why none), card/module purpose and reading hierarchy; missing facts; content policy; standard ME2026 constraints or original-design translation constraints; sources; image purpose/type/count/pages/reference inputs/current native host; agreed fallbacks; deliverables; acceptance checks. For every explanatory image, include a semantic brief with `page_claim`, `subject`, `action`, `inputs`, `outputs` and `required_cues`, and say why an image is more useful than editable native objects. Mark decorative assets as decorative; they do not prove or explain a factual claim. State “reuse original pictures; no image generation” when applicable.

For translation include source hash/pages, zh→en-US, terminology and protected facts, visible content plus notes/table/chart scope, raster-text exceptions, allowed fit adjustments, and bilingual/layout/native-PowerPoint review. Do not replace original content with new research unless separately confirmed.

Unless the user requests strict geometry, the translation plan includes automatic text-frame resizing/repositioning, spacing, typeface and font-size adaptation to keep the approved content attractive and readable. These ordinary fit corrections do not create another confirmation pause; keep page count, business facts and agreed image scope fixed.

The default user-facing deliverable is one editable PPTX. State this in the plan without automatically offering PDF, previews, a glossary or a ZIP; retain the required validation evidence internally. Honor extra formats explicitly requested by the user. See [default output](../SKILL.md#default-output).

For reports or talks, also record the reading distance or time available, per-page claim and evidence, material limits, source register and any demo readiness. See [scenario planning](report-and-talk.md).

## Mandatory pause

After showing the plan, stop and wait for human confirmation before any candidate PPTX, translation write-back, slide mockup or generated asset. A clear initial request, “继续测试”, “做一个测试”, “无需确认直接生成”, screenshot repair request or preselected answer is not confirmation of an unseen plan. Silence is not confirmation.

An explicit human acceptance of the concrete plan, including “PLEASE IMPLEMENT THIS PLAN” quoting that plan, authorizes its execution. Continue generation, QA, automatic regressions and scoped fixes without repeated approval. A new unrelated PPT task requires a new plan. Material changes to sources, content permissions, page count, target pages/regions, repair method (local fix versus rebuild) or image scope need an updated plan and confirmation; ordinary corrections within the accepted scope do not.

Before confirmation you may inspect/extract source objects and render source pages. Save the accepted plan version and the actual confirming message reference/text in the internal task record, bound to the artifact. A script-generated `approved` field cannot establish human consent. This is a conversational workflow requirement, not a claim that CLI arguments authenticate humans.

## Content permission

- `preserve`: default for repair, rebuild and translation; keep facts, limits, process order and actions. Translation permits equivalent wording, not omissions.
- `summarize`: shorten only within confirmed limits and record omissions.
- `reorganize`: rearrange narrative only with confirmed permission; retain factual meaning.

Amounts, dates, units, product names, code, API parameters, URLs, SOP order and requested actions require reconciliation. Layout pressure does not permit fact deletion. Sample scenarios and placeholders are simulations, not verified customer evidence.

## Images

The confirmed plan includes all proposed native-tool assets and agreed reuse/fallbacks. Do not repeat approval for those calls. Expanded asset scope or an external paid API fallback needs its own authorization. Host quota/cost/model must be reported honestly; unknown is not free.
