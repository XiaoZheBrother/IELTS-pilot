# IELTS Pilot 加密同步协议

## 设计目标

v0.7 仍以本机数据为准。用户可以把版本 4 练习备份加密成便携文件，也可以把同一密文交给自选 REST 服务保存。服务端不持有口令、解密密钥或明文练习数据；应用也不会持久化同步口令和访问令牌。

这不是账户系统。档案 ID 只是远程对象名，身份校验由用户提供的服务和临时 Bearer token 负责。

## 保险库信封

文件是 UTF-8 JSON，协议字段固定如下：

```json
{
  "protocol": "ielts-pilot-vault",
  "version": 1,
  "profileId": "main",
  "createdAt": "2026-08-12T05:00:00.000Z",
  "kdf": {
    "name": "PBKDF2",
    "hash": "SHA-256",
    "iterations": 310000,
    "salt": "base64url-encoded-16-bytes"
  },
  "cipher": {
    "name": "AES-GCM",
    "tagLength": 128,
    "iv": "base64url-encoded-12-bytes"
  },
  "ciphertext": "base64url-encoded-ciphertext-and-tag"
}
```

- 密钥通过 PBKDF2-HMAC-SHA-256 和独立随机盐派生，输出 AES-256 密钥。
- AES-GCM 的附加认证数据绑定协议版本、档案、创建时间和全部加密参数，因此修改档案 ID、IV、盐、迭代次数或密文都会导致解密失败。
- 口令至少 12 个字符。项目不保存口令，也没有找回或重置口令的后门。

## 备份版本与冲突

明文负载是版本 4 练习备份。每个草稿、练习记录、内容包、编辑草稿、批注、收藏、掌握状态和阅读偏好都有 ISO 时间戳；删除操作留下 tombstone。合并规则为：

1. 比较同一实体的写入时钟和删除 tombstone，时间较新者获胜。
2. 同一时间发生写入与删除时，删除获胜，防止旧数据复活。
3. 同一时间的两个不同写入使用规范 JSON 字节序确定胜者。
4. 数组和对象按稳定 ID 排序，保证 `merge(a, b)` 与 `merge(b, a)` 得到相同字节。
5. 写入本机前显示新增、冲突、删除和未变化数量，并要求明确确认。

## REST 接口

端点必须是 HTTPS；只有 `localhost`、`127.0.0.1` 和 `::1` 可以使用 HTTP。

```text
GET /v1/vaults/:profileId
PUT /v1/vaults/:profileId
Authorization: Bearer <temporary token>
```

- `GET`：`200` 返回保险库 JSON 和强 `ETag`；不存在时返回 `404`。
- 首次 `PUT`：携带 `If-None-Match: *`，成功返回 `204` 和新 `ETag`。
- 更新 `PUT`：携带上次读取的 `If-Match`，版本过期返回 `412`。
- 应用遇到 `412` 会重新拉取、解密、合并并重试一次，避免无限覆盖循环。

## 本地参考服务

开发和局域网自托管可以使用仓库内的最小参考实现：

```powershell
$env:IELTS_PILOT_SYNC_TOKEN = 'replace-with-a-long-random-token'
npm run sync:server -- --port 8787 --data-dir D:\secure\ielts-pilot-vaults
```

服务默认只监听 `127.0.0.1`，请求体上限 10 MiB，写入通过临时文件原子替换，并使用密文 SHA-256 作为强 ETag。公开到互联网前必须放在带 TLS、限流、备份和访问审计的反向代理后。

## 威胁边界

可防护：服务端数据库泄漏、传输后密文被修改、并发覆盖、拿到单个保险库文件但不知道口令的攻击者。

不负责：已经控制用户设备或浏览器进程的恶意软件、弱口令离线猜测、用户丢失口令、恶意服务拒绝服务或回滚到旧但仍有效的密文。对重要数据应同时保留离线保险库备份。
