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

  it('requires an explicit second click before installing the local demonstration profile', async () => {
    const wrapper = mount(SettingsView)
    await wrapper.get('[data-testid="install-demo-profile"]').trigger('click')

    expect(wrapper.text()).toContain('将写入 3 次阅读记录')
    expect(localStorage.getItem('ielts-pilot:practice:v4')).toBeNull()

    await wrapper.get('[data-testid="confirm-demo-profile"]').trigger('click')
    expect(wrapper.text()).toContain('演示数据已准备完成')
    expect(localStorage.getItem('ielts-pilot:practice:v4')).not.toBeNull()
    expect(localStorage.getItem('ielts-pilot:writing:v1')).not.toBeNull()
  })
})
