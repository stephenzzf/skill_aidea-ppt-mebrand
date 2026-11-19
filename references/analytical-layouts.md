# 按读者的任务选择正文版式

以下方法适用于 ME2026 的详细汇报和演讲。先写下读者要完成的动作，如“根据价值和难度选择下一步”或“从编号查回调查样本”。这个动作决定主要图形、阅读顺序和证据的位置。深色汇报的生成入口支持下表的六种页面角色，沿用既有页眉和双标。

| 读者的动作 | 正文安排 | 验收问题 |
|---|---|---|
| 在两个独立维度上做选择 | 用 `quadrant`。横轴向右、纵轴向上，两端标明高低。每个格子放行动与条件，侧栏放进入矩阵前应回答的问题。单维优先级可用序列表。 | 调换输入数组顺序后，“高价值、低可行”仍落在左上吗？高高象限值得强调时，原文是否支持这项优先级？ |
| 判断同一能力在哪一级 | 用 `maturity`。递升高度表达有序关系，名称和证据沿同一基线体系排列。若有实例，将同一场景逐级对齐，给出可检查的行为。实际值、目标值和建议分开标明。 | 能否从相邻两级读出升级需具备的证据？阶梯高度只编码级别顺序。 |
| 阅读两项独立研究 | 用 `evidence-chart`。一项研究的精确值进入原生图表；“近九成”等文字估计保留限定词。右侧研究独立标识对象、日期、样本及计算口径。展示厂商自报、预测或缺失的基线时，让这些条件留在数字附近。 | 改动一项数字并另存重开后，工作簿、图表缓存和实际显示是否一致？两项调查能否各自找到分母？ |
| 识别同口径的方向变化 | 用 `signed-comparison`。用真实正负数绘制共用零线、左右对称尺度的横条，时间标签保留在同一侧。流量规模、样本覆盖率等其他指标旁列；预测另行标注。 | 是否能直接看出相对哪个基准变高或变低？能否区分相对百分比、百分点差和另一项指标的同比增幅？ |
| 查证某条引用 | 用 `source-register`。允许增页时，按完整记录续排，重复表头和稳定编号；原页数固定时，提供“编号范围／代表记录／口径／示例使用页”索引，并在本页备注逐项保存来源表。关键业务限定语仍在正文。 | 能否从正文编号找回发布者、统计期、样本和状态？将所有续页拼回后，逐行逐列对得上输入吗？ |
| 看清检查层、阶段及回退 | 用 `coded-diagram`。先按信息角色划分覆盖全局的带、可追踪的节点以及并排的决策记录；绘制必要几何，再叠加原生业务文字与方向线。 | 修改某一阶段名称后仍能读出前进和回退吗？图层的绘制源、渲染尺寸和覆盖坐标能否复现？ |

配色宜分配给有含义的差别。用同一色系标同一层级，用一种强调色标当前决策。两项独立调查可并列；观察指标只有在读者、时间和分母确实连续时才适合漏斗。真实产品、人物动作和业务证据分别走已核实的截图、情境图片或原始材料路径。页面单靠文字和原生对象即可说清时，保留留白。

## 选择主图与辅区

数据有正、负方向且采用同一口径时，用共用零线的原生条形图显示方向变化；预测和观察值分区。流程与责任同时重要时，用一条路径引导先后顺序，再按相同阶段对齐负责人。读者要查单个案例、引用或业务对象时，保持一项一行及稳定编号，并写上可跳查的详情页码。阶段与责任同时出现时，一条横向阶段路径可搭配一张纵向责任表；当责任只按角色约定，勿替源稿编造角色与阶段的逐格分工。除非源稿确认候选明细，漏斗和筛选图只显示已知数量、明确列出的候选及空缺。

## 深色汇报的输入字段

页面共有 `kicker`、`title`、`section` 和 `notes`。新版式通过已有 `npm run generate -- --style dark-report --use report --input brief.json --out report.pptx` 入口调用。可用以下结构替换现有 brief 中的一页。

| role | 字段 |
|---|---|
| `quadrant` | `xAxis`、`yAxis`、四个 `cells: [{x, y, title, detail}]`。x、y 分别取 `low` 或 `high`。`highlight` 默认选右上；用 `{x,y}` 指定重点，或用 `null` 保持中性。可加 `sideTitle`、`sideItems: [{title, detail}]`、`note`。 |
| `maturity` | `levels: [{level, title, detail}]` 按序给出 3–5 级。`exampleTitle` 和 `examples` 可给出与级数相同的场景示例。 |
| `evidence-chart` | `chartTitle`、等长的 `labels` 与 `values`、`numberFormat`、`chartSource`；`approximation` 单列估计。独立研究用 `comparisonTitle`、`comparison: [{value, label}]`、`comparisonSource`。百分比以 0.56 和格式 `0%` 表示 56%。 |
| `signed-comparison` | `chartTitle`、一至六组等长的 `labels`、`values`、`numberFormat` 和 `chartSource`；`contextTitle` 和一至三项 `context: [{label,value,detail}]` 将不同单位的背景数据放在独立文本区；`note` 可标明预测期限。 |
| `evidence-layers` | `layers` 按查阅顺序给 2–4 组 `{label,status,result,detail}`，`status` 为 `observed` 或 `unavailable`。缺数时用文字说明其边界。右栏使用 `contextHeading` 和 1–3 组 `context: [{label,detail}]`，页底可用 `note`。分层等宽，数值、单位、状态说明和监测条件在 PPT 中可编辑。 |
| `stage-responsibilities` | `stageHeading`、`stages: [{number,title,detail}]`、`responsibilityHeading`、两个 `headers` 和 `responsibilities: [{role,duty}]`。上方依次排 2–5 个阶段，编号用字符串以保留前导零，下方用原生表格列职责。 |
| `case-index` | `lead`、四个 `headers`、`cases: [{subject,task,evidence,locator}]`。每个对象独占一行，`evidence` 写明来源边界，`locator` 使用原材料中的定位标识。 |
| `candidate-selection` | `lead`、`pool: {count,label,exampleHeading,examples,disclosure}`、`shortlist: {count,label,items:[{title,reason}]}` 和 `evidence`。候选总数与已披露示例分别传入。示例不全时填写 disclosure，入选项为 1–3 条且实际条数须与 shortlist.count 相符，逐项给出原文理由。数量后的名称由 `label` 指定，如“个候选方向”。 |
| `source-register` | `headers`、矩形 `rows`、相对列宽 `columnWidths`、`lead`、`note`。`mode: paginate` 允许扩展页数；`mode: locked` 另传 `indexHeaders`、`indexRows`、`indexColumnWidths` 供页内查阅。 |
| `coded-diagram` | `visual: {source, file, alt, x, y, w, h}` 绑定源文件和渲染 PNG。`labels: [{text, x, y, w, h, size, color, bold, align}]` 提供可编辑业务文字；可选 `connectors: [{x1, y1, x2, y2, head, tail, color, width, dash}]` 中 head 与 tail 控制起点和终点箭头。位置用整页英寸坐标，`note` 保留页底说明区。相对路径以 CLI 的输入 JSON 所在目录为基准。源和 PNG 可由离线代码绘图入口产生。 |

这三种版式均支持可选的页内 `note`，完整讲者备注使用 `notes`。案例和职责表按列宽与实际文本长度分配行高。超出一页容量时，CLI 提示拆分；按原稿授权决定续页，保留表头和定位标识。

### 同源对照验证

将同一主题的原文、旧版和参考成稿对齐。记录读者先看到的事实、接下来查找的条件，以及需要几次跳转才能取得证据。分别留存实际渲染及可编辑对象证据。参考附件有目录或附录续页时做一对多映射；为保持页数而移入备注的内容，在页内给出查阅入口。若要求沿用品牌位置，分别比对标题、导航、双标的对象坐标和原生渲染。代表页试验同时覆盖输入异常和不同业务题材，保留首次失败及原输入的复验结果。
