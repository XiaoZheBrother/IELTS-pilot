# IELTS Pilot

一个本地优先的 IELTS 阅读与写作练习工作台。v0.9 同时提供浏览器版与 Windows 桌面版，在完整阅读闭环上加入原创 Academic Writing Task 1 / Task 2、可审计的 AI 辅助反馈与一键演示数据。

> 本项目不是 IELTS 官方产品，不包含官方真题，也不提供官方成绩。

> **Windows 用户：**[直接下载 IELTS Pilot v0.9.2 安装包（x64 Setup.exe）](https://github.com/XiaoZheBrother/IELTS-pilot/releases/download/v0.9.2/IELTS.Pilot_0.9.2_x64-setup.exe)。其他版本与校验文件见 [GitHub Releases](https://github.com/XiaoZheBrother/IELTS-pilot/releases/latest)。

完整的产品能力、部署方式、评分机制、安全边界和逐功能走查，请参阅 [v0.9 产品功能说明书](docs/IELTS-Pilot-v0.9-产品功能说明书.md)。

## v0.9 功能清单

- 5 篇项目原创英文文章，共 54 道题；其中前 3 篇组成 40 题、60 分钟完整阅读模考
- 12 种题型：单选、多选、T/F/NG、Y/N/NG、标题配对、信息配对、特征配对、句尾配对、简答、句子填空、摘要选词、图示填空
- 单篇专项练习与三篇完整模考，答案、位置、剩余时间、暂停状态和标记自动保存
- 纸张、护眼、夜间三种主题，以及字号、行距、阅读宽度和默认计时设置
- 原文选区高亮、三种标记色、笔记编辑与删除
- `J` / `K` 切题、`F` 标记、`1` / `2` 切换移动端面板、`Ctrl/Cmd+Enter` 提交
- 本地即时评分、正确率和 Academic Reading Band 练习估算
- 逐题原文定位与解析、题目收藏、打印或导出 PDF
- 独立错题本，支持筛选、标记掌握和生成强化练习
- 文章与题目收藏、学习趋势、题型正确率、时长及成绩历史
- v4 本地备份、实体时钟和删除墓碑，可确定性合并多设备冲突
- 内容包 v2 的校验、预览、SHA-256 摘要、安装、升级、冲突阻止和卸载
- 本地题库编辑器，可编辑文章、来源、12 种题型、答案、解析和原文定位，支持草稿与 JSON 导出
- Tauri 2 Windows 桌面壳与 NSIS `Setup.exe`，以及 GitHub Actions 构建工作流
- 桌面更新中心、Tauri updater 强制签名校验、下载进度与显式安装确认
- PBKDF2 + AES-256-GCM 加密保险库、手动迁移、HTTPS/本机 REST 同步和 ETag 并发保护
- ECDSA P-256 签名内容目录、设备本地发布者信任库、密钥轮换阻止和原始包 SHA-256 验证
- 发布者密钥生成、目录签名与验证 CLI，以及不含私钥的公开协议样例
- 2 道项目原创 Academic Writing 任务：带数据图表的 Task 1 与议论文 Task 2，并内置原创演示作文
- 写作字数、计时、自动草稿、显式发送确认、历史报告与原文证据回溯
- 按任务回应、连贯衔接、词汇资源、语法多样性与准确性四项维度生成结构化辅助 Band；程序独立复算总分
- 悬浮式 **IELTS Pilot 学习助手**：点击后展示当前状态、主要问题、提高方向与轻量证据，不占用常驻侧边栏
- 学习助手基于阅读尝试、题型正确率、未掌握错题与写作报告生成本地诊断；AI 只负责围绕这份有界快照继续对话
- AI 未配置或暂时离线时，本地诊断仍可使用；对话记录仅保存在当前设备，API Key 不进入浏览器存储或对话历史
- 浏览器生产网关与 Tauri Rust HTTPS 命令两条安全调用路径；API Key 不进入浏览器存储、仓库或报告
- 设置页一键生成演示档案，覆盖阅读历史、草稿、错题、收藏、批注、学习分析与写作报告

## 快速启动浏览器版

环境要求：Node.js 20.19+ 或 22.12+。

```bash
npm install
npm run dev
```

浏览器打开终端给出的本地地址。练习草稿、成绩、批注和内容包保存在当前浏览器的 `localStorage` 中。

需要在浏览器版启用真实写作辅助评估和 IELTS Pilot 学习助手 AI 对话时，先构建并由本机网关托管静态站点：

```bash
npm run build
npm run serve:production -- --config "你的 AI 配置文件路径" --port 4390
```

浏览器打开 `http://127.0.0.1:4390`。配置支持 JSON，或按“接口提示、API Key、模型、完整 Chat Completions 地址”分行保存的文本；也可使用 `IELTS_PILOT_AI_ENDPOINT`、`IELTS_PILOT_AI_KEY`、`IELTS_PILOT_AI_MODEL` 环境变量。网关只在内存中读取凭据，不会把密钥返回前端或写入日志。公网部署必须在网关前配置 HTTPS、访问控制和限流，不能把密钥放进 Vite 前端环境变量。

可选加密同步不要求账号。进入“同步”后可以只导出密文文件，也可以连接自选服务；口令和访问令牌不会写入本地存储。协议与参考服务见 [加密同步协议](docs/encrypted-sync-protocol.md)。

“内容源”允许订阅经授权的远程签名目录。应用先校验目录签名，再要求用户核对发布者指纹；之后仍会逐包校验原始字节摘要并展示安装预览。信任决策独立保存在当前设备，不随练习备份同步。格式、密钥轮换和发布 CLI 见 [签名内容目录文档](docs/signed-content-catalog.md)。

## Windows 桌面版

不需要开发环境时，直接下载并运行 [IELTS Pilot v0.9.2 Windows x64 安装包](https://github.com/XiaoZheBrother/IELTS-pilot/releases/download/v0.9.2/IELTS.Pilot_0.9.2_x64-setup.exe)。如果已安装 v0.9.0 或 v0.9.1，请不要卸载，直接运行 v0.9.2 安装包覆盖安装一次；从 v0.9.2 开始即可使用应用内签名更新。安装器按当前用户安装，不需要管理员权限。由于当前开源构建没有商业 Authenticode 证书，Windows SmartScreen 可能显示“未知发布者”。

开发模式还需要 Rust stable、Microsoft C++ Build Tools 和 Windows WebView2：

```bash
npm run desktop:dev
```

生成 Windows 安装包：

```bash
npm run desktop:build
```

本地构建产物位于 `src-tauri/target/release/bundle/nsis/`。请只从本仓库 Release 或自己校验过的源码构建。

推送 `v*` 标签也会触发 `.github/workflows/windows-release.yml`，验证 Web 应用后发布正式 Release、NSIS 安装器、updater 签名和 `latest.json`。

普通安装器使用 `npm run desktop:build`；包含 updater `.sig` 的发布构建使用 `npm run desktop:release`，并要求在环境变量中提供项目 updater 私钥。密钥与可选 Authenticode 配置见 [Windows 安全发布文档](docs/releasing-windows.md)。

## 评分机制

阅读评分不是外部 AI Skill，也不依赖大模型，而是一套可重复、可测试、可审计的本地规则：

1. 单选及配对题按选项键匹配。
2. 多选题将答案作为无序集合比较，并校验选择数量。
3. True / False / Not Given 与 Yes / No / Not Given 支持 `T`、`YES`、`NG`、`not-given` 等常见等价输入。
4. 简答及完成类题目会统一大小写、空格、Unicode 形式和首尾标点，再与题目声明的可接受答案比对，同时检查单词数限制。
5. 单篇练习按正确率折算为 40 题原始分；完整模考直接按 40 题计算，再使用项目内置的 Academic Reading 区间估算 Band。
6. 每份结果记录评分版本 `reading-v2`、题型、用户答案、可接受答案、解释及原文引用位置。

写作辅助评估使用独立的 `writing-v1` 版本化提示词和公开四维量表。模型只能返回四个合法半分档及理由，应用会校验字段、过滤无法在作文原文中找到的“证据引用”，并用程序将四项等权平均后归一至 0.5。报告保留模型、提示词版本、请求编号和生成时间；作文仅在用户确认后发送。它不是官方评分，也不能替代认证考官或教师复核。

阅读与写作 Band 都只用于练习反馈，不能替代官方 IELTS 成绩。

## 内容包与版权边界

题库包使用声明式 JSON，当前格式为 `schemaVersion: 2`，同时兼容旧版 `1`。导入器检查权利人、许可、版本、日期、练习与题目 ID、题型专属字段、答案、原文定位、脚本内容、内置题库冲突和可选完整性摘要。导入分为“读取并预览”和“确认安装”两步，不执行内容包代码。

请只导入原创、公共领域或已获明确授权的材料。使用者需要自行确认许可证允许修改、再分发和目标使用方式。字段说明见 [内容包格式文档](docs/content-package-format.md)，可导入样例见 [sample-content-package-v2.json](examples/sample-content-package-v2.json)。

### 本地转换参考项目阅读题库

仓库提供一个本地转换工具，可将你自己持有的 [IELTS-practice](https://github.com/sallowayma-git/IELTS-practice) `ReadingExamSourceV1` 数据转换成 IELTS Pilot v2 JSON 内容包：

```bash
npm run content:convert:legacy -- --source "D:\path\to\IELTS-practice" --output "artifacts\import\ielts-practice-reading" --package-size 25
npm run content:validate -- --input "artifacts\import\ielts-practice-reading"
```

按当前参考项目快照会生成 11 个可导入包，覆盖 P1/P2/P3 共 234 篇、3143 道题，同时生成 `conversion-report.json`、`SHA256SUMS.txt` 和 `IMPORT-INSTRUCTIONS.txt`。在另一台电脑中打开“题库 → 题库包管理”，一次选择全部 `private-atlas-*.json`，查看批量预览后点击“安装全部可用内容包”即可。

转换结果默认位于被 Git 忽略的 `artifacts/`，不会提交或发布第三方题文。转换器只处理本机已有数据，不代表参考项目或第三方权利人授予了修改、再分发或商业使用许可；请在复制到其他设备前自行确认你拥有相应使用权。

## 验证

```bash
# 类型检查、全部单元测试与生产构建
npm run check

# 首次运行 E2E 前安装 Chromium
npx playwright install chromium
npm run test:e2e

# Web 验证后检查 Rust 桌面壳
npm run desktop:check

# 加密同步服务和发布者 CLI 的真实进程集成测试
npm run test:integration
```

## 技术结构

```text
src/
├── components/     # 题目控件、共享阅读器、复盘与题库包组件
├── composables/    # 练习、模考、偏好、批注、倒计时和自动保存
├── data/           # 5 篇原创阅读、54 道题、完整模考和 2 道原创写作任务
├── domain/         # 阅读/写作评分、冲突合并、保险库、内容包与目录签名
├── platform/       # 浏览器网关、Tauri AI 命令、updater、同步与内容源适配器
├── storage/        # v4 阅读仓储、写作报告、同步设置与设备信任库
├── styles/         # 主题变量、页面壳、作答台、工具页和打印样式
└── views/          # 工作台、练习、复盘、设置、错题、收藏和题库管理
src-tauri/          # Tauri 2 Rust 壳、权限与 NSIS 配置
```

技术栈：Vue 3、TypeScript、Vite、Vue Router、Vitest、Vue Test Utils、Playwright、Tauri 2、Rust。

## 参考来源与权利说明

本项目在早期产品调研、功能范围和交互流程设计阶段参考了 [sallowayma-git/IELTS-practice](https://github.com/sallowayma-git/IELTS-practice)。感谢原项目作者提供公开参考。

- 本仓库没有复制该参考项目的源代码、题库、文章、音频、图片或其他受版权保护内容。
- 当前内置的 5 篇文章、54 道题、答案与解析均为 IELTS Pilot 项目原创练习材料，并在数据中标注来源属性。
- 上述链接与署名只用于披露灵感和调研来源，不等于获得原项目内容的复制、修改或再分发授权。
- “IELTS” 是相关权利人的商标。本项目与 IELTS 官方机构无隶属、认可或合作关系。

正式公开发布前，维护者仍应根据目标地区、内容来源和商业模式进行独立的许可证与法律审查。

## 路线图边界

v0.1 至 v0.9 完成情况见 [ROADMAP.md](docs/ROADMAP.md)。托管账号服务、商业 Authenticode 证书、听力、词汇 SRS、口语 AI 辅助反馈、官方评分和付费能力不在本里程碑内。
