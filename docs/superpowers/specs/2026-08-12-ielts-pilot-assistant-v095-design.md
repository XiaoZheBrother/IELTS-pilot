# IELTS Pilot 学习助手 0.95 设计

## 目标

把当前“能诊断、能对话”的学习助手升级为可公开测试的学习教练：关键判断受本地证据约束，建议可以直接进入专项练习、错题复盘或写作报告，计划能够记录完成状态并根据新成绩更新，同时补齐会话管理、渐进输出、桌面验证和 Windows 安装包。

版本号采用 `0.9.5`，用户可见里程碑名称为“0.95”。

## 已确认范围

本设计完整覆盖用户批准的 0.95 清单：

1. 结构化 AI 回答、证据引用、可信度和质量回归。
2. 从建议跳转到专项练习、筛选错题，并显示练习前后变化。
3. 渐进输出、停止、重试、复制、删除、新建对话和历史会话。
4. 今日计划、周计划、完成状态、预计耗时和动态调整。
5. 写作报告对比、长期重复问题、原文证据入口、改写练习和下一题推荐。
6. Web 与 Windows 桌面验证、异常场景、安装包、文档与发布准备。

不在 0.95 中实现账号系统、云端会话、后台主动提醒、付费、多 Provider 预设或长期跨设备 AI 记忆。

## 设计方向与现状审计

Reading this as: 现有编辑式学习工作台中的高密度教练工具，面向自学 IELTS 的桌面用户，延续纸张、蓝色信号色、直角表面和本地优先的产品语言。

- `DESIGN_VARIANCE: 4`：保留现有信息架构与直角网格，不重做全站视觉。
- `MOTION_INTENSITY: 3`：只用可中断过渡表达面板切换、复制成功和输出状态。
- `VISUAL_DENSITY: 7`：通过“诊断 / 计划 / 对话”三个视图减少单页滚动，证据保持可扫描。
- 设计系统：继续使用项目原生 CSS token，不引入新 UI 框架或图标库。
- 形状规则：数据面板、输入框和按钮保持直角；只有悬浮入口和真实状态点使用圆形。
- 动效规则：仅 `transform`、`opacity`、`background-color` 和 `box-shadow`，不使用 `transition: all`，遵守 `prefers-reduced-motion`。

当前 MVP 已具备确定性本地诊断、安全 Web 网关、Windows DPAPI 凭据、单会话历史和真实 AI 对话。需要升级的主要风险是模型自由文本可能夸大证据、建议不能直接执行、历史会话不可管理以及写作趋势样本过少时缺少明确边界。

## 结构化回答与证据约束

### 证据目录

`buildEvidenceCatalog(snapshot)` 为每个可发送事实生成稳定 ID：

- `reading.attempt_count`
- `reading.average_band`
- `reading.best_band`
- `reading.trend`
- `reading.weakest_type`
- `reading.open_errors`
- `writing.report_count`
- `writing.latest_band`
- `writing.criterion.<criterion>`

每条证据含 `label`、`value`、`sampleSize` 和 `confidence`。目录不含作文正文、用户答案、API Key 或完整本地数据库。

### AI 返回协议

Provider 必须返回 JSON：

```ts
interface CoachAnswer {
  schemaVersion: 1
  conclusion: { text: string; confidence: 'insufficient' | 'medium' | 'high'; evidenceIds: string[] }
  facts: Array<{ text: string; evidenceIds: string[] }>
  inferences: Array<{ text: string; confidence: 'insufficient' | 'medium' | 'high'; evidenceIds: string[] }>
  actions: Array<{
    id: string
    title: string
    reason: string
    kind: 'practice' | 'errors' | 'writing' | 'plan'
    targetId?: string
  }>
}
```

`parseCoachAnswer` 执行以下约束：

- 只接受已知字段、合法长度和最多三条行动。
- 所有 evidence ID 必须存在于当前目录。
- `high` 结论必须至少引用一条高可信证据。
- 样本不足时不得使用“稳定”“确定”“一定”“保证提分”等确定性措辞。
- 模型动作只表达意图，最终路由由本地 `resolveCoachActions` 计算，模型不能提供任意 URL。
- 解析失败时不展示未经验证的原始文本，回退到本地确定性诊断并提供重试。

## 建议到练习闭环

本地动作解析器根据薄弱题型、题库和错题生成可执行动作：

- `practice`：选择包含该题型且题量最多的练习，跳转 `/practice/:testId`。
- `errors`：跳转 `/errors?type=:questionType&state=learning`。
- `writing`：跳转最近报告 `/writing/report/:reportId`，没有报告时进入 `/writing`。
- `plan`：切换助手的计划视图并生成计划。

每个练习型计划项保存创建时的基线正确率、题量和尝试时间。完成后只统计创建时间之后的新尝试，并显示“基线 / 本轮 / 变化”。没有新样本时显示“等待完成练习”，不伪造提升。

错题页读取 URL query 初始化题型和状态。建议入口不自动创建或提交练习，仍由用户显式点击开始。

## 学习计划

`LearningPlanRepository` 使用 `ielts-pilot:learning-plan:v1` 保存一个滚动周计划。计划项包含：

- 标题、原因、类型、路由、预计分钟；
- 创建时间、状态、完成时间；
- 可选题型、写作维度和基线；
- 由本地规则生成的 `sourceEvidenceIds`。

`buildLearningPlan` 默认生成三项：薄弱题型专项、未掌握错题复盘、写作优先项或补充写作样本。今日计划优先展示最紧急的两项，周计划展示全部项目。用户手动勾选完成；新尝试或报告出现后，`refreshLearningPlan` 更新成效，不覆盖用户已经完成的状态。

## 写作深度接入

`LearningSnapshot.writing` 增加：

- 最近最多五份报告的 ID、日期、总分和四维分数；
- 每个维度的平均分、最近变化与样本数；
- 最近三份报告中重复出现的优先项；
- 最近报告的证据数量和首要优先项。

发送给 AI 的快照仍不包含作文正文和证据原文。界面可以通过本地报告 ID 跳转到原文证据。只有至少两份报告时才显示维度趋势；只有一份时明确标注“单次样本”。“生成改写练习”会填入一个不含作文正文的结构化问题，并由用户点击发送。

## 会话与输出体验

对话存储升级为 v2：

- 最多保留 12 个本地会话，每个会话最多 40 条消息。
- 会话含标题、创建时间、更新时间和消息。
- 支持新建、切换、删除会话，v1 单会话数据自动迁移。
- 用户消息保留纯文本；AI 消息保存验证后的 `CoachAnswer` 与渲染文本。

发送流程：

1. 持久化用户问题。
2. 显示与最终回答结构一致的骨架状态。
3. 请求完成并通过 JSON 校验后，按语义块渐进显示结论、事实、推断和行动。
4. “停止”通过 `AbortController` 取消 Web 请求；桌面命令不能中断时忽略迟到结果。
5. 失败时恢复问题并显示“重试”；重新生成替换最后一条 AI 回复，不重复用户消息。

结构化回答通过 Vue 模板渲染，不使用 `v-html`。兼容旧会话的纯文本只按换行安全显示，HTML 永远作为文本处理。

## 组件结构

- `src/domain/coachAnswer.ts`：协议解析、证据校验、渲染文本和回退。
- `src/domain/learningPlan.ts`：动作推荐、计划生成和成效计算。
- `src/domain/learningAssistant.ts`：扩展快照、写作聚合和 provider prompt。
- `src/storage/assistantConversationRepository.ts`：v2 多会话迁移与持久化。
- `src/storage/learningPlanRepository.ts`：计划持久化。
- `src/components/LearningAssistant.vue`：外壳、三个视图和命令协调。
- `src/components/CoachAnswerView.vue`：结构化回答与动作。
- `src/components/LearningPlanView.vue`：今日 / 周计划与成效。
- `src/components/ConversationHistory.vue`：会话选择和删除。
- `src/platform/learningAssistantClient.ts`：可取消请求和渐进块回调。

## 错误、安全与隐私

- API Key 继续由 Web 网关或 Windows DPAPI 管理。
- Endpoint 禁止 URL userinfo，所有消息继续执行敏感凭据检测。
- Provider 原始 JSON 不落盘；只保存验证后的字段。
- 停止、超时、限流、无效 JSON 和配置错误使用不同可恢复提示。
- 计划与会话删除只影响当前设备，并提供明确按钮，不做隐式清理。
- AI 建议不是官方 IELTS 评分，所有 Band 继续标记为练习估算或辅助反馈。

## 验证与发布

- 单元测试覆盖协议拒绝、证据引用、样本门槛、动作路由、计划更新、多会话迁移、停止与重试、写作趋势。
- 集成测试覆盖网关结构化聊天、异常映射和凭据不泄露。
- E2E 使用演示数据走查诊断、计划、动作、会话和真实 AI 回答。
- Windows 测试覆盖 DPAPI roundtrip、桌面连接和完整 NSIS 构建。
- 版本升级到 `0.9.5`，生成安装包和校验值；远端 Release 仅在完整验证与签名配置可用后创建。

## 验收标准

1. AI 的事实与结论均能在界面展开对应的本地证据，未知证据和夸大结论被拒绝。
2. 演示数据下可以从薄弱项一键进入正确的专项练习或筛选后的错题本。
3. 完成新练习后计划项显示真实前后变化，没有新练习时不显示虚假提升。
4. 用户可以创建、切换、删除会话，停止、重试、重新生成、复制和删除消息。
5. 今日与周计划可勾选完成，并能在新阅读或写作数据出现后刷新。
6. 写作趋势在两份以上报告时生效，单报告明确标注样本不足，可跳转报告证据。
7. Web 与 Windows 均能用真实配置对话，API Key 不进入前端存储、日志、截图或 Git。
8. 全量单元、集成、E2E、Rust、生产构建和 NSIS 构建通过，最终截图覆盖诊断、计划和结构化 AI 回答。

## 自查结论

规格没有待定项或占位符。0.95 以可靠性和学习闭环为边界，不引入账号、云端会话和后台主动任务。模型只提出受限意图，本地代码持有证据、路由、计划状态和最终安全边界。

