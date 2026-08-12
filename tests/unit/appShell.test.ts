import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '../../src/App.vue'
import { LEARNING_ASSISTANT_KEY } from '../../src/components/learningAssistantDependencies'

describe('App shell', () => {
  it('shows product identity, navigation and the active route', async () => {
    const empty = { template: '<main />' }
    const router = createRouter({ history: createMemoryHistory(), routes: [
      { path: '/', name: 'home', component: { template: '<main data-testid="route-view">当前页面</main>' } },
      { path: '/library', name: 'library', component: empty },
      { path: '/errors', name: 'errors', component: empty },
      { path: '/favorites', name: 'favorites', component: empty },
      { path: '/analytics', name: 'analytics', component: empty },
      { path: '/writing', name: 'writing', component: empty },
      { path: '/settings', name: 'settings', component: empty },
      { path: '/updates', name: 'updates', component: empty },
      { path: '/sync', name: 'sync', component: empty },
      { path: '/library/sources', name: 'content-sources', component: empty },
      { path: '/about', name: 'about', component: empty },
    ] })
    await router.push('/')
    await router.isReady()
    const assistantDependencies = {
      practice: { listAttempts: () => [], listMasteredErrorKeys: () => [], listImportedSets: () => [] }, writing: { listReports: () => [] },
      settings: { get: () => ({ endpoint: 'https://api.example.com/v1/chat/completions', model: 'fixture' }) },
      conversation: { list: () => [], save: () => undefined, clear: () => undefined, listConversations: () => [], activeConversationId: () => 'fixture', create: () => ({ id: 'fixture', title: '新对话', createdAt: '2026-08-12T00:00:00.000Z', updatedAt: '2026-08-12T00:00:00.000Z', messages: [] }), switchTo: () => true, remove: () => undefined, deleteMessage: () => undefined },
      plan: { get: () => null, save: () => undefined, clear: () => undefined },
      client: { checkAvailability: async () => ({ available: false, mode: 'gateway', reason: 'unavailable' }), chat: async () => ({ content: '', model: '', requestId: '' }), testConnection: async () => ({ ok: false }), saveCredential: async () => undefined, clearCredential: async () => undefined },
      now: () => new Date('2026-08-12T00:00:00.000Z'),
    }
    const wrapper = mount(App, { global: { plugins: [router], provide: { [LEARNING_ASSISTANT_KEY as symbol]: assistantDependencies } } })
    expect(wrapper.get('[data-testid="brand"]').text()).toContain('IELTS PILOT')
    expect(wrapper.get('a[href="/writing"]').text()).toBe('写作')
    expect(wrapper.get('[data-testid="route-view"]').text()).toBe('当前页面')
    expect(wrapper.get('nav').text()).toContain('题库')
    expect(wrapper.get('nav').text()).toContain('错题本')
    expect(wrapper.get('nav').text()).toContain('收藏')
    expect(wrapper.get('[data-testid="utility-nav"]').text()).toContain('设置')
    expect(wrapper.get('[data-testid="utility-nav"]').text()).toContain('更新')
    expect(wrapper.get('[data-testid="utility-nav"]').text()).toContain('同步')
    expect(wrapper.get('[data-testid="utility-nav"]').text()).toContain('内容源')
    expect(wrapper.get('.skip-link').attributes('href')).toBe('#app-content')
    expect(wrapper.get('[data-testid="assistant-orb"]').attributes('aria-label')).toBe('打开 IELTS Pilot')
  })
})
