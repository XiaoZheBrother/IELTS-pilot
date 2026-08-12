# IELTS Atlas 阅读题库转换器设计

## 目标

把本机 `IELTS-practice/assets/generated/reading-exams` 中的 `ReadingExamSourceV1` 数据批量转换为 IELTS Pilot `schemaVersion: 2` 内容包，使其可以通过“题库包管理”页面逐包预览并安装。转换结果仅输出到被 Git 忽略的 `artifacts/`，不把第三方题文提交到仓库。

当前源数据共有 234 篇阅读材料、645 个题组和 3143 道题；其中 227 篇另有 `ReadingExplanationV1` 中文解析。转换必须覆盖全部文章和答案，缺少解析时提供明确的回退说明，而不是丢弃题目。

## 输入与安全边界

转换器接收以下命令行参数：

- `--source`：参考项目根目录，默认自动寻找相邻的 `IELTS-practice`。
- `--output`：输出目录，默认 `artifacts/import/ielts-practice-reading`。
- `--package-size`：每包文章数，默认 25。

源文件是只包含注册调用的生成型 JavaScript。转换器在无 `process`、`require`、文件系统和网络对象的 Node `vm` 沙箱中执行单个文件，沙箱只暴露捕获注册数据的最小 registry，并设置一秒超时。任何未注册、重复 ID 或结构缺失都会终止转换并生成非零退出码。

输出中保留参考仓库 URL和原始文件名，但明确标注“仅限个人学习；转换器不授予第三方题源的再分发权”。生成内容包不进入版本控制，也不创建远程签名目录。

## 转换架构

实现分为四个边界清晰的模块，集中在一个可导入的 Node ESM 工具中：

1. `loadRegisteredPayload`：安全读取两类注册文件，返回不可执行的数据对象。
2. `extractPassage`：使用 JSDOM 把 passage HTML 转为标题和纯文本段落，删除脚本、样式、表单、拖拽占位和考试操作说明。
3. `convertQuestion`：根据题组 kind、控件和说明文本映射到 IELTS Pilot 的 12 种题型，提取提示、选项、答案、字数限制与解析。
4. `buildPackages`：按 P1/P2/P3 和稳定文件顺序分包，生成全局唯一的包、练习与问题 ID，并写出质量报告和 SHA-256 清单。

解析数据按 `questionId` 建立索引。存在专属解析时写入完整解析；不存在时写入“由参考题库答案转换，原项目未提供逐题解析”的回退文本。

## 题型映射

| 源题组 | IELTS Pilot 题型 |
|---|---|
| `true_false_not_given` | `true-false-not-given` |
| `yes_no_not_given` | `yes-no-not-given` |
| `single_choice` / 单答案 `multi_choice` | `multiple-choice` |
| 多答案 `multi_choice` | `multiple-select` |
| 含 headings 的 `matching` | `matching-headings` |
| 含 paragraphs/information 的 `matching` | `matching-information` |
| 含 endings 的 `matching` | `matching-sentence-endings` |
| 其他 `matching` / `classification` | `matching-features` |
| `short_answer` | `short-answer` |
| `sentence_completion` / notes/table/flow | `sentence-completion` |
| 带词库的 `summary_completion` | `summary-word-bank` |
| 其他 `summary_completion` | `sentence-completion` |
| `diagram_completion` | `diagram-label` |

选项优先读取当前题目的 radio/select/checkbox，其次读取题组公共的 drag pool。输入框会替换为可读的下划线占位。题目容器不完整时使用题组说明和显示题号组成可辨认提示，不允许生成空提示。

答案数组在多选题中表示必须同时选择的一组答案；在填空和简答题中表示可替代答案。True/False/Not Given 与 Yes/No/Not Given 会归一为小写规范值。

## 原文定位与质量报告

转换器先利用 passage 中的 `data-question`、锚点和段落包装器建立精确映射。没有显式锚点时，通过题干与答案的英文关键词和各段文字计算重叠度，选择最相关段落。仍无可靠线索时回退到第一段，并在质量报告中记录低置信定位。

质量报告包含：

- 输入/输出文章数与题目数；
- 各题型数量；
- 使用专属解析和回退解析的数量；
- 精确、推断与回退定位数量；
- 每个包的文件名、题量、字节数和 SHA-256；
- 所有警告明细。

每个输出包在写盘前调用与应用一致的必要字段约束；随后使用独立的 TypeScript 验证命令调用 `validateContentPackage`，确保最终文件能被真实导入器接受。

## 验收

1. 单元测试覆盖安全注册捕获、HTML 清洗、代表性题型、答案数组语义、解析索引和定位回退。
2. Fixture 集成测试生成 v2 包并通过现有 `validateContentPackage`。
3. 对本机完整题库运行转换，要求 234 篇、3143 道题全部进入输出，0 个无效内容包。
4. 使用 Playwright 在实际“题库包管理”页面选择一个生成包，完成预览和安装，并确认题库出现相应文章。
5. 仓库秘密扫描和 Git 状态确认生成题文只存在于 `artifacts/`。

## 非目标

- 不公开分发或提交参考题库内容。
- 不转换听力音频、PDF或参考项目的练习记录。
- 不承诺自动推断的原文定位等同人工校对。
- 不绕过 IELTS Pilot 的许可确认、冲突检测或安装确认。
