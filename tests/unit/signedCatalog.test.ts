import {
  catalogSigningPayload, fingerprintPublisherKey, parseSignedCatalog, verifySignedCatalog,
  type SignedContentCatalogV1,
} from '../../src/domain/signedCatalog'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function base64Url(bytes: ArrayBuffer): string {
  return Buffer.from(bytes).toString('base64url')
}

async function fixture(): Promise<SignedContentCatalogV1> {
  const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const publicKey = await crypto.subtle.exportKey('jwk', keys.publicKey)
  const unsigned = {
    schemaVersion: 1 as const,
    catalogId: 'pilot-official', name: 'Pilot Official', description: 'Authorized original packages.',
    updatedAt: '2026-08-12T06:00:00.000Z',
    publisher: { publisherId: 'xiaozhe', name: 'XiaoZheBrother', website: 'https://github.com/XiaoZheBrother', publicKey },
    packages: [{
      packageId: 'sample', name: 'Sample pack', version: '1.0.0', description: 'One verified sample.',
      license: 'CC-BY-4.0', url: 'https://cdn.example.test/sample.json',
      sha256: 'a'.repeat(64), size: 4096, updatedAt: '2026-08-12T06:00:00.000Z',
    }],
  }
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keys.privateKey, new TextEncoder().encode(catalogSigningPayload(unsigned)))
  return { ...unsigned, signature: { algorithm: 'ECDSA-P256-SHA256', value: base64Url(signature) } }
}

describe('signed content catalog', () => {
  it('canonicalizes signed fields independent of object key insertion order', async () => {
    const catalog = await fixture()
    const reordered = { packages: catalog.packages, publisher: catalog.publisher, updatedAt: catalog.updatedAt, description: catalog.description, name: catalog.name, catalogId: catalog.catalogId, schemaVersion: 1 as const }
    expect(catalogSigningPayload(catalog)).toBe(catalogSigningPayload(reordered))
  })

  it('creates a stable colon-grouped uppercase public-key fingerprint', async () => {
    const catalog = await fixture()
    const fingerprint = await fingerprintPublisherKey(catalog.publisher.publicKey)
    expect(fingerprint).toMatch(/^[A-F0-9]{4}(?::[A-F0-9]{4}){15}$/u)
    expect(await fingerprintPublisherKey({ y: catalog.publisher.publicKey.y, x: catalog.publisher.publicKey.x, crv: 'P-256', kty: 'EC' })).toBe(fingerprint)
  })

  it('verifies an authentic catalog and rejects changed metadata', async () => {
    const catalog = await fixture()
    await expect(verifySignedCatalog(catalog)).resolves.toMatchObject({ verified: true, catalog })
    await expect(verifySignedCatalog({ ...catalog, name: 'Changed after signing' })).rejects.toThrow('签名')
  })

  it.each([
    ['malformed JWK', (catalog: SignedContentCatalogV1) => ({ ...catalog, publisher: { ...catalog.publisher, publicKey: { kty: 'RSA' } } })],
    ['duplicate package IDs', (catalog: SignedContentCatalogV1) => ({ ...catalog, packages: [...catalog.packages, catalog.packages[0]] })],
    ['unsupported algorithm', (catalog: SignedContentCatalogV1) => ({ ...catalog, signature: { ...catalog.signature, algorithm: 'RSA-SHA256' } })],
    ['insecure package URL', (catalog: SignedContentCatalogV1) => ({ ...catalog, packages: [{ ...catalog.packages[0], url: 'http://cdn.example.test/sample.json' }] })],
  ])('rejects %s during schema validation', async (_name, mutate) => {
    const catalog = await fixture()
    expect(() => parseSignedCatalog(mutate(catalog))).toThrow()
  })

  it('allows loopback HTTP package URLs for local development only', async () => {
    const catalog = await fixture()
    expect(() => parseSignedCatalog({ ...catalog, packages: [{ ...catalog.packages[0], url: 'http://127.0.0.1:4173/sample.json' }] })).not.toThrow()
  })

  it('verifies the committed Node CLI signed example with the application verifier', async () => {
    const catalog = readFileSync(resolve('examples/signed-catalog/catalog.json'), 'utf8')
    await expect(verifySignedCatalog(catalog)).resolves.toMatchObject({
      fingerprint: '20B5:0788:51D1:BDA3:7632:137A:4761:AAC6:2539:5CAB:C307:234A:8166:95FF:B118:CD4F',
      catalog: { catalogId: 'ielts-pilot-example' },
    })
  })
})
