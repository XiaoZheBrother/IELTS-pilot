# IELTS Pilot 签名内容目录

## 信任模型

签名目录用于分发原创、公共领域或已明确授权的练习包。它不把“可以联网”当成“可以信任”：

1. 应用先校验目录 JSON 结构和 ECDSA P-256 / SHA-256 签名。
2. 用户核对 256 位公钥指纹，并在当前设备明确固定这个指纹。
3. 应用才允许下载目录中的包，随后对原始响应字节计算 SHA-256。
4. 摘要、字节长度、包 ID、版本和内容包字段全部一致后，只展示安装预览。
5. 用户再次确认才写入本地题库；已安装记录保留发布者 ID、目录 ID 和签名状态。

发布者信任库独立于练习备份和加密同步。目录无法自行新增信任，也无法静默替换已固定的密钥。发生密钥轮换时，所有下载会停止，直到用户通过独立渠道核对并信任新指纹。

## 目录格式

签名覆盖除 `signature` 外的完整规范 JSON：对象键按字典序排列，数组保持原顺序。目录版本 1 使用固定算法 `ECDSA-P256-SHA256`。

```json
{
  "schemaVersion": 1,
  "catalogId": "publisher-catalog",
  "name": "Publisher Catalog",
  "description": "Authorized practice packages.",
  "updatedAt": "2026-08-12T08:00:00.000Z",
  "publisher": {
    "publisherId": "publisher-id",
    "name": "Publisher Name",
    "website": "https://publisher.example",
    "publicKey": { "kty": "EC", "crv": "P-256", "x": "…", "y": "…" }
  },
  "packages": [
    {
      "packageId": "practice-pack",
      "name": "Practice Pack",
      "version": "1.0.0",
      "description": "Original practice.",
      "license": "CC-BY-4.0",
      "url": "https://cdn.publisher.example/practice-pack.json",
      "sha256": "64-lowercase-hex-characters",
      "size": 4096,
      "updatedAt": "2026-08-12T08:00:00.000Z"
    }
  ],
  "signature": { "algorithm": "ECDSA-P256-SHA256", "value": "base64url-p1363-signature" }
}
```

目录与包 URL 必须使用 HTTPS；只有 `localhost`、`127.0.0.1` 和 `::1` 可以使用 HTTP。目录上限 1 MiB、单包上限 10 MiB、单目录最多 500 个包。

## 发布者命令行

生成密钥（私钥文件默认被 `.gitignore` 排除）：

```bash
npm run publisher:keys -- --out-dir ./publisher-secrets
```

把公钥和包元数据写入未签名目录后签名：

```bash
npm run publisher:sign -- \
  --catalog ./unsigned-catalog.json \
  --private-key ./publisher-secrets/publisher-private.jwk \
  --out ./catalog.json
```

验证目录签名；若提供包目录，还会校验 URL 文件名对应文件的字节摘要与长度：

```bash
npm run publisher:verify -- \
  --catalog ./catalog.json \
  --package-root ./published-files
```

私钥只能保存在离线或受严格访问控制的位置。仓库内的 [签名目录](../examples/signed-catalog/catalog.json) 与 [示例包](../examples/signed-catalog/package.json) 仅为公开协议示例；其临时私钥生成后已删除，不能用于后续发布。

## 密钥轮换与撤销

- 轮换：用新私钥发布目录，通过官网、Release 签名或其他独立渠道公布新指纹；用户在应用中重新确认。
- 撤销：用户可以随时撤销某发布者，所有相关源立即锁定。发布者也应在独立官方渠道发布撤销公告。
- 恢复：删除内容源不会删除已安装包；卸载包也不会删除历史练习成绩。
