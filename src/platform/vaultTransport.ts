import { parseEncryptedVault, type EncryptedVaultEnvelope } from '../domain/encryptedVault'

export type VaultTransportErrorCode = 'unauthorized' | 'conflict' | 'invalid-response' | 'server' | 'network'

export class VaultTransportError extends Error {
  constructor(public readonly code: VaultTransportErrorCode, message: string, public readonly status?: number) {
    super(message)
    this.name = 'VaultTransportError'
  }
}

export interface VaultTransportOptions {
  endpoint: string
  profileId: string
  token?: string
  fetch?: typeof globalThis.fetch
}

export type VaultPullResult =
  | { kind: 'missing' }
  | { kind: 'found'; envelope: EncryptedVaultEnvelope; etag: string }

export interface VaultTransport {
  pull: () => Promise<VaultPullResult>
  push: (envelope: EncryptedVaultEnvelope, etag?: string) => Promise<{ etag: string }>
}

export function validateVaultEndpoint(value: string): URL {
  let url: URL
  try { url = new URL(value) } catch { throw new Error('同步地址不是有效 URL。') }
  if (url.username || url.password) throw new Error('同步地址不可内嵌凭据，请使用临时访问令牌。')
  const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]'
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) throw new Error('远程同步地址必须使用 HTTPS；HTTP 仅限本机回环地址。')
  url.hash = ''
  url.search = ''
  return url
}

function strongEtag(response: Response): string {
  const etag = response.headers.get('etag')
  if (!etag || etag.startsWith('W/')) throw new VaultTransportError('invalid-response', '同步服务未返回强 ETag，无法安全处理并发更新。')
  return etag
}

async function perform(fetchApi: typeof globalThis.fetch, input: string, init: RequestInit): Promise<Response> {
  try { return await fetchApi(input, init) } catch { throw new VaultTransportError('network', '无法连接同步服务。') }
}

function mapFailure(response: Response): never {
  if (response.status === 401 || response.status === 403) throw new VaultTransportError('unauthorized', '同步服务拒绝了访问令牌。', response.status)
  if (response.status === 409 || response.status === 412) throw new VaultTransportError('conflict', '远程保险库已变化，需要重新拉取并合并。', response.status)
  throw new VaultTransportError('server', `同步服务返回 HTTP ${response.status}。`, response.status)
}

export function createVaultTransport(options: VaultTransportOptions): VaultTransport {
  const endpoint = validateVaultEndpoint(options.endpoint)
  if (!/^[A-Za-z0-9._-]{1,128}$/u.test(options.profileId)) throw new Error('同步档案 ID 格式无效。')
  const url = new URL(`/v1/vaults/${encodeURIComponent(options.profileId)}`, endpoint).href
  const fetchApi = options.fetch ?? globalThis.fetch
  if (!fetchApi) throw new Error('当前运行环境不支持 Fetch API。')
  const headers = (): Record<string, string> => ({
    Accept: 'application/json',
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
  })
  return {
    async pull() {
      const response = await perform(fetchApi, url, { method: 'GET', cache: 'no-store', headers: headers() })
      if (response.status === 404) return { kind: 'missing' }
      if (!response.ok) mapFailure(response)
      try {
        const envelope = parseEncryptedVault(await response.json())
        return { kind: 'found', envelope, etag: strongEtag(response) }
      } catch (error) {
        if (error instanceof VaultTransportError) throw error
        throw new VaultTransportError('invalid-response', '同步服务返回的保险库格式无效。')
      }
    },
    async push(envelope, etag) {
      const response = await perform(fetchApi, url, {
        method: 'PUT',
        headers: { ...headers(), 'Content-Type': 'application/json', ...(etag ? { 'If-Match': etag } : { 'If-None-Match': '*' }) },
        body: JSON.stringify(parseEncryptedVault(envelope)),
      })
      if (!response.ok) mapFailure(response)
      return { etag: strongEtag(response) }
    },
  }
}
