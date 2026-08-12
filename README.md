# IELTS Pilot

一个本地优先的 IELTS 阅读练习工作台。v0.7 同时提供浏览器版与 Windows 桌面版，并加入签名应用更新和可选端到端加密同步。

> 本项目不是 IELTS 官方产品，不包含官方真题，也不提供官方成绩。

## v0.7 功能清单

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

## 快速启动浏览器版

环境要求：Node.js 20.19+ 或 22.12+。

```bash
npm install
npm run dev
```

浏览器打开终端给出的本地地址。练习草稿、成绩、批注和内容包保存在当前浏览器的 `localStorage` 中。

可选加密同步不要求账号。进入“同步”后可以只导出密文文件，也可以连接自选服务；口令和访问令牌不会写入本地存储。协议与参考服务见 [加密同步协议](docs/encrypted-sync-protocol.md)。

## Windows 桌面版

开发模式还需要 Rust stable、Microsoft C++ Build Tools 和 Windows WebView2：

```bash
npm run desktop:dev
```

生成 Windows 安装包：

```bash
npm run desktop:build
```

产物位于 `src-tauri/target/release/bundle/nsis/`。安装器按当前用户安装，不需要管理员权限。当前开源构建没有商业代码签名，Windows SmartScreen 可能显示“未知发布者”；请只从本仓库 Release 或自己校验过的源码构建。

推送 `v*` 标签也会触发 `.github/workflows/windows-release.yml`，验证 Web 应用后生成草稿 Release 和 NSIS 安装器。

普通安装器使用 `npm run desktop:build`；包含 updater `.sig` 的发布构建使用 `npm run desktop:release`，并要求在环境变量中提供项目 updater 私钥。密钥与可选 Authenticode 配置见 [Windows 安全发布文档](docs/releasing-windows.md)。

## 评分机制

当前评分不是外部 AI Skill，也不依赖大模型，而是一套可重复、可测试、可审计的本地规则：

1. 单选及配对题按选项键匹配。
2. 多选题将答案作为无序集合比较，并校验选择数量。
3. True / False / Not Given 与 Yes / No / Not Given 支持 `T`、`YES`、`NG`、`not-given` 等常见等价输入。
4. 简答及完成类题目会统一大小写、空格、Unicode 形式和首尾标点，再与题目声明的可接受答案比对，同时检查单词数限制。
5. 单篇练习按正确率折算为 40 题原始分；完整模考直接按 40 题计算，再使用项目内置的 Academic Reading 区间估算 Band。
6. 每份结果记录评分版本 `reading-v2`、题型、用户答案、可接受答案、解释及原文引用位置。

Band 只用于练习反馈，不能替代官方 IELTS 成绩。写作与口语如在未来引入 AI 评分，应使用独立量表、版本化提示词和人工复核边界，不与当前客观题规则混用。

## 内容包与版权边界

题库包使用声明式 JSON，当前格式为 `schemaVersion: 2`，同时兼容旧版 `1`。导入器检查权利人、许可、版本、日期、练习与题目 ID、题型专属字段、答案、原文定位、脚本内容、内置题库冲突和可选完整性摘要。导入分为“读取并预览”和“确认安装”两步，不执行内容包代码。

请只导入原创、公共领域或已获明确授权的材料。使用者需要自行确认许可证允许修改、再分发和目标使用方式。字段说明见 [内容包格式文档](docs/content-package-format.md)，可导入样例见 [sample-content-package-v2.json](examples/sample-content-package-v2.json)。

## 验证

```bash
# 类型检查、全部单元测试与生产构建
npm run check

# 首次运行 E2E 前安装 Chromium
npx playwright install chromium
npm run test:e2e

# Web 验证后检查 Rust 桌面壳
npm run desktop:check
```

## 技术结构

```text
src/
├── components/     # 题目控件、共享阅读器、复盘与题库包组件
├── composables/    # 练习、模考、偏好、批注、倒计时和自动保存
├── data/           # 5 篇原创文章、54 道题和完整模考定义
├── domain/         # 题型、评分、错题、批注、分析和内容包生命周期
├── platform/       # 浏览器、Tauri、updater 与同步传输适配器
├── storage/        # v1-v3 迁移、v4 本地仓储、实体时钟及同步设置
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

v0.5 完成情况见 [ROADMAP.md](docs/ROADMAP.md)。账号、云同步、远程内容市场、自动更新、商业代码签名、听力、词汇 SRS、写作 AI 评分、口语 AI 评分和付费能力不在本里程碑内。
