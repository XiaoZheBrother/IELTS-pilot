import { createContentSourceRepository } from '../../src/storage/contentSourceRepository'
import type { VerifiedContentCatalog } from '../../src/domain/signedCatalog'

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return { get length() { return values.size }, clear: () => values.clear(), getItem: (key) => values.get(key) ?? null, key: (index) => [...values.keys()][index] ?? null, removeItem: (key) => values.delete(key), setItem: (key, value) => values.set(key, value) }
}

const publicKey = { kty: 'EC', crv: 'P-256', x: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', y: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' }
const fingerprint = '1111:2222:3333:4444:5555:6666:7777:8888:9999:AAAA:BBBB:CCCC:DDDD:EEEE:FFFF:0000'

function verified(overrides: Partial<VerifiedContentCatalog> = {}): VerifiedContentCatalog {
  return {
    verified: true, fingerprint,
    catalog: {
      schemaVersion: 1, catalogId: 'official', name: 'Official Catalog', description: 'Authorized content.', updatedAt: '2026-08-12T06:00:00.000Z',
      publisher: { publisherId: 'publisher-one', name: 'Publisher One', publicKey },
      packages: [{ packageId: 'sample', name: 'Sample', version: '1.0.0', description: 'Sample package', license: 'CC0', url: 'https://cdn.example.test/sample.json', sha256: 'a'.repeat(64), size: 1024, updatedAt: '2026-08-12T06:00:00.000Z' }],
      signature: { algorithm: 'ECDSA-P256-SHA256', value: 'A'.repeat(86) },
    },
    ...overrides,
  }
}

describe('content source repository', () => {
  it('starts empty and adds a pending source without affecting practice storage', () => {
    const storage = memoryStorage()
    storage.setItem('ielts-pilot:practice:v4', '{"untouched":true}')
    const repository = createContentSourceRepository(storage, () => new Date('2026-08-12T07:00:00.000Z'))
    expect(repository.listSources()).toEqual([])
    expect(repository.addSource('https://catalog.example.test/catalog.json')).toMatchObject({ status: 'pending', enabled: true })
    expect(storage.getItem('ielts-pilot:practice:v4')).toBe('{"untouched":true}')
  })

  it('requires an explicit exact-fingerprint trust decision', () => {
    const repository = createContentSourceRepository(memoryStorage(), () => new Date('2026-08-12T07:00:00.000Z'))
    const url = 'https://catalog.example.test/catalog.json'
    repository.addSource(url)
    expect(repository.recordVerifiedCatalog(url, verified())).toMatchObject({ status: 'pending', fingerprint })
    repository.trustPublisher('publisher-one', 'Publisher One', fingerprint, publicKey)
    expect(repository.getSource(url)).toMatchObject({ status: 'trusted', trustedFingerprint: fingerprint })
    expect(repository.getPublisher('publisher-one')).toMatchObject({ decision: 'trusted', fingerprint })
  })

  it('blocks silent publisher key rotation until a new trust decision', () => {
    const repository = createContentSourceRepository(memoryStorage())
    const url = 'https://catalog.example.test/catalog.json'
    repository.addSource(url)
    repository.recordVerifiedCatalog(url, verified())
    repository.trustPublisher('publisher-one', 'Publisher One', fingerprint, publicKey)
    const changed = verified({ fingerprint: fingerprint.replace('1111', 'ABCD'), catalog: { ...verified().catalog, publisher: { ...verified().catalog.publisher, publicKey: { ...publicKey, x: `C${publicKey.x.slice(1)}` } } } })
    expect(repository.recordVerifiedCatalog(url, changed)).toMatchObject({ status: 'key-changed', trustedFingerprint: fingerprint })
  })

  it('can disable, re-enable and remove a source', () => {
    const repository = createContentSourceRepository(memoryStorage())
    const url = 'https://catalog.example.test/catalog.json'
    repository.addSource(url)
    expect(repository.setSourceEnabled(url, false).enabled).toBe(false)
    expect(repository.setSourceEnabled(url, true).enabled).toBe(true)
    repository.removeSource(url)
    expect(repository.getSource(url)).toBeNull()
  })

  it('revokes a publisher across every subscribed source and persists decisions', () => {
    const storage = memoryStorage()
    const first = createContentSourceRepository(storage)
    for (const url of ['https://one.example.test/catalog.json', 'https://two.example.test/catalog.json']) {
      first.addSource(url); first.recordVerifiedCatalog(url, verified())
    }
    first.trustPublisher('publisher-one', 'Publisher One', fingerprint, publicKey)
    first.revokePublisher('publisher-one')
    const second = createContentSourceRepository(storage)
    expect(second.listSources().map(({ status }) => status)).toEqual(['revoked', 'revoked'])
    expect(second.getPublisher('publisher-one')?.decision).toBe('revoked')
  })
})
