# aidea-ppt-me｜ME 品牌可编辑 PowerPoint 制作指南

用 Codex 把 Markdown、HTML、业务 Brief 或已有演示稿做成可编辑的 16:9 PPTX。第一次制作时，上传材料，在对话中调用 `$aidea-ppt-me`；已有确认的结构化 JSON Brief 时，使用**已安装技能的命令行入口**重新生成。两种方式都使用 ME2026 品牌体系。

## 选择任务

| 你手里的材料与目标 | 推荐用法 |
|---|---|
| 从正文做一份新 PPT | 提供原文、受众、用途及页数。技能先给逐页内容和配图方案，确认后制作。 |
| 把 PDF 或旧 PPT 重建为可编辑稿 | 指定页序、保留范围及可调整部分。逐页对照原稿，将正文、数据和关系恢复为适合编辑的对象。 |
| 只修几页 | 指出页码和问题，例如标题压住图例、双标错位。验收时对照目标页和相邻页。 |
| 翻译已有 PPT | 指定目标语言、术语和页码。保留原设计、数据和页序，按译文长度调整文本框与换行；图片中的文字单独约定。 |

## 选择视觉风格和使用模式

| 选择项 | 可选值 | 读者会看到什么 |
|---|---|---|
| 视觉风格 | 标准 ME2026 · `me2026` | 标准品牌封面、目录与致谢，白底正文配品牌蓝及紫色强调。 |
| 视觉风格 | 深色汇报 · `dark-report` | 深紫封面和章节页、白底正文和附录。正文使用固定页眉和左下 MEET EXPERIENCE｜MeetsocialGroup 双标。 |
| 使用模式 | 详细汇报 · `report` | 适合会前阅读、逐项审议。判断、依据、样本、单位和适用条件就近排布。 |
| 使用模式 | 管理层演讲 · `talk` | 适合现场投屏、引导决策。每页突出一个判断，讲者备注提示该指向哪个对象、讨论什么问题。 |

视觉风格和使用模式可以组合。**是否允许改写原文另行指定**。例如，选演讲版时仍可以要求逐字保序；从头规划时可明确只读当前材料，到新稿定版后再看参考稿。

## 安装与更新

### 让 Codex 安装或更新

复制下面的提示词即可。已有安装的用户也可以使用，尤其适用于从本地源码同步、安装目录内没有 Git 元数据的情况。

```text
请安装或更新 aidea-ppt-me，仓库为 https://github.com/stephenzzf/skill_aidea-ppt-mebrand，使用 main。
先定位当前 Codex 实际使用的技能目录，检查现有版本、安装方式和本地修改。
首次安装请安装运行依赖。Git 安装使用快进更新；从源码同步的安装先核对来源和差异，
将本地自定义内容备份到技能发现目录之外，再同步已核对的源码。
运行 npm run check，告诉我实际安装路径、版本和重新加载方法。
```

### 手动首次安装

准备 Git、Node.js 20.9 或以上版本及 Python 3。全页预览和字体检查需要 LibreOffice、Fontconfig 和中文字体（例如思源黑体 CN）；用 HTML/SVG 生成结构图需要 Chrome 或 Chromium。原生另存重开验证使用 Microsoft PowerPoint。

在 macOS 或 Linux 终端运行以下命令。若目标目录已有安装，使用上面的更新提示词。

```bash
(
  set -e
  skill_dir="${CODEX_HOME:-$HOME/.codex}/skills/aidea-ppt-me"
  mkdir -p "$(dirname "$skill_dir")"
  git clone --branch main https://github.com/stephenzzf/skill_aidea-ppt-mebrand.git "$skill_dir"
  cd "$skill_dir"
  npm ci
  python3 -m venv .cache/venv
  .cache/venv/bin/python -m pip install -r requirements.txt
  AIDEA_PPT_PYTHON="$PWD/.cache/venv/bin/python" npm run check
)
```

使用上述虚拟环境时，请让运行技能的终端或 Codex 环境能读到同一个 Python 设置。浏览器位于非标准路径时，用 `AIDEA_PPT_CHROME` 指定其可执行文件。安装或更新后重载技能，或重启 Codex 并在新对话中调用。

```bash
export AIDEA_PPT_PYTHON="${CODEX_HOME:-$HOME/.codex}/skills/aidea-ppt-me/.cache/venv/bin/python"
```

### 手动更新 Git 安装

以下命令适用于按上面步骤克隆的、工作区干净的 `main`。若使用本地源码同步或保留了自定义修改，使用前面的更新提示词。

```bash
(
  set -e
  cd "${CODEX_HOME:-$HOME/.codex}/skills/aidea-ppt-me"
  test -d .git && test "$(git branch --show-current)" = main || { echo "请核对安装方式和分支"; exit 1; }
  test -z "$(git status --porcelain)" || { echo "请先核对本地修改"; exit 1; }
  git pull --ff-only origin main
  npm ci
  .cache/venv/bin/python -m pip install -r requirements.txt
  AIDEA_PPT_PYTHON="$PWD/.cache/venv/bin/python" npm run check
  git rev-parse --short HEAD
)
```

## 在 Codex 中使用

附上文件，说明**给谁看、在哪里用、保留什么、交付什么**。用途不清时技能会先询问；用途已明确时直接给逐页方案。确认后开始制图、生成和验收。默认交付一份可编辑 PPTX，逐页对照 HTML、PDF 或其他附加材料可在请求中指定。

**详细汇报或白皮书**

```text
用 $aidea-ppt-me 只根据附件 Markdown，从头制作「深色汇报＋详细汇报版」，供管理层会前阅读。
按原文页序，保留数据、样本、单位、时间和来源。长附录采用页内索引，完整台账放在对应页备注。
请逐页选择版式与配图，先给方案。我确认后再生成可编辑 PPTX。
```

**现场决策演讲**

```text
用 $aidea-ppt-me 把附件做成标准 ME2026 管理层演讲版，用于 15 分钟现场决策。
保留章节顺序和数据口径。每页突出一个判断，讲者备注写清指读对象和讨论问题。
先给逐页方案和配图建议，确认后制作。
```

**局部修复或翻译**

```text
用 $aidea-ppt-me 只修附件 P7、P8，解决图例与负值条重叠的问题。
保留原始数值、页眉及左下双标。先说明修改范围，确认后在副本中制作。
```

```text
用 $aidea-ppt-me 将附件前 20 页翻译成商务英语，保留原设计、数据和可编辑性。
允许调整文本框与换行。先列出术语和图片内文字的处理方案，确认后制作。
```

## 使用已安装技能的命令行入口

以下示例可从任意工作目录运行。它使用安装包自带的两页 JSON Brief，输出到当前目录。第一页用语义图标说明报修受理，第二页用结构图说明故障分流。

```bash
skill_dir="${CODEX_HOME:-$HOME/.codex}/skills/aidea-ppt-me"
npm --prefix "$skill_dir" run generate -- \
  --style dark-report \
  --use report \
  --input "$skill_dir/references/examples/dark-report-visuals.json" \
  --out "$PWD/深色汇报示例.pptx"
```

制作自己的稿件时，将 `--input` 指向**符合所选风格的结构化 JSON Brief**；原始 Markdown 或 HTML 适合先在对话中规划。复现同一图片时，将已确认素材嵌入 Brief 或保存在其引用位置。需要切换到现场演讲时，选 `--use talk` 并在 Brief 中安排投屏重点与讲者备注。[查看可运行的示例 Brief](references/examples/dark-report-visuals.json) · [深色汇报页面字段](references/dark-report.md)

## 逐页选择版式与配图

| 读者要完成的任务 | 制作方式与编辑范围 |
|---|---|
| 比较指标、查找明细 | 优先使用 PowerPoint 原生图表或表格。独立调查各带样本和来源；比较相对变化时保留正负号、时间与共同基准。对称横条图以零为中心，文字标签放在条形外侧。 |
| 看懂结构、分叉或回路 | 简单关系用原生形状和连接线。复杂结构可用 HTML/CSS/SVG 绘制几何底图，在 PPT 内单独编辑业务标签和箭头；修改底图轮廓后重新生成。 |
| 看懂现场动作 | 优先复用与动作匹配的照片，缺图时由宿主按已确认方案生成纪实摄影式配图，并在页内标注「AI 情境示意」。 |
| 核验真实业务结果 | 使用有来源的截图或记录；脱敏后并排展示样本、统计期和限制。 |
| 查阅密集附录 | 页数可调整时分多页并重复表头；页数固定时保留稳定编号、主题索引与备注完整台账。解释成熟度时，可让同一业务场景贯穿各级并列出取证要求。 |

可复用版式还包括四象限、阶段与职责、案例索引、候选收敛、季度矩阵和来源登记表。[分析页版式与字段](references/analytical-layouts.md) · [代码绘图](references/code-visuals.md) · [图片选择与生成](references/native-imagery.md)

## 验收与参考稿对照

验收包含内容、结构、可编辑性、渲染和视觉检查。参考稿按主题对齐，记录每页先看到什么、口径在哪里、图帮助读者完成什么任务；遇到拆页或合页，以一对多方式比较。需要 PowerPoint 原生验证时，请指定希望实际修改的对象。

```text
新稿定版后，再与上一版及参考白皮书逐页对照，交付可离线查看的 HTML 报告。
在 PowerPoint 副本中实改一项图表数值和一个表格单元格，另存、关闭、重开，
核对图表、嵌入 Excel 和表格的修改值。交付稿保留原始数据。
```

42 页白皮书已完成这条流程，覆盖四张代表页重生成、数据口径与双标核对，以及 PowerPoint 中图表和表格实改重开。业务成稿与客户材料保存在项目工作区。[验收规范](references/qa-and-content-contract.md) · [参考稿评审方法](references/report-and-talk.md#reference-deck-review)

## 进一步查阅

[技能入口及任务流程](SKILL.md) · [运行环境与快速开始](references/quickstart.md) · [重建和修复](references/advanced-rebuild-playbooks.md) · [翻译与原稿对账](references/translation.md) · [PowerPoint 兼容性](references/powerpoint-compatibility.md)

## Public Version Limits

- No private PPT templates or thumbnails are bundled.
- No customer logos, private screenshots, or generated business decks are included.
- The skill provides reusable brand and layout guidance; project-specific proof, metrics, and assets must be supplied by the user.
- `assets/me-2026-app/` contains brand assets extracted from the user-provided ME2026 PPTX for the requested Openclaw/GitHub distribution path. Confirm authorization before redistributing this skill outside that approved context.
- `assets/me-2026-app/deloitte-white-icons/` contains source-traceable optional icon geometry extracted from the user-provided Deloitte `.potx` and recolored to ME2026. Confirm third-party redistribution authorization before publishing this asset subset.

## License

No open-source license has been added yet. Treat this repository as shared usage only unless a license is added by the owner.
