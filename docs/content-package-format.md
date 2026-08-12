# IELTS Pilot 内容包格式 v2

IELTS Pilot 只导入声明式 JSON，不执行内容包中的脚本。安装前会校验元数据、练习 ID、题目 ID、答案与原文定位，随后展示来源、许可、题量、冲突和 SHA-256 摘要供用户确认。

## 顶层字段

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `schemaVersion` | 是 | 当前值为 `2`，旧版 `1` 会在导入时迁移。 |
| `packageId` | 是 | 内容包稳定 ID，升级版本时保持不变。 |
| `version` | 是 | 语义化版本，例如 `1.2.0`。 |
| `name` / `description` | 是 | 展示名称与简介。 |
| `owner` / `license` / `note` | 是 | 权利人、许可协议和来源说明。 |
| `sourceUrl` | 否 | 原始发布页或授权说明链接。 |
| `createdAt` / `updatedAt` | 是 | ISO 8601 时间。 |
| `minimumAppVersion` | 是 | 最低兼容版本。 |
| `changelog` | 是 | 当前版本变更说明。 |
| `integrity` | 否 | 规范化内容的 `sha256:<hex>` 摘要。 |
| `sets` | 是 | 一个或多个完整练习。 |

每个练习需包含文章、来源信息与题目。每道题都必须提供 `sourceRef.sectionIndex` 和 `sourceRef.paragraphIndex`，索引从 `0` 开始且必须指向实际段落。

## 支持的题型

`multiple-choice`、`multiple-select`、`true-false-not-given`、`yes-no-not-given`、`matching-headings`、`matching-information`、`matching-features`、`matching-sentence-endings`、`short-answer`、`sentence-completion`、`summary-word-bank`、`diagram-label`。

选择与匹配题提供 `options`；多选题额外提供 `selectLimit`；简答、句子填空和图示题提供 `wordLimit`。`acceptedAnswers` 中的字符串代表可替代答案，嵌套字符串数组代表一组必须同时选中的答案。

完整可导入示例见 [`examples/sample-content-package-v2.json`](../examples/sample-content-package-v2.json)。也可以在应用的“题库包管理 → 创建本地题库”中可视化编辑并导出。

## 本地旧题库迁移

`tools/convert-ielts-practice-reading.mjs` 用于把本机已有的 [IELTS-practice](https://github.com/sallowayma-git/IELTS-practice) 生成式阅读数据迁移为本格式。它在受限 `node:vm` 环境中捕获数据注册，不直接导入源 JavaScript 模块；输出按 P1/P2/P3 分包，并附质量报告、SHA-256 清单和简体中文导入说明。

```bash
npm run content:convert:legacy -- --source "D:\path\to\IELTS-practice" --output "artifacts\import\ielts-practice-reading" --package-size 25
npm run content:validate -- --input "artifacts\import\ielts-practice-reading"
```

转换命令不会授予源材料的修改、再分发或商业使用权。生成文件默认被 Git 忽略，仅适合在你有权使用这些材料的设备间私人迁移。

## 安全与版权

- 只导入原创、公共领域或已获授权的内容。
- HTML 中的脚本标记会被拒绝；内容包不会获得文件系统或网络执行权限。
- 相同 `packageId` 只能安装更高版本；与内置练习或其他包重复的练习 ID 会阻止安装。
- 卸载内容包不会删除历史成绩，但对应文章不再出现在题库中。
