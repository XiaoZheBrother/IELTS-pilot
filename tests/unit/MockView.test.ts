import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import MockView from '../../src/views/MockView.vue'

describe('MockView', () => {
  beforeEach(() => localStorage.clear())

  it('renders three passage tabs and a forty-question navigator', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/mock/:mockId', component: MockView }, { path: '/result/:attemptId', component: { template: '<div />' } }, { path: '/', component: { template: '<div />' } }] })
    await router.push('/mock/reading-mock-01')
    await router.isReady()
    const wrapper = mount(MockView, { global: { plugins: [router] } })
    expect(wrapper.findComponent({ name: 'PassageReader' }).exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="passage-tab"]')).toHaveLength(3)
    expect(wrapper.findAll('[data-testid="mock-question"]')).toHaveLength(40)
    await wrapper.findAll('[data-testid="passage-tab"]')[2]!.trigger('click')
    expect(wrapper.text()).toContain('The Ledger Beneath the Roof')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Question 26')
    wrapper.unmount()
  })
})

