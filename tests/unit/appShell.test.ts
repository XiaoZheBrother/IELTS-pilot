import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '../../src/App.vue'

describe('App shell', () => {
  it('shows product identity, navigation and the active route', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', name: 'home', component: { template: '<main data-testid="route-view">当前页面</main>' } }] })
    await router.push('/')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [router] } })
    expect(wrapper.get('[data-testid="brand"]').text()).toContain('IELTS PILOT')
    expect(wrapper.get('[data-testid="route-view"]').text()).toBe('当前页面')
    expect(wrapper.get('nav').text()).toContain('题库')
    expect(wrapper.get('.skip-link').attributes('href')).toBe('#app-content')
  })
})

