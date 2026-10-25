# Aidea SOP PPT ME Brand Skill

Codex skill for creating, repairing, rebuilding, and translating editable 16:9 PPTX decks in the Aidea SOP / ME / Meet Experience / 觅跃科技 / 飞书深诺 brand system, using the unified ME2026 template.

This public-safe version focuses on reusable brand rules, layout patterns, PPTX helper scripts, and QA checks. It does not include private reference decks, customer assets, internal screenshots, or generated PPTX outputs.

## Install

Clone into a new folder. If the skill is already installed, move its directory to a dated backup first; preserve any local customizations before replacing it.

```bash
mkdir -p ~/.codex/skills
# Fresh install; git refuses to overwrite an existing directory.
git clone https://github.com/stephenzzf/skill_aidea-ppt-mebrand.git ~/.codex/skills/aidea-sop-ppt-mebrand
cd ~/.codex/skills/aidea-sop-ppt-mebrand
npm ci
python3 -m pip install -r requirements.txt
```

Restart Codex after installation.

## 默认交付（0.2.1）

默认只交付一个最终可编辑 **PPTX**，新建、翻译、重建和修复任务均适用。PDF、逐页预览、对账表、术语表、QA报告及ZIP包仅在用户明确要求时提供，不再自动附带或询问是否需要。

内部仍执行必要的逐页渲染、内容对账、视觉检查与兼容性验证；中间文件和验收证据保留在独立工作/QA目录，不混入交付目录。最终答复默认只给PPTX链接和简短验收结论。详见 [交付规则](SKILL.md#default-output)。

## 0.2.0 能力更新

- 同步安装版已实现的标准 ME2026、四类任务路线、强制方案确认、语义图标与卡片、素材追踪、字体/包兼容性和五类 QA。
- 新增原样提取指定页的 `translate select`，支持“先翻译前20页”等分批任务；源文件、子集及页码映射分别绑定。
- 将真实中英翻译中的姓名职务核对、英文断词/窄框修正、图片中文的原生重建和最终原生 PDF 复核写入 [翻译排版指南](references/translation-layout-review.md)。不会将个案绕过脚本或粗略缩字算法当作通用能力。
- 更新图像依赖，`sharp` 使用 0.35.5，`image-size` 覆盖为 2.0.4；Node.js 最低版本调整为20.9。参见 [sharp 公告](https://github.com/advisories/GHSA-wq5f-xc86-pv6w)和 [image-size 公告](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq)。
- 安装同步使用当前用户的 `CODEX_HOME` / home 路径，排除缓存；发布不包含业务PPT、译稿、截图、账户或凭据。

### 兼容性变化

标准 ME2026 公共卡片/图标接口保持兼容。按已确认的单一风格收敛，`whitepaper`、`deloitte-white` 场景已停用并明确报错；旧的 `addME2026ConsultingTimeline`、`addME2026ConsultingIconGrid`、`addME2026ConsultingProcessRows` 已移除。迁移时使用现有 `addME2026IconTitleCard`、`addME2026StackedIconRow`、原生连接线与表格组合，参见 [排版组件](references/layout-templates.md)。这是有意的旧风格接口退役，不承诺这些旧函数仍可调用。

## 中文使用示例

在 Codex 中明确调用 `$aidea-sop-ppt-mebrand`，附上材料并说明用途、受众和范围。首次先给方案，回复“确认”后连续执行生成、QA与排版修正。

```text
使用 $aidea-sop-ppt-mebrand，把附件中文PPT的前20页翻译成自然的美式商务英语。
保留20页、原有设计、业务事实和可编辑性；允许自动调整框体、位置、字号和换行。
沿用原图，不生图。先给翻译及图片文字处理方案，确认后默认只交付最终英文PPTX，内部完成逐页检查与中英对账。
```

```text
使用 $aidea-sop-ppt-mebrand，制作面向出海品牌营销负责人的30分钟公开演讲，约20页。
使用标准ME2026，加入语义图标和能力卡片。先确认逐页方案及用图计划；数据与案例须有来源。
```

```text
使用 $aidea-sop-ppt-mebrand，修复附件P3、P7的图标位置和英文断词。
保留原文、页数、业务流程及可编辑性；其他页不改。先展示修复方案，确认后另存并做前后对照。
```

原稿重建使用 `rebuild` 路线并说明保留内容/视觉的范围。新建只有标准 ME2026；翻译保留原稿设计，不强制换模板。AI照片、插画或背景是可选素材，需在用图方案内确认，由宿主原生工具生成；脚本不自行选择付费API。

## 部分页翻译命令

```bash
npm run translate -- select --pptx /path/source.pptx --slides 1-20 --out /path/source-first20.pptx --report /path/selection.json
npm run translate -- extract --pptx /path/source-first20.pptx --out /path/extraction.json
# 宿主助手结合整页上下文翻译，生成与该子集哈希绑定的mapping.json。
npm run translate -- apply --pptx /path/source-first20.pptx --mapping /path/mapping.json --out /path/English.pptx --report /path/translation-report.json
```

`apply` 是确定性写回工具，不自行翻译。未知OLE、外链图表或未解析工作簿关系仍会阻断；不得删除原文或使用个案例外脚本伪造QA通过。阅读 [翻译合同](references/translation.md)。

## Runtime Requirements

- Node.js >=20.9 (required by the patched image-processing runtime)
- Python 3, lxml for faithful translation, PyMuPDF (`fitz`) and Pillow for full-page previews
- LibreOffice (`soffice`), Fontconfig (`fc-match`, `fc-scan`), and Source Han Sans CN for Chinese rendering
- Node packages: `pptxgenjs`, `lucide`, `sharp`, `jszip`

Install Node dependencies in an environment available to Codex:

```bash
npm ci
```

## Usage

Recommended prompt pattern:

```text
Use aidea-sop-ppt-mebrand to generate an editable ME2026 PPT from the following content.
First confirm audience, source boundary, slide outline, and non-fabrication limits.
After I confirm, generate the PPTX and run ME2026 QA internally. Deliver only the final PPTX with a brief QA outcome; extra formats or reports are on request.
```

The default workflow is `Read source -> Clarify -> Present content/image plan -> Wait for human confirmation -> Prepare/translate -> Generate -> QA -> Deliver`.

For an existing image-heavy PPTX, use `targeted-fix / rebuild path` to convert screenshot-like pages into editable text, shapes, tables, and diagrams while retaining only necessary local image assets such as logos, certification badges, platform marks, case photos, or product photos.

For ME-branded output, use the unified `me2026-template`. This path uses extracted Cover / Index / Thank You / Logo / footer assets from the user-provided PPTX, combines them with restrained business-page layout rules and consistent standard ME2026 page layouts, and keeps titles, directory items, diagrams, tables, prices, and page numbers editable. Optional native-host imagery adds fictional photos, illustrations or decorative backgrounds; essential slide content stays editable.

For ME2026 closing pages, use `addME2026ThankYou()` by default. It is based on the source PPTX final Contact Us / Thank You page, not a reused cover slide. The right-side personal contact QR is intentionally omitted from the public template and replaced with editable placeholder text `黏贴个人联系方式`.

ME2026 helper scripts include a public-safe icon registry based on Lucide. Use registry keys such as `comparison`, `strategy`, `diligence`, `growth`, `media`, `automation`, `conversion`, `retention`, `crm`, and `api` to quickly add small icons that match the ME2026 color system.


For dense PRD or solution decks, ME2026 layout checks enforce table-to-module spacing and parent-card text containment. Use `ME2026_LAYOUT` spacing constants or the ME2026 helpers instead of hand-tuned tight coordinates.

## Validate

Run automated regressions (this does not assert explicit visual review):

```bash
npm test
```

Generate one built-in scenario and run the unified QA wrapper:

```bash
npm run generate -- --scenario eclick --out /tmp/feishu-vs-eclick-me2026-test.pptx
npm run qa -- --pptx /tmp/feishu-vs-eclick-me2026-test.pptx --slides 8 --allow-fullslide 1,2,8
```

Useful scenarios:

- `smoke`
- `realistic`
- `teemo`
- `eclick`
- `ai-capability`
- `video-localization`
- `component-catalog`
- `icon-catalog`

Sync this repository copy to the installed Codex skill:

```bash
npm run sync:installed
npm run check:installed
```

## Public Version Limits

- No private PPT templates or thumbnails are bundled.
- No customer logos, private screenshots, or generated business decks are included.
- The skill provides reusable brand and layout guidance; project-specific proof, metrics, and assets must be supplied by the user.
- `assets/me-2026-app/` contains brand assets extracted from the user-provided ME2026 PPTX for the requested Openclaw/GitHub distribution path. Confirm authorization before redistributing this skill outside that approved context.
- `assets/me-2026-app/deloitte-white-icons/` contains source-traceable optional icon geometry extracted from the user-provided Deloitte `.potx` and recolored to ME2026. Confirm third-party redistribution authorization before publishing this asset subset.

## License

No open-source license has been added yet. Treat this repository as shared usage only unless a license is added by the owner.

## QA acceptance

Select `--profile new`, `rebuild`, `targeted-fix`, or `translate`. Source-based routes require `--source-pptx`; targeted fixes also require `--target-slides`. Exit 0 means all required layers passed; exit 1 means failed; exit 2 means partial (for example, no content/visual review yet). `--no-preview` never means final PASS.

Read [QA and content contract](references/qa-and-content-contract.md). A review receipt records actual review, not an automated approval switch. Scenario fixtures and placeholder screenshots do not establish real business facts. LibreOffice preview acceptance does not imply PowerPoint or commercial competitor acceptance.


## Human confirmation and translation

All new PPT tasks, including tests, require a concrete content/image plan and human confirmation before generation. Already accepted plans authorize their scoped execution and repairs. Only standard ME2026 is offered for creation.

Chinese-to-English translation edits the original OOXML in place into a separate PPTX, keeps native objects and source design, and requires bilingual and per-page layout review. Use `npm run translate -- extract ...` then `apply ...` with a source-bound mapping; configure `AIDEA_PPT_PYTHON` with lxml. See [translation](references/translation.md), [confirmation](references/intake-and-confirmation.md), and [native imagery](references/native-imagery.md). The skill never deletes untranslated source text to manufacture a pass.
