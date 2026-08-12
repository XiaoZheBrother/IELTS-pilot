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
    const wrapper = mount({ template: '<RouterView />' }, { global: { plugins: [router] } })
    const view = wrapper.findComponent(PracticeView)
    expect(view.findComponent({ name: 'PassageReader' }).exists()).toBe(true)
    await view.get('[data-testid="pause-practice"]').trigger('click')
    expect(view.text()).toContain('练习已暂停')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }))
    await view.vm.$nextTick()
    expect(view.text()).toContain('Question 2')
    wrapper.unmount()
  })
})
