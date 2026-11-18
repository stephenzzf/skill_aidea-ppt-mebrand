# ME2026 intake and human confirmation

## Scope

Every PPT task follows: read source → clarify missing requirements → show concrete plan → wait for human confirmation → execute → QA → deliver. Applies to `new`, `rebuild`, `targeted-fix`, `translate`, test decks and image-supported decks.

## Presentation style

Resolve how the audience will use the deck **before** giving a slide-by-slide plan. Read the request, attachments and prior decisions together. A brief may support a recommendation without establishing the user’s choice. For “根据这份 Brief 做一份 PPT”, ask, for example, “这份稿主要用于管理层现场决策、向团队宣讲，还是会后详细阅读？材料里有人力审批事项，我建议采用管理层决策演讲风格。” Wait for the reply. When a brief or source is missing too, combine any essential request for it with this question.

- A declared use such as “集团管理层现场决策” is enough. Carry it forward across follow-ups. State it in the plan and give the outline immediately when the other requirements are known.
- “演讲感” can still describe several audiences. If the distinction changes the substance, ask only who will hear it and what the speaker wants them to do. Choose between plausible options grounded in the brief.
- When a reference deck could supply facts, visual treatment or the complete source design, resolve only the ambiguity that affects the result. A translation or targeted repair with instructions to preserve the design can go straight to the scoped plan.
- Brand palette and rendering medium are separate choices. A request for ME colors or SVG drawings alone still needs a presentation-style decision. Format and tone give no implicit permission to omit, rewrite, reorder or move material into notes.

## Clarification

Ask only unanswered questions that change purpose, audience, source boundary, slide scope, content permission, target English/tone, layout changes, image use or deliverables. Do not repeat information already supplied. When requirements are complete, summarize them in the plan rather than asking a fixed questionnaire.

## Page visuals

For each planned page, state what the listener should understand, what visual will convey it and what they can edit in PowerPoint. The author chooses a method suited to the claim; ask the user about the method only when the tradeoff materially changes delivery and their preference is unknown.

| Audience task | Production choice | Verification |
| --- | --- | --- |
| Compare measures, follow steps or identify who approves a decision | Native PowerPoint charts, text, tables, shapes and connectors; HTML/CSS may support layout trials | Edit the value, unit, stage or owner in PowerPoint. Keep qualifications and provenance with the relevant objects. |
| Read an interface or understand a precise relationship between systems | Use the [offline code visual workflow](code-visuals.md) for a controlled HTML/CSS/SVG illustration. Use editable overlays where labels or relationships must change. | Verify the code source, embedded output and visible cues. Disclose concept UI on the slide, and describe which elements can be regenerated versus edited directly. |
| Recognize people, actions, settings or physical objects | Reuse a suitable supplied asset or commission a scene illustration from the host image tool after confirmation | The action and business object should be recognizable at projected size. Mark fictional scenes when they could be mistaken for real ones. |
| Verify actual behavior or a customer result | Use a traceable, permitted screenshot or other genuine evidence | Identify the source and what it shows. If it is missing, flag the gap and limit the claim. |

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
