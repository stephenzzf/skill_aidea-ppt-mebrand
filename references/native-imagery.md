# Standard ME2026 native imagery

Use this guide for supporting image assets in standard ME2026. Keep the existing ME2026 brand, PptxGenJS authoring, content permissions and five QA categories.

## Decide what the image needs to say

Before generating an explanatory image, add a `semantic_brief` to that asset in the confirmed plan and manifest:

```json
{
  "page_claim": "Human review turns draft marketing material into approved, publishable content.",
  "subject": "A small marketing team reviewing a draft against source facts and brand guidance.",
  "action": "One person prepares a candidate; another checks it; an approved item moves to a publishing schedule.",
  "inputs": ["approved product facts", "brand guidance", "draft content"],
  "outputs": ["reviewed content", "scheduled publication"],
  "required_cues": ["source material", "candidate draft", "human review", "approved output", "visible handoff"]
}
```

This is an illustrative brief, not a required scene or a requirement to depict people, marketing, clouds, or 3D objects. Use the page-specific meaning. When exact sequence, data, ownership, or causal relationships matter, prefer editable PowerPoint shapes, a table, chart, or workflow; use AI imagery only if it adds explanation or atmosphere that native objects do not. Do not force a photo or illustration onto a page, and declare image-free pages or optional decorative use explicitly. A decorative image can add mood or balance, but it must not be used as evidence or expected to explain the claim.

Write prompts in this order: scene/subject and action; inputs and outputs; the required visible cues; composition and target slot; then style, palette, lighting, aspect ratio, negative space and exclusions. State what the image must visibly depict, not only the desired aesthetic. "No text" means do not generate words, numbers, logos or labels; it does not require an empty subject or blank panels. Keep essential labels and facts as editable slide text. A polished cloud orb, glass platform, abstract documents, dashboard, or magic wand is not an adequate explanation when the page claim depends on actors, inputs, decisions, sequence or outputs that the image does not show.

## Host-native generation

1. Include asset purpose, kind, count, target pages, references and any image-free fallback in Content Gate. A confirmed plan or explicit implementation request already authorizes its scoped native calls.
2. Discover tools in the active host. A skill file or installed app does not establish callable image capability.
3. In Codex, use built-in `image_gen` through the available Imagegen skill. No additional API key is needed. Product usage limits apply; do not call this free or unlimited. Do not hard-code or claim an internal model not returned by the tool.
4. In Antigravity, request its available native image generator (current official documentation describes an `image-generator` subagent). Follow the host's actual tool contract. Codex does not acquire that tool merely by reading the same skill. Never initialize deck-builder, select a Cloud project, enable telemetry or use Vertex/API fallback for this route.
5. Generate an independent photo, illustration or background only when the confirmed page plan gives it a useful role. Keep essential words, numbers, data charts and workflows native. Prefer a coherent visual family and reuse appropriate assets instead of generating an image per page.
6. Inspect each result. For local edits in Codex, view the target first and pass it through the tool's supported reference-image mechanism. State the change and invariants. Generative edits may drift; review the whole object and preserve the original file.
7. Copy selected outputs into the task's `assets/` directory. Preserve the original generated output, prompt and parent hash for edits; do not leave a project reference only in a host cache.
8. If generation fails or is unavailable, record it. Use an agreed image-free layout only for optional decoration; a required missing asset keeps delivery incomplete. API/CLI fallback requires explicit authorization and its own cost/account boundary.

### Visual roles

| Role | Treatment |
| --- | --- |
| Real photo / official screenshot | Record supplied/source origin; do not alter it into invented customer proof |
| AI photo | Fictional illustrative scene; visible `AI生成情境示意` where it could be mistaken for a real event |
| Explanatory illustration | Depicts the page-specific subject/action and brief cues without inventing factual labels; include a semantic brief and review each cue |
| Decorative illustration | Adds mood or visual balance only; declare it decorative and do not rely on it to prove or explain the page claim |
| Background | Quiet text-safe areas; explicit exception and visual contrast review |
| Concept UI | Prefer native shapes/text and visible `概念示意`; never label it a real product screenshot |
| Table, chart or workflow | Native objects with editable labels/data/relationships |

Prompts should follow the semantic-first order above and include a text-safe region only where the slide layout needs it. Avoid logos, core copy, data labels and whole finished slides. Photos are not evidence of customers, employees or achieved results. Keep the extracted ME cover/index/closing/logo assets; generated backgrounds apply to independent body decoration.

## Asset manifest

Supporting pictures work in the standard `me2026-template` route. For a standard illustrated page use `addME2026WhiteBase`, keep its compact title/footer, place native icon/text rows on one side, and insert the saved PNG with `slide.addImage` into a separate slot on the other. Keep the original aspect ratio and a visible label such as `AI概念插画 · 非产品截图` where appropriate. Keep the official cover/logo assets and do not flatten the completed slide. Reused assets retain their original host/prompt/hash and are recorded as reused, not a fresh generation call.

Pass `--asset-manifest /path/to/assets.json` to the existing `qa_me2026.cjs`. Paths are relative to the manifest. Generated assets require a prompt; supplied or remote assets require traceable origin. Unknown host/model/cost stays `unknown` rather than invented. The QA ledger binds the manifest hash and the review receipt must bind the same manifest.

```json
{
  "schema_version": 1,
  "assets": [{
    "id": "chapter-illustration",
    "kind": "illustration",
    "semantic_brief": {
      "page_claim": "A human-reviewed draft becomes approved content ready to publish.",
      "subject": "A marketing team reviewing a draft against a source brief.",
      "action": "A candidate passes from preparation through human review to a scheduled output.",
      "inputs": ["source brief", "candidate draft"],
      "outputs": ["approved scheduled content"],
      "required_cues": ["source", "draft", "review", "approved output", "handoff"]
    },
    "origin": {"type": "generated", "host": "codex", "prompt": "A small marketing team turns an approved product brief into a candidate post, checks it against brand guidance, and moves the approved item to a publishing calendar. Show the source brief, draft creative, human reviewer, approval and scheduled output as distinct visible cues; use no readable text, logos or invented facts. Blue-violet editorial illustration, composed for a right-side slide slot with a quiet area at lower left.", "model": "unknown", "cost": "unknown"},
    "file": "assets/workflow.png",
    "sha256": "REPLACE_WITH_ACTUAL_SHA256",
    "slide": 3,
    "placement": "illustration",
    "placement_box": {"x": 9.0, "y": 2.0, "w": 3.0, "h": 3.0},
    "transparency_required": true
  }],
  "required_editable": [{
    "slide": 4,
    "objects": [{"id": "evidence-chart", "type": "chart", "shape_name": "evidence-chart", "min_count": 1}]
  }]
}
```

`placement_box` uses inches and describes the actual picture frame. Optional `crop` uses keys `left`, `top`, `right`, `bottom` with OOXML `srcRect` values (0–100000); keep exact renderer output, not a guessed crop. Name critical objects using PptxGenJS `objectName` and use `shape_name` to bind object-level editability. `id` is a logical identifier; if `shape_name` is omitted, legacy `id` is used as the actual shape name. Text requirements may additionally match their expected `text`. A page-level count alone does not establish every critical object is editable. If one file is reused on multiple pages, record each usage with a distinct ID.

QA checks files, hashes, declared page versus actual embedded media, picture placement/crop and real alpha. For an explanatory asset, the optional `semantic_brief` binds the generated or selected picture to the claim it supports. Existing manifest entries without a brief remain compatible; they do not acquire semantic-pass evidence retroactively. The visual receipt records separate `relevance`, `clarity` and `integration` decisions for each asset with a brief. A missing decision or concrete evidence stays `not_run`, not pass. Normal photos/logos and background pictures are allowed within the declared role. Image-heavy body pages still require meaningful native body objects; a title cannot exempt rasterized body text. Source/asset changes invalidate prior review. Keep crop, alpha-edge, subject/scene accuracy, occlusion and complex-background contrast in the visual receipt; metadata cannot prove visual quality.


A new PPT task always requires the content/image plan and human confirmation before generation. Reusing an asset is not a fresh tool call. Translation normally keeps the original pictures and their hashes, and translates native captions; raster text requires a declared exception or a separately confirmed repair.
