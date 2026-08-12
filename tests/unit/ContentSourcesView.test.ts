import { flushPromises, mount } from '@vue/test-utils'
import ContentSourcesView from '../../src/views/ContentSourcesView.vue'
import { CONTENT_SOURCES_KEY, type ContentSourcesDependencies } from '../../src/views/contentSourcesDependencies'
import { createContentSourceRepository } from '../../src/storage/contentSourceRepository'
import { createPracticeRepository } from '../../src/storage/practiceRepository'
import type { VerifiedContentCatalog } from '../../src/domain/signedCatalog'
import { practiceSets } from '../../src/data/practiceSets'

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return { get length() { return values.size }, clear: () => values.clear(), getItem: (key) => values.get(key) ?? null, key: (index) => [...values.keys()][index] ?? null, removeItem: (key) => values.delete(key), setItem: (key, value) => values.set(key, value) }
}

const fingerprint = '1111:2222:3333:4444:5555:6666:7777:8888:9999:AAAA:BBBB:CCCC:DDDD:EEEE:FFFF:0000'
const publicKey = { kty: 'EC', crv: 'P-256', x: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', y: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' }
const packageValue = {
  schemaVersion: 2 as const, packageId: 'verified-pack', version: '1.0.0', name: 'Verified pack', description: 'Authorized sample.', owner: 'Publisher One',
  license: 'CC-BY-4.0', note: 'Publisher-approved.', createdAt: '2026-08-12T06:00:00.000Z', updatedAt: '2026-08-12T06:00:00.000Z', minimumAppVersion: '0.5.0', changelog: 'Initial.',
  sets: [{ ...practiceSets[0], id: 'remote-set', questions: practiceSets[0]!.questions.map((question) => ({ ...question, id: `remote-${question.id}` })) }],
}

function verified(overrides: Partial<VerifiedContentCatalog> = {}): VerifiedContentCatalog {
  return {
    verified: true, fingerprint,
    catalog: {
      schemaVersion: 1, catalogId: 'official', name: 'Official Catalog', description: 'Authorized original content.', updatedAt: '2026-08-12T06:00:00.000Z',
      publisher: { publisherId: 'publisher-one', name: 'Publisher One', publicKey },
      packages: [{ packageId: 'verified-pack', name: 'Verified pack', version: '1.0.0', description: 'Authorized sample.', license: 'CC-BY-4.0', url: 'https://cdn.example.test/pack.json', sha256: 'a'.repeat(64), size: 100, updatedAt: '2026-08-12T06:00:00.000Z' }],
      signature: { algorithm: 'ECDSA-P256-SHA256', value: 'A'.repeat(86) },
    },
    ...overrides,
  }
}

function setup(catalogs: VerifiedContentCatalog[] = [verified()]) {
  const sourceRepository = createContentSourceRepository(memoryStorage(), () => new Date('2026-08-12T07:00:00.000Z'))
  const practiceRepository = createPracticeRepository(memoryStorage(), () => new Date('2026-08-12T07:00:00.000Z'))
  const client = {
    fetchCatalog: vi.fn(async () => catalogs.shift() ?? verified()),
    fetchPackage: vi.fn(async () => ({
      package: packageValue, rawText: JSON.stringify(packageValue), rawSha256: 'a'.repeat(64),
      provenance: { publisherId: 'publisher-one', catalogId: 'official', signatureStatus: 'verified' as const },
    })),
  }
  const deps: ContentSourcesDependencies = { sourceRepository, practiceRepository, client }
  const wrapper = mount(ContentSourcesView, { global: { provide: { [CONTENT_SOURCES_KEY as symbol]: deps }, stubs: { RouterLink: true } } })
  return { wrapper, deps, client }
}

async function addSource(wrapper: ReturnType<typeof setup>['wrapper']) {
  await wrapper.get('[data-testid="catalog-url"]').setValue('https://catalog.example.test/catalog.json')
  await wrapper.get('[data-testid="add-content-source"]').trigger('click')
  await flushPromises()
}

describe('ContentSourcesView', () => {
  it('adds and verifies a catalog but requires explicit publisher trust', async () => {
    const { wrapper, deps } = setup()
    await addSource(wrapper)
    expect(wrapper.text()).toContain('Official Catalog')
    expect(wrapper.text()).toContain('等待信任')
    expect(wrapper.text()).toContain('1111:2222')
    expect(deps.sourceRepository.getPublisher('publisher-one')).toBeNull()
    await wrapper.get('[data-testid="trust-publisher"]').trigger('click')
    expect(deps.sourceRepository.getPublisher('publisher-one')).toMatchObject({ decision: 'trusted', fingerprint })
    expect(wrapper.text()).toContain('签名可信')
  })

  it('downloads and verifies separately from explicit installation', async () => {
    const { wrapper, deps, client } = setup()
    await addSource(wrapper)
    await wrapper.get('[data-testid="trust-publisher"]').trigger('click')
    await wrapper.get('[data-testid="download-verified-package"]').trigger('click')
    await flushPromises()
    expect(client.fetchPackage).toHaveBeenCalled()
    await vi.waitFor(() => expect(wrapper.text()).toContain('安装预览'))
    expect(deps.practiceRepository.getInstalledPackage('verified-pack')).toBeNull()
    await wrapper.get('[data-testid="confirm-source-package-install"]').trigger('click')
    await vi.waitFor(() => expect(deps.practiceRepository.getInstalledPackage('verified-pack')).toMatchObject({ signatureStatus: 'verified', publisherId: 'publisher-one' }))
  })

  it('blocks a silent key change after a previously trusted refresh', async () => {
    const rotatedFingerprint = fingerprint.replace('1111', 'ABCD')
    const rotated = verified({ fingerprint: rotatedFingerprint, catalog: { ...verified().catalog, publisher: { ...verified().catalog.publisher, publicKey: { ...publicKey, x: `C${publicKey.x.slice(1)}` } } } })
    const { wrapper } = setup([verified(), rotated])
    await addSource(wrapper)
    await wrapper.get('[data-testid="trust-publisher"]').trigger('click')
    await wrapper.get('[data-testid="refresh-content-source"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('密钥已变化')
    expect(wrapper.find('[data-testid="download-verified-package"]').exists()).toBe(false)
  })

  it('disables, removes sources and revokes publisher trust locally', async () => {
    const { wrapper, deps } = setup()
    await addSource(wrapper)
    await wrapper.get('[data-testid="trust-publisher"]').trigger('click')
    await wrapper.get('[data-testid="toggle-content-source"]').trigger('click')
    expect(deps.sourceRepository.listSources()[0].enabled).toBe(false)
    await wrapper.get('[data-testid="revoke-publisher"]').trigger('click')
    expect(deps.sourceRepository.getPublisher('publisher-one')?.decision).toBe('revoked')
    await wrapper.get('[data-testid="remove-content-source"]').trigger('click')
    expect(deps.sourceRepository.listSources()).toEqual([])
  })
})
