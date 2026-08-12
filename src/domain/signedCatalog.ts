import { canonicalJson } from './canonicalJson'

export interface CatalogPackageV1 {
  packageId: string
  name: string
  version: string
  description: string
  license: string
  url: string
  sha256: string
  size: number
  updatedAt: string
}

export interface CatalogPublisherV1 {
  publisherId: string
  name: string
  website?: string
  publicKey: JsonWebKey
}

export interface UnsignedContentCatalogV1 {
  schemaVersion: 1
  catalogId: string
  name: string
  description: string
  updatedAt: string
  publisher: CatalogPublisherV1
  packages: CatalogPackageV1[]
}

export interface SignedContentCatalogV1 extends UnsignedContentCatalogV1 {
  signature: {
    algorithm: 'ECDSA-P256-SHA256'
    value: string
  }
}

export interface VerifiedContentCatalog {
  verified: true
  catalog: SignedContentCatalogV1
  fingerprint: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringField(value: unknown, label: string, pattern?: RegExp): string {
  if (typeof value !== 'string' || !value.trim() || (pattern && !pattern.test(value))) throw new Error(`签名目录格式无效：${label}。`)
  return value
}

function isoDate(value: unknown, label: string): string {
  const text = stringField(value, label)
  if (!Number.isFinite(Date.parse(text))) throw new Error(`签名目录格式无效：${label}。`)
  return new Date(text).toISOString()
}

function decodeBase64Url(value: string, label: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error(`签名目录格式无效：${label}。`)
  try {
    const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '='))
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
  } catch { throw new Error(`签名目录格式无效：${label}。`) }
}

export function validatePublisherKey(value: unknown): JsonWebKey {
  if (!isRecord(value) || value.kty !== 'EC' || value.crv !== 'P-256' || typeof value.x !== 'string' || typeof value.y !== 'string'
    || ('d' in value) || (value.alg !== undefined && value.alg !== 'ES256')
    || (value.use !== undefined && value.use !== 'sig')) {
    throw new Error('签名目录格式无效：发布者公钥必须是 P-256 验签 JWK。')
  }
  if (decodeBase64Url(value.x, 'publicKey.x').length !== 32 || decodeBase64Url(value.y, 'publicKey.y').length !== 32) {
    throw new Error('签名目录格式无效：发布者公钥坐标长度错误。')
  }
  return JSON.parse(JSON.stringify(value)) as JsonWebKey
}

export function validateContentUrl(value: string, label = 'URL'): URL {
  let url: URL
  try { url = new URL(value) } catch { throw new Error(`签名目录格式无效：${label} 不是有效 URL。`) }
  if (url.username || url.password) throw new Error(`签名目录格式无效：${label} 不可包含凭据。`)
  const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]'
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) throw new Error(`签名目录格式无效：${label} 必须使用 HTTPS。`)
  return url
}

function parsePublisher(value: unknown): CatalogPublisherV1 {
  if (!isRecord(value)) throw new Error('签名目录格式无效：publisher。')
  const publisher: CatalogPublisherV1 = {
    publisherId: stringField(value.publisherId, 'publisher.publisherId', /^[A-Za-z0-9._-]{1,128}$/u),
    name: stringField(value.name, 'publisher.name'),
    publicKey: validatePublisherKey(value.publicKey),
  }
  if (value.website !== undefined) publisher.website = validateContentUrl(stringField(value.website, 'publisher.website'), 'publisher.website').href
  return publisher
}

function parsePackage(value: unknown): CatalogPackageV1 {
  if (!isRecord(value)) throw new Error('签名目录格式无效：package。')
  const version = stringField(value.version, 'package.version', /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u)
  if (!Number.isInteger(value.size) || Number(value.size) < 1 || Number(value.size) > 10 * 1024 * 1024) throw new Error('签名目录格式无效：package.size。')
  return {
    packageId: stringField(value.packageId, 'package.packageId', /^[A-Za-z0-9._-]{1,128}$/u),
    name: stringField(value.name, 'package.name'), version,
    description: stringField(value.description, 'package.description'),
    license: stringField(value.license, 'package.license'),
    url: validateContentUrl(stringField(value.url, 'package.url'), 'package.url').href,
    sha256: stringField(value.sha256, 'package.sha256', /^[a-f0-9]{64}$/u),
    size: Number(value.size), updatedAt: isoDate(value.updatedAt, 'package.updatedAt'),
  }
}

export function parseSignedCatalog(value: string | unknown): SignedContentCatalogV1 {
  let raw: unknown = value
  if (typeof value === 'string') {
    try { raw = JSON.parse(value) as unknown } catch { throw new Error('签名目录不是有效 JSON。') }
  }
  if (!isRecord(raw) || raw.schemaVersion !== 1 || !Array.isArray(raw.packages) || raw.packages.length === 0 || raw.packages.length > 500
    || !isRecord(raw.signature) || raw.signature.algorithm !== 'ECDSA-P256-SHA256' || typeof raw.signature.value !== 'string') {
    throw new Error('签名目录格式无效或协议版本不受支持。')
  }
  if (decodeBase64Url(raw.signature.value, 'signature.value').length !== 64) throw new Error('签名目录格式无效：ECDSA 签名长度错误。')
  const packages = raw.packages.map(parsePackage)
  if (new Set(packages.map(({ packageId }) => packageId)).size !== packages.length) throw new Error('签名目录格式无效：packageId 不可重复。')
  return {
    schemaVersion: 1,
    catalogId: stringField(raw.catalogId, 'catalogId', /^[A-Za-z0-9._-]{1,128}$/u),
    name: stringField(raw.name, 'name'), description: stringField(raw.description, 'description'),
    updatedAt: isoDate(raw.updatedAt, 'updatedAt'), publisher: parsePublisher(raw.publisher), packages,
    signature: { algorithm: 'ECDSA-P256-SHA256', value: raw.signature.value },
  }
}

export function catalogSigningPayload(value: UnsignedContentCatalogV1 | SignedContentCatalogV1 | Record<string, unknown>): string {
  const { signature: _signature, ...unsigned } = value as SignedContentCatalogV1
  return canonicalJson(unsigned)
}

export async function fingerprintPublisherKey(value: unknown, cryptoApi: Crypto = globalThis.crypto): Promise<string> {
  const key = validatePublisherKey(value)
  const payload = canonicalJson({ crv: key.crv, kty: key.kty, x: key.x, y: key.y })
  const digest = await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(payload))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase().match(/.{1,4}/gu)!.join(':')
}

export async function verifySignedCatalog(value: string | unknown, cryptoApi: Crypto = globalThis.crypto): Promise<VerifiedContentCatalog> {
  const catalog = parseSignedCatalog(value)
  let key: CryptoKey
  try {
    key = await cryptoApi.subtle.importKey('jwk', catalog.publisher.publicKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
  } catch { throw new Error('签名目录中的发布者公钥无法导入。') }
  const verified = await cryptoApi.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' }, key,
    decodeBase64Url(catalog.signature.value, 'signature.value'),
    new TextEncoder().encode(catalogSigningPayload(catalog)),
  )
  if (!verified) throw new Error('目录签名验证失败，内容可能已被篡改。')
  return { verified: true, catalog, fingerprint: await fingerprintPublisherKey(catalog.publisher.publicKey, cryptoApi) }
}
