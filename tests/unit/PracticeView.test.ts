import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import PracticeView from '../../src/views/PracticeView.vue'

describe('PracticeView focused workflow', () => {
  beforeEach(() => localStorage.clear())

  it('shares the annotation reader, pauses the timer and supports question shortcuts', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [
      { path: '/practice/:testId', component: PracticeView },
      { path: '/result/:attemptId', component: { template: '<div />' } },
      { path: '/library', component: { template: '<div />' } },
    ] })
    await router.push('/practice/shade-networks')
    await router.isReady()
    const wrapper = mount(PracticeView, { global: { plugins: [router] } })
    expect(wrapper.findComponent({ name: 'PassageReader' }).exists()).toBe(true)
    await wrapper.get('[data-testid="pause-practice"]').trigger('click')
    expect(wrapper.text()).toContain('练习已暂停')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Question 2')
    wrapper.unmount()
  })
})
