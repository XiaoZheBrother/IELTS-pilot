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
const packageV2Two = {
  ...packageV2,
  packageId: 'test-package-two',
  name: 'Test Package Two',
  sets: [{ ...practiceSets[1], id: 'package-only-set-two', questions: practiceSets[1]!.questions.map((question) => ({ ...question, id: `package-two-${question.id}` })) }],
}

type PackageManagerVm = {
  loadPackageFiles: (files: File[]) => Promise<void>
}

describe('PackageManagerView', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear() })

  it('previews before installation and can uninstall an installed package', async () => {
    const wrapper = mount(PackageManagerView, { global: { stubs: { RouterLink: true } } })
    await (wrapper.vm as unknown as PackageManagerVm).loadPackageFiles([
      new File([JSON.stringify(packageV2)], 'test-package.json', { type: 'application/json' }),
    ])
    await flushPromises()
    expect(wrapper.text()).toContain('安装预览')
    expect(wrapper.text()).toContain('Test Package')
    expect(createBrowserPracticeRepository().listInstalledPackages()).toHaveLength(0)

    await wrapper.get('[data-testid="confirm-package-batch-install"]').trigger('click')
    await vi.waitFor(() => {
      expect(createBrowserPracticeRepository().getInstalledPackage('test-package')).toMatchObject({ version: '1.0.0' })
    })
    await wrapper.get('[data-testid="uninstall-package"]').trigger('click')
    expect(createBrowserPracticeRepository().getInstalledPackage('test-package')).toBeNull()
  })

  it('selects several files and installs every valid package with one confirmation', async () => {
    const wrapper = mount(PackageManagerView, { global: { stubs: { RouterLink: true } } })
    expect(wrapper.get('input[type="file"]').attributes('multiple')).toBeDefined()

    await (wrapper.vm as unknown as PackageManagerVm).loadPackageFiles([
      new File([JSON.stringify(packageV2)], 'one.json', { type: 'application/json' }),
      new File(['{broken'], 'broken.json', { type: 'application/json' }),
      new File([JSON.stringify(packageV2Two)], 'two.json', { type: 'application/json' }),
    ])
    await flushPromises()

    expect(wrapper.text()).toContain('3 个文件')
    expect(wrapper.text()).toContain('2 个可安装')
    expect(wrapper.text()).toContain('broken.json')
    expect(wrapper.findAll('[data-testid="confirm-package-batch-install"]')).toHaveLength(1)

    await wrapper.get('[data-testid="confirm-package-batch-install"]').trigger('click')
    await vi.waitFor(() => {
      expect(createBrowserPracticeRepository().listInstalledPackages().map(({ packageId }) => packageId).sort()).toEqual([
        'test-package',
        'test-package-two',
      ])
    })
    expect(wrapper.text()).toContain('已安装 2 个内容包，跳过 1 个')
  })
})
