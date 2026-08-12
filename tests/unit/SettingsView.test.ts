import { mount } from '@vue/test-utils'
import SettingsView from '../../src/views/SettingsView.vue'
import { AI_SETTINGS_VIEW_KEY, type AiSettingsViewDependencies } from '../../src/views/aiSettingsViewDependencies'

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

  it('saves non-sensitive AI settings and protects desktop credentials', async () => {
    const calls: string[] = []
    const dependencies: AiSettingsViewDependencies = {
      desktop: true,
      repository: {
        get: () => ({ endpoint: 'https://api.example.com/v1/chat/completions', model: 'coach-model' }),
        save: (value) => { calls.push(`settings:${value.endpoint}:${value.model}`) },
        clear: () => { calls.push('clear-settings') },
      },
      client: {
        checkAvailability: async () => ({ available: false, mode: 'desktop', reason: 'configuration-required' }),
        chat: async () => ({ content: '', model: '', requestId: '' }),
        chatStream: async () => ({ content: '', model: '', requestId: '' }),
        testConnection: async (_settings, apiKey) => ({ ok: apiKey === 'temporary-secret', model: 'coach-model', latencyMs: 120 }),
        saveCredential: async (apiKey) => { calls.push(`credential:${apiKey}`) },
        clearCredential: async () => { calls.push('clear-credential') },
      },
    }
    const wrapper = mount(SettingsView, { global: { provide: { [AI_SETTINGS_VIEW_KEY as symbol]: dependencies } } })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(wrapper.text()).toContain('AI 助手')
    expect(wrapper.text()).toContain('尚未配置密钥')
    await wrapper.get('[data-testid="ai-api-key"]').setValue('temporary-secret')
    await wrapper.get('[data-testid="test-ai-connection"]').trigger('click')
    expect(wrapper.text()).toContain('连接成功')
    await wrapper.get('[data-testid="save-ai-settings"]').trigger('click')

    expect(calls).toEqual([
      'settings:https://api.example.com/v1/chat/completions:coach-model',
      'credential:temporary-secret',
    ])
    expect((wrapper.get('[data-testid="ai-api-key"]').element as HTMLInputElement).value).toBe('')
    expect(JSON.stringify(localStorage)).not.toContain('temporary-secret')
  })

  it('explains that browser credentials are managed by the local gateway', async () => {
    const dependencies: AiSettingsViewDependencies = {
      desktop: false,
      repository: { get: () => ({ endpoint: 'https://api.openai.com/v1/chat/completions', model: 'gateway-model' }), save: () => undefined, clear: () => undefined },
      client: {
        checkAvailability: async () => ({ available: true, mode: 'gateway', model: 'gateway-model' }),
        chat: async () => ({ content: '', model: '', requestId: '' }), chatStream: async () => ({ content: '', model: '', requestId: '' }), testConnection: async () => ({ ok: true, model: 'gateway-model' }),
        saveCredential: async () => undefined, clearCredential: async () => undefined,
      },
    }
    const wrapper = mount(SettingsView, { global: { provide: { [AI_SETTINGS_VIEW_KEY as symbol]: dependencies } } })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(wrapper.text()).toContain('本地网关已连接')
    expect(wrapper.find('[data-testid="ai-api-key"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ai-endpoint"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ai-model"]').exists()).toBe(false)
  })

  it('shows a privacy-safe support diagnostic exporter', () => {
    const wrapper = mount(SettingsView)
    expect(wrapper.get('[data-testid="export-diagnostics"]').text()).toContain('导出诊断')
    expect(wrapper.text()).toContain('不包含 API Key')
    expect(wrapper.text()).toContain('作文原文')
    expect(wrapper.text()).toContain('对话内容')
  })
})
