# Windows 安全发布

IELTS Pilot 使用两层互不替代的签名：

1. Tauri updater 签名验证升级包来自本项目且未被修改，该验证不能关闭；
2. Windows Authenticode 让操作系统识别商业发布者，需要另行购买受信任的代码签名证书。

## Updater 密钥

仓库只保存 updater 公钥。私钥应离线备份，并作为以下 GitHub Actions secrets 配置：

- `TAURI_SIGNING_PRIVATE_KEY`：私钥文件内容或 base64 编码内容；
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`：生成私钥时使用的密码，无密码密钥则为空。

丢失私钥后，已安装版本无法验证由新密钥签出的更新。此时只能发布新的完整安装包并要求用户手动升级，所以私钥至少需要两份分离的加密备份。

本地生成新项目密钥：

```powershell
npm run tauri -- signer generate -w D:\secure\ielts-pilot-updater.key
```

将 `.pub` 文件的完整内容写入 `src-tauri/tauri.conf.json`，私钥不得放在仓库、构建日志、Release 附件或 `.env` 中。

## 本地构建

普通安装包不要求 updater 私钥：

```powershell
npm run desktop:build
```

生成可供应用内更新使用的安装包与 `.sig`：

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = 'D:\secure\ielts-pilot-updater.key'
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ''
npm run desktop:release
```

`desktop:release` 通过 `src-tauri/tauri.release.conf.json` 开启 updater 产物；普通构建保持关闭，避免没有私钥的贡献者无法打包。

## 可选 Authenticode

GitHub Actions 支持以下附加 secrets：

- `WINDOWS_CERTIFICATE`：PFX 文件的 base64；
- `WINDOWS_CERTIFICATE_PASSWORD`：PFX 导出密码。

流水线只在证书存在时导入证书、读取 thumbprint 并生成临时 Tauri 配置。证书缺失时仍会产生 updater 签名的 NSIS 包，但 Windows SmartScreen 可能显示“未知发布者”。SSL 证书不能用于代码签名；时间戳服务和证书要求应以证书签发机构文档为准。

## 发布检查

1. 同步 `package.json`、`src-tauri/Cargo.toml` 和 `src-tauri/tauri.conf.json` 版本。
2. 运行 `npm run check` 与 `cargo check --manifest-path src-tauri/Cargo.toml`。
3. 推送 `v*` 标签，等待 Windows workflow 完成。
4. 检查 Release 包含 NSIS 安装器、`.sig` 和 `latest.json`。
5. 发布草稿后，从旧版桌面应用的“更新”页执行一次真实升级。

