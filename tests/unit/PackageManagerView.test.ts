import { flushPromises, mount } from '@vue/test-utils'
import PackageManagerView from '../../src/views/PackageManagerView.vue'
import { practiceSets } from '../../src/data/practiceSets'
import { createBrowserPracticeRepository } from '../../src/storage/practiceRepository'

const packageV2 = {
  schemaVersion: 2, packageId: 'test-package', version: '1.0.0', name: 'Test Package', description: 'A test package.',
  owner: 'Example Author', license: 'CC-BY-4.0', note: 'Authorized for testing.', sourceUrl: 'https://example.com',
  createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-12T00:00:00.000Z', minimumAppVersion: '0.5.0', changelog: 'Initial release.',
  sets: [{ ...practiceSets[0], id: 'package-only-set', questions: practiceSets[0]!.questions.map((question) => ({ ...question, id: `package-${question.id}` })) }],
}

describe('PackageManagerView', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear() })

  it('previews before installation and can uninstall an installed package', async () => {
    const wrapper = mount(PackageManagerView, { global: { stubs: { RouterLink: true } } })
    await (wrapper.vm as unknown as { loadPackageText: (text: string) => Promise<void> }).loadPackageText(JSON.stringify(packageV2))
    await flushPromises()
    expect(wrapper.text()).toContain('安装预览')
    expect(wrapper.text()).toContain('Test Package')
    expect(createBrowserPracticeRepository().listInstalledPackages()).toHaveLength(0)

    await wrapper.get('[data-testid="confirm-package-install"]').trigger('click')
    await vi.waitFor(() => {
      expect(createBrowserPracticeRepository().getInstalledPackage('test-package')).toMatchObject({ version: '1.0.0' })
    })
    await wrapper.get('[data-testid="uninstall-package"]').trigger('click')
    expect(createBrowserPracticeRepository().getInstalledPackage('test-package')).toBeNull()
  })
})
