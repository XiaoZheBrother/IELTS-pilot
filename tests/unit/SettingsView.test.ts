import { mount } from '@vue/test-utils'
import SettingsView from '../../src/views/SettingsView.vue'

describe('SettingsView', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-reader-theme')
  })

  it('previews and persists reading preferences', async () => {
    const wrapper = mount(SettingsView)
    await wrapper.get('[data-testid="theme-night"]').setValue()
    await wrapper.get('[data-testid="font-scale"]').setValue('1.2')
    await wrapper.get('[data-testid="default-timed"]').setValue(false)
    await wrapper.get('[data-testid="save-preferences"]').trigger('click')

    expect(document.documentElement.dataset.readerTheme).toBe('night')
    expect(document.documentElement.style.getPropertyValue('--reader-font-scale')).toBe('1.2')
    expect(wrapper.text()).toContain('设置已保存')

    const reloaded = mount(SettingsView)
    expect((reloaded.get('[data-testid="theme-night"]').element as HTMLInputElement).checked).toBe(true)
    expect((reloaded.get('[data-testid="default-timed"]').element as HTMLInputElement).checked).toBe(false)
  })
})
