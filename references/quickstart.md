# ME2026 Quickstart

Use this file to choose the shortest correct workflow for common user prompts.

## Default Route

Use `me2026-template` for all normal ME-branded decks. The fixed production flow is:

`Intake -> Content Gate -> Generate -> QA -> Preview -> Deliver`

Do not skip QA. Only compress the confirmation gates when the user clearly asks for a test, a specific repair, or direct implementation.

## Prompt Routing

| User intent | Route | Confirmation behavior | Execution |
| --- | --- | --- | --- |
| "做一个正式 PPT" | New deck | Run Intent Gate and Content Gate | Build editable PPTX after confirmation |
| "把这段内容转 PPT" | Long-form conversion | Summarize slide split first | Generate after Content Gate |
| "继续测试 / 做一个测试" | Scenario test | Ask only if the scenario/topic is missing | Generate and QA directly |
| "PLEASE IMPLEMENT THIS PLAN" | Implementation | Treat plan as confirmation | Implement, test, sync installed skill, local commit |
| "红框问题 / 对齐 / 越界" | Targeted fix | Confirm target page/problem if not obvious | Repair, run focused QA and visual preview |
| "分析/优化 Skill" | Planning or docs | Do not mutate unless implementation is requested | Provide plan or implement requested plan |

## Standard Commands

Generate a scenario deck:

```bash
npm run generate -- --scenario eclick --out /tmp/feishu-vs-eclick-me2026-test.pptx
```

Run the unified QA gate:

```bash
npm run qa -- \
  --pptx /tmp/feishu-vs-eclick-me2026-test.pptx \
  --slides 8 \
  --allow-fullslide 1,2,8
```

Run all regression scenarios:

```bash
npm test
```

Sync the repository copy to the installed Codex skill:

```bash
npm run sync:installed
npm run check:installed
```

## Scenario Names

Use these names with `scripts/generate_me2026_deck.cjs`:

- `smoke`
- `realistic`
- `teemo`
- `eclick`
- `ai-capability`
- `video-localization`
- `deloitte-white`
- `component-catalog`
- `icon-catalog`

## Delivery Checklist

- Editable PPTX path.
- QA ledger path from `qa_me2026.cjs`.
- Quick Look preview path when generated.
- Any accepted limitations, especially source facts, unavailable renderers, or intentionally retained images.
