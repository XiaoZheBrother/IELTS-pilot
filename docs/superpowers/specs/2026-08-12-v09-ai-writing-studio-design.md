# IELTS Pilot v0.9 AI 写作工作室设计规格

## 1. 目标与范围

v0.9 在现有本地优先 IELTS 阅读平台中增加一个可真实调用模型的“AI 写作工作室”，覆盖原创 Academic Writing Task 1 与 Task 2 练习、草稿、辅助评分、证据链反馈和历史报告。评分只作为学习辅助，不冒充官方 IELTS 成绩，也不改变现有阅读客观题的确定性评分机制。

本里程碑同时交付：

- 可在浏览器生产构建中运行的安全 AI 网关；
- 可在 Tauri 桌面端通过一次性配置调用模型的原生通道；
- 使用外部配置完成的真实模型连通性与评分走查；
- 覆盖现有全部主要功能的演示数据走查截图；
- Markdown 与 PDF 两种格式的完整产品功能说明书；
- v0.9 Windows NSIS 安装包。

不纳入 v0.9：口语录音与转写、听力、词汇 SRS、账号系统、公共云托管、商业 Authenticode 证书和官方评分承诺。

## 2. 已确认的依据与约束

- IELTS 官方与英国文化教育协会公开材料将写作评分拆为四个维度：Task Achievement / Task Response、Coherence and Cohesion、Lexical Resource、Grammatical Range and Accuracy。
- Academic Writing Task 1 的建议最低字数为 150，Task 2 为 250；Task 2 在正式考试写作总分中的权重更高。本产品按单篇任务给出辅助反馈，不推导整场正式写作成绩。
- 当前可用 AI 配置是火山方舟 OpenAI 兼容 Chat Completions 接口。配置文件包含 base URL、API key、模型名和端点；API key 不进入仓库、前端构建、截图、日志、文档或本地持久化。
- 现有产品采用 Vue 3、TypeScript、浏览器 localStorage、Tauri 2 和编辑台式视觉语言。v0.9 延续该架构和视觉系统。

参考：

- https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-writing
- https://takeielts.britishcouncil.org/teach-ielts/test-information/assessment
- https://takeielts.britishcouncil.org/sites/default/files/ielts_writing_band_descriptors.pdf
- https://api.volcengine.com/api-docs/view?action=ChatCompletions&serviceCode=ark&version=2024-01-01

## 3. 方案比较与决策

### 方案 A：浏览器直接请求模型

优点是实现最少。缺点是 API key 必须进入浏览器内存，请求受 CORS 约束，静态部署很难保护密钥，也无法形成清晰的服务边界。因此不采用。

### 方案 B：只提供服务器代理

优点是浏览器端安全简单。缺点是桌面安装包必须依赖一个常驻外部服务，破坏“安装后可本地使用”的方向。因此不单独采用。

### 方案 C：同一领域协议 + 双安全适配器

浏览器生产部署通过同源 Node 网关调用模型；Tauri 桌面端通过 Rust command 调用模型。两条路径共用前端请求结构、提示词版本和响应校验。网页密钥只存在网关进程，桌面密钥只存在一次性 IPC 与 Rust 请求内存中。此方案兼顾真实部署、桌面体验与密钥边界，是本里程碑采用的方案。

## 4. 用户流程

### 4.1 选择任务

用户从主导航进入“写作”，在 Task 1 数据图表和 Task 2 议论文两项原创练习中选择。任务卡显示建议时长、最低字数、题型和训练重点。

### 4.2 写作与草稿

工作区左侧显示任务材料，右侧提供写作编辑器、计时器、字数与段落统计。输入后自动保存本地草稿。用户可以加载项目内置演示作文，也可以清空重写。

### 4.3 明示提交边界

点击“生成 AI 辅助评估”后，界面先展示发送范围：题目、作文正文、任务类型、字数和提示词版本。用户必须确认后才发送。密钥永不随历史记录保存。

### 4.4 等待、错误与恢复

请求期间按钮进入禁用状态，页面显示分阶段状态而不是空白等待：准备量表、发送文本、验证反馈。超时、未配置、限流、返回格式错误分别给出可恢复说明，保留作文草稿并允许重试。

### 4.5 报告

报告以四维量表为核心，显示：

- 计算得到的总体辅助 Band；
- 四项半分制分数与简短理由；
- 3 项优势、3 项优先改进；
- 从原文中校验过的证据句、问题说明和建议改写；
- 字数、模型、提示词版本、生成时间、免责声明。

总体辅助 Band 由程序根据四项分数求平均并四舍五入到最近 0.5，模型返回的总体分不作为最终展示依据。证据 quote 必须能在作文原文中找到，否则不会进入可引用证据列表。

## 5. 功能与文件边界

### 5.1 领域层

- `src/domain/writingAssessment.ts`：类型、字数统计、分数归一、提示词构造、模型 JSON 提取与严格验证。
- `src/data/writingTasks.ts`：两项原创任务、可视化数据和演示作文。

领域层不依赖 Vue、网络或 localStorage，可独立测试。

### 5.2 存储层

- `src/storage/writingRepository.ts`：版本 1 的本地草稿与报告历史。

只持久化作文、任务、报告、模型标识、提示词版本和时间，不持久化 API key、Authorization header 或完整模型原始响应。写作数据在 v0.9 中保持设备本地，不自动加入阅读备份或加密同步。

### 5.3 平台层

- `src/platform/writingAssessmentClient.ts`：定义统一 client；浏览器使用 `/api/v1/writing/evaluate`，Tauri 使用 `invoke('evaluate_writing')`。
- `tools/ai-writing-server.mjs`：读取外部配置、提供健康检查、静态生产文件、SPA 回退和受限 AI 代理。
- `src-tauri/src/ai_writing.rs`：解析一次性配置、限制 URL/正文大小、调用 HTTPS Chat Completions、返回结构化响应。

### 5.4 界面层

- `src/views/WritingStudioView.vue`：任务选择、编辑器、草稿和提交确认。
- `src/views/WritingReportView.vue`：量表、证据、建议和历史元数据。
- `src/components/WritingRubric.vue`：四维量表可视化。
- `src/styles/writing.css`：写作工作室与报告样式。

Vue 视图通过依赖模块获取 repository/client，测试可替换实现，避免把网络逻辑写进组件。

## 6. AI 协议

请求输入：

```json
{
  "taskId": "academic-task-2-library-balance",
  "taskType": "task-2",
  "prompt": "...",
  "essay": "...",
  "wordCount": 287,
  "promptVersion": "writing-v1"
}
```

模型必须返回 JSON 对象，包含四项 criterion、summary、strengths、priorities 和 evidence。服务允许模型把 JSON 放在 Markdown fence 中，但客户端会先提取再校验。任何缺失字段、超范围 band、非半分值或超过数量上限的数组都会被拒绝或裁剪到安全结构。

网关限制：

- 只监听 `127.0.0.1`，除非显式传入其他 host；
- 请求正文最大 32 KiB；
- 作文字数 40 到 1200，任务提示不超过 4 KiB；
- 上游只允许 HTTPS；本地测试适配器不包含在生产路径；
- 上游请求 90 秒超时；
- 错误响应不包含密钥、Authorization 或原始配置；
- 日志只记录 request id、耗时、模型和状态。

## 7. 视觉设计

Design Read：这是面向成年 IELTS 学习者的高专注产品工作区，延续“纸张 + 编辑账本 + 电光蓝信号”的编辑式语言，不采用儿童教育模板或通用 AI 紫色渐变。

设计参数：

- Design variance 5：结构清晰但保留不对称编辑布局；
- Motion 3：仅使用 150-240 ms 的状态过渡与一次性报告进入动效；
- Density 6：写作工作区信息密度较高，但正文编辑区保持宽松。

关键视觉：

- 工作区使用 5/7 双栏，题目材料像“任务简报”，作文区像“稿件台”；
- 字数、时间和发送状态使用等宽数字；
- 量表用横向 0-9 刻度和单一蓝色强调，不用装饰性图表；
- 证据句采用原文摘录、问题标签、建议改写三段式；
- 所有按钮至少 44 x 44 px，错误信息使用 `role="alert"`，加载状态保留布局高度；
- 标题使用 `text-wrap: balance`，短说明使用 `text-wrap: pretty`，禁止 `transition: all` 和 `will-change: all`；
- 375、768、1024、1440 px 均不得产生横向滚动。

## 8. 演示数据与全功能走查

提供一个不含第三方题目的演示档案，覆盖：阅读成绩、错题、收藏、批注、偏好、内容包、内容源、同步状态、写作草稿与 AI 报告。

最终走查在生产构建服务器而非 Vite 开发服务器上进行。自动化脚本按真实 UI 顺序完成导入、练习恢复、结果查看、内容包安装、签名内容源信任、加密导出/同步、写作评分、设置与更新检查，并将截图输出到 `artifacts/v0.9-walkthrough/`。AI 报告截图使用用户提供的外部配置完成一次真实调用；自动测试继续使用确定性 fixture，避免 CI 依赖外部模型。

## 9. 测试策略

- 单元测试：字数、分数归一、JSON 提取、证据 quote 校验、存储迁移、视图状态。
- 集成测试：AI 网关健康检查、静态文件、请求限制、上游 fixture、配置解析；Tauri `cargo check`。
- E2E：任务选择、演示作文、确认提交、fixture 报告、历史恢复、移动端无横向溢出。
- 真实连通性：外部配置调用健康探针与一份演示作文，检查模型名、结构化响应和证据数，不输出密钥或作文之外的敏感内容。
- 发布验证：`npm run check`、`npm run test:integration`、`npm run test:e2e`、`cargo check`、NSIS 构建、生产服务器健康检查。

## 10. 文档与权利边界

产品说明书覆盖用户角色、功能地图、详细操作、数据与安全、评分机制、部署、故障恢复和限制，并嵌入走查截图。README 保留对 `sallowayma-git/IELTS-practice` 的参考说明；v0.9 写作题目和演示作文均为本项目原创，不复制官方样题或第三方范文。公开量表只作为评分维度依据，产品明确提示 AI 输出需人工判断。

## 11. 验收标准

- 浏览器生产部署和 Tauri 桌面通道都存在可执行实现；
- 外部配置不进入 Git，仓库安全扫描不出现 API key；
- 两项原创任务可写作、自动保存、加载演示、提交并生成报告；
- 报告四项分数合法，总体分由程序计算，证据均可回溯原文；
- 真实 AI 配置完成一次端到端评分；
- 完整功能走查截图可读、无截断、无横向溢出；
- 产品说明书 Markdown 与 PDF 内容完整，PDF 每页视觉检查通过；
- 全量测试与 v0.9 Windows 打包通过；
- 所有变更按约定 Git 身份和 Conventional Commit 规范提交并合并到本地 `main`。
