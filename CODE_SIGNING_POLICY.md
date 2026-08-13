# IELTS Pilot 代码签名政策

## 当前状态

IELTS Pilot 的 Tauri updater 签名已经启用，用于验证应用内更新来自本项目且未被篡改。Windows 目前尚未启用 Authenticode；包括 v0.9.10 在内的当前安装包仍可能显示“未知发布者”。

项目正在申请 SignPath Foundation 开源代码签名。申请获批并完成流水线接入后，本项目将使用：

> Free code signing provided by SignPath.io, certificate by SignPath Foundation.

在 GitHub Release 明确显示 Authenticode 验证结果之前，上述说明不表示现有安装包已经获得 SignPath 签名。

## 签名范围与来源

申请获批后，只签署满足以下条件的 Windows 发布产物：

- 源代码来自公开仓库 [XiaoZheBrother/IELTS-pilot](https://github.com/XiaoZheBrother/IELTS-pilot)；
- 由仓库内 `.github/workflows/windows-release.yml` 在 GitHub 托管的 Windows runner 上构建；
- 对应公开的 `v*` Git 标签和可追溯 Git commit；
- 完成类型检查、单元测试、生产构建和 Tauri NSIS 打包；
- 产物为 IELTS Pilot 自身的 Windows 可执行文件、NSIS 安装器及其发布元数据；
- 不包含用户导入题库、本地转换结果或未获授权的第三方材料。

签名私钥必须保存在 SignPath 管理的 HSM 中，不得导出到开发电脑、仓库、GitHub Secrets、构建日志或 Release 附件。

## 团队角色

- Committer 与 Reviewer：[XiaoZheBrother](https://github.com/XiaoZheBrother)。外部贡献必须由维护者审查后合并；维护者提交仍需通过自动化测试。
- Signing Approver：[XiaoZheBrother](https://github.com/XiaoZheBrother)。只有与公开标签和发布说明一致的构建可以批准签名。

所有具有仓库写入权或 SignPath 权限的成员必须为 GitHub 和 SignPath 启用多因素认证。角色发生变化时，本政策同步更新。

## 验证与事件响应

用户应只从 [GitHub Releases](https://github.com/XiaoZheBrother/IELTS-pilot/releases) 下载安装包。Authenticode 启用后，可在 PowerShell 中检查：

```powershell
Get-AuthenticodeSignature -LiteralPath '.\IELTS Pilot_x64-setup.exe'
```

如发现签名产物与公开源码不一致、签名密钥疑似滥用、恶意代码或发布流程被绕过，维护者将停止发布、撤销相关访问权限、联系 SignPath 处理证书或签名请求，并通过 GitHub Security Advisory 或 Release 公告说明受影响版本。

隐私边界见 [隐私政策](PRIVACY.md)，软件和内容许可证见 [MIT License](LICENSE) 与 [原创内容许可](CONTENT-LICENSE.md)。
