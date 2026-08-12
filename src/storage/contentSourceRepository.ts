import { validateContentUrl, type SignedContentCatalogV1, type VerifiedContentCatalog } from '../domain/signedCatalog'

const STORAGE_KEY = 'ielts-pilot:content-sources:v1'

export type ContentSourceStatus = 'pending' | 'trusted' | 'key-changed' | 'revoked'

export interface StoredContentSource {
  url: string
  enabled: boolean
  status: ContentSourceStatus
  addedAt: string
  lastCheckedAt?: string
  catalog?: SignedContentCatalogV1
  fingerprint?: string
  trustedFingerprint?: string
}

export interface TrustedPublisher {
  publisherId: string
  name: string
  fingerprint: string
  publicKey: JsonWebKey
  decision: 'trusted' | 'revoked'
  decidedAt: string
}

interface ContentSourceState {
  version: 1
  sources: StoredContentSource[]
  publishers: TrustedPublisher[]
}

export interface ContentSourceRepository {
  listSources: () => StoredContentSource[]
  getSource: (url: string) => StoredContentSource | null
  addSource: (url: string) => StoredContentSource
  recordVerifiedCatalog: (url: string, verified: VerifiedContentCatalog) => StoredContentSource
  setSourceEnabled: (url: string, enabled: boolean) => StoredContentSource
  removeSource: (url: string) => void
  listPublishers: () => TrustedPublisher[]
  getPublisher: (publisherId: string) => TrustedPublisher | null
  trustPublisher: (publisherId: string, name: string, fingerprint: string, publicKey: JsonWebKey) => TrustedPublisher
  revokePublisher: (publisherId: string) => TrustedPublisher
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function emptyState(): ContentSourceState {
  return { version: 1, sources: [], publishers: [] }
}

function readState(storage: Storage): ContentSourceState {
  try {
    const raw = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null') as Partial<ContentSourceState> | null
    if (!raw || raw.version !== 1 || !Array.isArray(raw.sources) || !Array.isArray(raw.publishers)) return emptyState()
    return clone(raw as ContentSourceState)
  } catch { return emptyState() }
}

function writeState(storage: Storage, state: ContentSourceState): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function canonicalUrl(value: string): string {
  return validateContentUrl(value, 'catalog URL').href
}

function findSource(state: ContentSourceState, url: string): StoredContentSource {
  const source = state.sources.find((item) => item.url === canonicalUrl(url))
  if (!source) throw new Error('内容源不存在。')
  return source
}

function statusFor(state: ContentSourceState, verified: VerifiedContentCatalog): Pick<StoredContentSource, 'status' | 'trustedFingerprint'> {
  const trust = state.publishers.find(({ publisherId }) => publisherId === verified.catalog.publisher.publisherId)
  if (!trust) return { status: 'pending' }
  if (trust.decision === 'revoked') return { status: 'revoked', trustedFingerprint: trust.fingerprint }
  if (trust.fingerprint !== verified.fingerprint) return { status: 'key-changed', trustedFingerprint: trust.fingerprint }
  return { status: 'trusted', trustedFingerprint: trust.fingerprint }
}

export function createContentSourceRepository(storage: Storage, now: () => Date = () => new Date()): ContentSourceRepository {
  return {
    listSources() { return clone(readState(storage).sources) },
    getSource(url) {
      const canonical = canonicalUrl(url)
      return clone(readState(storage).sources.find((item) => item.url === canonical) ?? null)
    },
    addSource(url) {
      const state = readState(storage)
      const canonical = canonicalUrl(url)
      const existing = state.sources.find((item) => item.url === canonical)
      if (existing) return clone(existing)
      const source: StoredContentSource = { url: canonical, enabled: true, status: 'pending', addedAt: now().toISOString() }
      state.sources.push(source)
      writeState(storage, state)
      return clone(source)
    },
    recordVerifiedCatalog(url, verified) {
      const state = readState(storage)
      const canonical = canonicalUrl(url)
      let source = state.sources.find((item) => item.url === canonical)
      if (!source) {
        source = { url: canonical, enabled: true, status: 'pending', addedAt: now().toISOString() }
        state.sources.push(source)
      }
      Object.assign(source, {
        catalog: clone(verified.catalog), fingerprint: verified.fingerprint,
        lastCheckedAt: now().toISOString(), ...statusFor(state, verified),
      })
      writeState(storage, state)
      return clone(source)
    },
    setSourceEnabled(url, enabled) {
      const state = readState(storage)
      const source = findSource(state, url)
      source.enabled = enabled
      writeState(storage, state)
      return clone(source)
    },
    removeSource(url) {
      const state = readState(storage)
      const canonical = canonicalUrl(url)
      state.sources = state.sources.filter((item) => item.url !== canonical)
      writeState(storage, state)
    },
    listPublishers() { return clone(readState(storage).publishers) },
    getPublisher(publisherId) { return clone(readState(storage).publishers.find((item) => item.publisherId === publisherId) ?? null) },
    trustPublisher(publisherId, name, fingerprint, publicKey) {
      const state = readState(storage)
      const publisher: TrustedPublisher = { publisherId, name, fingerprint, publicKey: clone(publicKey), decision: 'trusted', decidedAt: now().toISOString() }
      state.publishers = [...state.publishers.filter((item) => item.publisherId !== publisherId), publisher]
      state.sources.forEach((source) => {
        if (source.catalog?.publisher.publisherId !== publisherId) return
        source.trustedFingerprint = fingerprint
        source.status = source.fingerprint === fingerprint ? 'trusted' : 'key-changed'
      })
      writeState(storage, state)
      return clone(publisher)
    },
    revokePublisher(publisherId) {
      const state = readState(storage)
      const current = state.publishers.find((item) => item.publisherId === publisherId)
      if (!current) throw new Error('发布者尚未被信任。')
      current.decision = 'revoked'
      current.decidedAt = now().toISOString()
      state.sources.forEach((source) => {
        if (source.catalog?.publisher.publisherId === publisherId) source.status = 'revoked'
      })
      writeState(storage, state)
      return clone(current)
    },
  }
}

export function createBrowserContentSourceRepository(): ContentSourceRepository {
  return createContentSourceRepository(window.localStorage)
}
