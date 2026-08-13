# SignPath Foundation 申请资料

本文档用于准备 SignPath Foundation 的 Open Source Code Signing 申请，不包含 API Token、个人身份材料或其他秘密。

## 项目信息

- Project name: IELTS Pilot
- Repository: https://github.com/XiaoZheBrother/IELTS-pilot
- Releases: https://github.com/XiaoZheBrother/IELTS-pilot/releases
- Maintainer: https://github.com/XiaoZheBrother
- Software license: MIT
- Original learning-content license: CC BY 4.0
- Platform: Windows x64 desktop application, built with Tauri 2, Rust, Vue and TypeScript
- Distribution: GitHub Releases, NSIS `Setup.exe`
- Build workflow: `.github/workflows/windows-release.yml`

## English project summary

IELTS Pilot is a local-first, open-source IELTS reading and writing practice studio for Windows and the web. It provides original practice materials, deterministic local reading scoring, writing assistance, review workflows, content-package management, encrypted backups and an optional evidence-led AI learning assistant. It is not affiliated with IELTS and does not distribute official IELTS exam materials.

## Why code signing is requested

The project distributes a Windows NSIS installer directly from GitHub Releases. Authenticode signing is requested so users can verify the publisher and build origin, reduce avoidable SmartScreen friction, and distinguish official automated releases from modified third-party binaries.

## Public policy links

- License: https://github.com/XiaoZheBrother/IELTS-pilot/blob/main/LICENSE
- Content license: https://github.com/XiaoZheBrother/IELTS-pilot/blob/main/CONTENT-LICENSE.md
- Privacy policy: https://github.com/XiaoZheBrother/IELTS-pilot/blob/main/PRIVACY.md
- Code signing policy: https://github.com/XiaoZheBrother/IELTS-pilot/blob/main/CODE_SIGNING_POLICY.md
- Windows release documentation: https://github.com/XiaoZheBrother/IELTS-pilot/blob/main/docs/releasing-windows.md

## 提交前人工确认

- [ ] GitHub 账号已启用多因素认证；
- [ ] 维护者确认拥有仓库内现有代码和原创学习内容的开源授权权利；
- [ ] SignPath 账号已创建并接受其服务条款；
- [ ] 申请表中的项目、维护者和联系信息由维护者本人核对；
- [ ] SignPath GitHub App 的仓库访问范围限制为 `IELTS-pilot`；
- [ ] 获批后再创建并保存 `SIGNPATH_API_TOKEN`、organization ID、project slug 和 signing policy slug；
- [ ] 首次签名后验证 Authenticode 发布者、时间戳、Git commit、安装器哈希和 updater `latest.json`。

申请提交、服务条款接受、MFA 确认以及任何身份或联系信息必须由维护者本人完成。仓库不得保存 SignPath API Token 或签名私钥。
