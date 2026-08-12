import { validateContentPackage, type NormalizedContentPackage } from '../domain/contentPackage'
import {
  validateContentUrl, verifySignedCatalog, type VerifiedContentCatalog,
} from '../domain/signedCatalog'
import type { PackageInstallProvenance } from '../domain/packageLifecycle'

const CATALOG_LIMIT = 1024 * 1024
const PACKAGE_LIMIT = 10 * 1024 * 1024

export interface ContentSourceClientOptions {
  fetch?: typeof globalThis.fetch
  timeoutMs?: number
  crypto?: Crypto
}

export interface VerifiedPackageDownload {
  package: NormalizedContentPackage
  rawText: string
  rawSha256: string
  provenance: PackageInstallProvenance
}

export interface ContentSourceClient {
  fetchCatalog: (url: string) => Promise<VerifiedContentCatalog>
  fetchPackage: (catalog: VerifiedContentCatalog, packageId: string, trustedFingerprint: string) => Promise<VerifiedPackageDownload>
}

async function fetchBounded(fetchApi: typeof globalThis.fetch, url: string, maxBytes: number, timeoutMs: number, label: string): Promise<Uint8Array> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let response: Response
    try {
      response = await fetchApi(url, { method: 'GET', cache: 'no-store', redirect: 'error', signal: controller.signal, headers: { Accept: 'application/json' } })
    } catch (error) {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) throw new Error(`${label}下载超时。`)
      throw new Error(`${label}下载失败；重定向和网络连接均未通过安全检查。`)
    }
    if (!response.ok) throw new Error(`${label}下载失败：HTTP ${response.status}。`)
    if (response.url) validateContentUrl(response.url, `${label}最终 URL`)
    const declared = Number(response.headers.get('content-length'))
    if (Number.isFinite(declared) && declared > maxBytes) throw new Error(`${label}超过 ${maxBytes === CATALOG_LIMIT ? '1 MiB' : '10 MiB'} 上限。`)
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.length > maxBytes) throw new Error(`${label}超过 ${maxBytes === CATALOG_LIMIT ? '1 MiB' : '10 MiB'} 上限。`)
    return bytes
  } finally {
    clearTimeout(timeout)
  }
}

function decodeJson(bytes: Uint8Array, label: string): { text: string; value: unknown } {
  let text: string
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { throw new Error(`${label}不是有效 UTF-8。`) }
  try { return { text, value: JSON.parse(text) as unknown } } catch { throw new Error(`${label}不是有效 JSON。`) }
}

async function sha256Hex(bytes: Uint8Array, cryptoApi: Crypto): Promise<string> {
  const digest = await cryptoApi.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function createContentSourceClient(options: ContentSourceClientOptions = {}): ContentSourceClient {
  const fetchApi = options.fetch ?? globalThis.fetch
  const cryptoApi = options.crypto ?? globalThis.crypto
  const timeoutMs = options.timeoutMs ?? 15_000
  if (!fetchApi || !cryptoApi?.subtle) throw new Error('当前运行环境缺少内容源所需的 Fetch 或 Web Crypto API。')
  return {
    async fetchCatalog(url) {
      const safeUrl = validateContentUrl(url, 'catalog URL').href
      const bytes = await fetchBounded(fetchApi, safeUrl, CATALOG_LIMIT, timeoutMs, '签名目录')
      return verifySignedCatalog(decodeJson(bytes, '签名目录').value, cryptoApi)
    },
    async fetchPackage(verified, packageId, trustedFingerprint) {
      if (trustedFingerprint !== verified.fingerprint) throw new Error('发布者密钥未被信任或已发生轮换，禁止下载内容包。')
      const metadata = verified.catalog.packages.find((item) => item.packageId === packageId)
      if (!metadata) throw new Error('签名目录中不存在此内容包。')
      const bytes = await fetchBounded(fetchApi, metadata.url, PACKAGE_LIMIT, timeoutMs, '内容包')
      if (bytes.length !== metadata.size) throw new Error('内容包字节长度与签名目录不一致。')
      const rawSha256 = await sha256Hex(bytes, cryptoApi)
      if (rawSha256 !== metadata.sha256) throw new Error('内容包 SHA-256 与签名目录不一致，下载已拒绝。')
      const parsed = decodeJson(bytes, '内容包')
      const validated = validateContentPackage(parsed.value)
      if (!validated.ok) throw new Error(`内容包字段校验失败：${validated.errors.join('；')}`)
      if (validated.value.packageId !== metadata.packageId || validated.value.version !== metadata.version) throw new Error('内容包身份或版本与签名目录不一致。')
      return {
        package: validated.value, rawText: parsed.text, rawSha256,
        provenance: {
          publisherId: verified.catalog.publisher.publisherId,
          catalogId: verified.catalog.catalogId,
          signatureStatus: 'verified',
        },
      }
    },
  }
}
