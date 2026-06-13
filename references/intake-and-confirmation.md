# ME2026 Intake And Confirmation

Use this file before creating formal decks or when a prompt is ambiguous.

## Intent Gate

Ask only questions that materially change the deck. Prefer 3-5 questions.

Confirm:

- Goal: report, sales deck, solution proposal, competitor analysis, product plan, training, or skill test.
- Audience: executive, customer, internal product/R&D, sales, investor, or training group.
- Source boundary: user-provided content only, public-web research, internal assumptions, or explicitly marked simulation.
- Success criteria: decision support, visual polish, editable rebuild, quick test coverage, or board-style communication.
- Deliverables: PPTX only, PPTX + preview, open file, local commit, or GitHub push.

Default if user does not answer: ME2026 editable PPTX, public-safe content, no invented metrics/logos/screenshots, QA + Quick Look preview.

## Content Gate

Before generating a formal deck, show:

- Slide count and outline.
- One core claim per slide.
- Proof object per slide: table, process, matrix, screenshot, icon-card set, timeline, or text-only note.
- Missing facts and non-fabrication boundaries.
- Visual path: standard ME2026, white consulting, long PRD, competitor matrix, or targeted repair.

Generate only after the user confirms, unless the prompt explicitly says to proceed without confirmation.

## Compressed Gates

The gate can be compressed when the user says:

- `继续测试`
- `做一个测试`
- `PLEASE IMPLEMENT THIS PLAN`
- `无需确认直接生成`
- A concrete red-box repair request with exact screenshot/page context

Compressed gates still require QA.

## New PPT Intake Template

```md
我先确认 4 点再生成 outline：
1. 这份 PPT 的用途和受众是什么？
2. 内容来源只用你提供的材料，还是允许联网补公开资料？
3. 希望偏哪种结构：标准 ME2026、白底咨询风、竞品矩阵、长 PRD/产品方案？
4. 交付需要 PPTX 即可，还是要同时生成预览图/打开文件/提交 commit？
```

## Content Confirmation Template

```md
生成前确认：
- 页数：
- 叙事主线：
- 每页标题与核心 claim：
- 关键 proof object：
- 缺失信息 / 不编造边界：
- 视觉路径：
- QA：inspect + layout risk + Quick Look
```

## Repair Confirmation Template

```md
我会按 targeted-fix 处理：
- 目标页/区域：
- 问题类型：对齐、越界、贴近、重叠、字号、页脚、图标
- 修复方式：局部修复 / 单页重建 / 整页重建
- 验收：结构 QA + 风险扫描 + Quick Look / crop 对比
```
