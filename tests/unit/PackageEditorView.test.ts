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
})
