import { createContentSourceClient } from '../../src/platform/contentSourceClient'
import { catalogSigningPayload, type SignedContentCatalogV1 } from '../../src/domain/signedCatalog'
import { practiceSets } from '../../src/data/practiceSets'

function base64Url(value: ArrayBuffer): string { return Buffer.from(value).toString('base64url') }
async function sha256(value: string): Promise<string> { return Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))).toString('hex') }

async function fixture() {
  const packageValue = {
    schemaVersion: 2, packageId: 'verified-pack', version: '1.0.0', name: 'Verified pack', description: 'Verified package.',
    owner: 'Publisher One', license: 'CC-BY-4.0', note: 'Authorized.', sourceUrl: 'https://publisher.example.test',
    createdAt: '2026-08-12T06:00:00.000Z', updatedAt: '2026-08-12T06:00:00.000Z', minimumAppVersion: '0.5.0', changelog: 'Initial.',
    sets: [{ ...practiceSets[0], id: 'verified-set', questions: practiceSets[0]!.questions.map((question) => ({ ...question, id: `verified-${question.id}` })) }],
  }
  const packageText = JSON.stringify(packageValue)
  const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const publicKey = await crypto.subtle.exportKey('jwk', keys.publicKey)
  const unsigned = {
    schemaVersion: 1 as const, catalogId: 'catalog-one', name: 'Catalog One', description: 'Signed packages.', updatedAt: '2026-08-12T06:00:00.000Z',
    publisher: { publisherId: 'publisher-one', name: 'Publisher One', publicKey },
    packages: [{ packageId: 'verified-pack', name: 'Verified pack', version: '1.0.0', description: 'Verified package.', license: 'CC-BY-4.0', url: 'https://cdn.example.test/pack.json', sha256: await sha256(packageText), size: new TextEncoder().encode(packageText).length, updatedAt: '2026-08-12T06:00:00.000Z' }],
  }
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keys.privateKey, new TextEncoder().encode(catalogSigningPayload(unsigned)))
  const catalog: SignedContentCatalogV1 = { ...unsigned, signature: { algorithm: 'ECDSA-P256-SHA256', value: base64Url(signature) } }
  return { catalog, catalogText: JSON.stringify(catalog), packageText }
}

describe('verified content source client', () => {
  it('fetches, bounds and verifies a signed catalog', async () => {
    const data = await fixture()
    const fetchMock = vi.fn(async () => new Response(data.catalogText, { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const result = await createContentSourceClient({ fetch: fetchMock }).fetchCatalog('https://catalog.example.test/catalog.json')
    expect(result.verified).toBe(true)
    expect(result.catalog.catalogId).toBe('catalog-one')
    expect(result.fingerprint).toMatch(/:/)
  })

  it('rejects oversized catalogs before reading the body', async () => {
    const client = createContentSourceClient({ fetch: async () => new Response('{}', { status: 200, headers: { 'Content-Length': String(1024 * 1024 + 1) } }) })
    await expect(client.fetchCatalog('https://catalog.example.test/catalog.json')).rejects.toThrow('1 MiB')
  })

  it('downloads raw bytes only after exact trust and verifies digest plus package schema', async () => {
    const data = await fixture()
    const client = createContentSourceClient({ fetch: async (input) => {
      const url = String(input)
      return new Response(url.includes('catalog') ? data.catalogText : data.packageText, { status: 200, headers: { 'Content-Type': 'application/json' } })
    } })
    const verified = await client.fetchCatalog('https://catalog.example.test/catalog.json')
    const result = await client.fetchPackage(verified, 'verified-pack', verified.fingerprint)
    expect(result.package).toMatchObject({ packageId: 'verified-pack', version: '1.0.0' })
    expect(result.provenance).toEqual({ publisherId: 'publisher-one', catalogId: 'catalog-one', signatureStatus: 'verified' })
    expect(result.rawSha256).toBe(verified.catalog.packages[0].sha256)
  })

  it('does not fetch a package for an untrusted or rotated key', async () => {
    const data = await fixture()
    const fetchMock = vi.fn(async () => new Response(data.catalogText, { status: 200 }))
    const client = createContentSourceClient({ fetch: fetchMock })
    const verified = await client.fetchCatalog('https://catalog.example.test/catalog.json')
    await expect(client.fetchPackage(verified, 'verified-pack', 'AAAA:BBBB')).rejects.toThrow('信任')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects raw package tampering before JSON validation', async () => {
    const data = await fixture()
    const client = createContentSourceClient({ fetch: async (input) => new Response(String(input).includes('catalog') ? data.catalogText : data.packageText.replace('Verified package.', 'Xerified package.'), { status: 200 }) })
    const verified = await client.fetchCatalog('https://catalog.example.test/catalog.json')
    await expect(client.fetchPackage(verified, 'verified-pack', verified.fingerprint)).rejects.toThrow('SHA-256')
  })

  it('maps timeout aborts to a clear bounded error', async () => {
    const fetchMock: typeof fetch = (_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })
    const client = createContentSourceClient({ fetch: fetchMock, timeoutMs: 5 })
    await expect(client.fetchCatalog('https://catalog.example.test/catalog.json')).rejects.toThrow('超时')
  })
})
