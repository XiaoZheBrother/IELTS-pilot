import { mount } from '@vue/test-utils'
import PackageEditorView from '../../src/views/PackageEditorView.vue'
import { createBrowserPracticeRepository } from '../../src/storage/practiceRepository'

describe('PackageEditorView', () => {
  beforeEach(() => localStorage.clear())

  it('edits, validates and saves a complete local author draft', async () => {
    const wrapper = mount(PackageEditorView, { global: { stubs: { RouterLink: true } } })
    await wrapper.get('input[name="package-name"]').setValue('My Reading Pack')
    await wrapper.get('[data-testid="add-question"]').trigger('click')
    await wrapper.get('[data-testid="save-author-draft"]').trigger('click')
    const drafts = createBrowserPracticeRepository().listAuthorDrafts()
    expect(drafts).toHaveLength(1)
    expect(drafts[0]).toMatchObject({ name: 'My Reading Pack' })
    expect(wrapper.text()).toContain('草稿已保存')
    await wrapper.get('[data-testid="validate-package"]').trigger('click')
    expect(wrapper.text()).toContain('内容包校验通过')
  })

  it('reopens and deletes saved author drafts', async () => {
    const first = mount(PackageEditorView, { global: { stubs: { RouterLink: true } } })
    await first.get('input[name="package-name"]').setValue('Reusable Draft')
    await first.get('[data-testid="save-author-draft"]').trigger('click')
    first.unmount()

    const second = mount(PackageEditorView, { global: { stubs: { RouterLink: true } } })
    expect(second.text()).toContain('Reusable Draft')
    await second.get('[data-testid="load-author-draft"]').trigger('click')
    expect((second.get('input[name="package-name"]').element as HTMLInputElement).value).toBe('Reusable Draft')
    await second.get('[data-testid="delete-author-draft"]').trigger('click')
    expect(createBrowserPracticeRepository().listAuthorDrafts()).toHaveLength(0)
  })
})
