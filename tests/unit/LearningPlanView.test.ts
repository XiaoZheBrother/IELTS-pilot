import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import LearningPlanView from '../../src/components/LearningPlanView.vue'
import type { LearningPlan } from '../../src/domain/learningPlan'

const plan: LearningPlan = {
  version: 1, id: 'plan', createdAt: '2026-08-12T00:00:00.000Z', updatedAt: '2026-08-12T00:00:00.000Z',
  items: [
    { id: 'today', title: '完成计时阅读', reason: '建立新样本', kind: 'practice', to: '/practice/set-1', estimatedMinutes: 20, sourceEvidenceIds: [], horizon: 'today', status: 'pending', createdAt: '2026-08-12T00:00:00.000Z' },
    { id: 'week', title: '复盘写作报告', reason: '检查重复问题', kind: 'writing', to: '/writing', estimatedMinutes: 20, sourceEvidenceIds: [], horizon: 'week', status: 'pending', createdAt: '2026-08-12T00:00:00.000Z' },
  ],
}

describe('LearningPlanView', () => {
  it('switches horizon and emits completion changes', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [
      { path: '/', component: { template: '<main />' } }, { path: '/practice/:id', component: { template: '<main />' } }, { path: '/writing', component: { template: '<main />' } },
    ] })
    await router.push('/')
    const wrapper = mount(LearningPlanView, { props: { plan, attempts: [] }, global: { plugins: [router] } })
    expect(wrapper.text()).toContain('完成计时阅读')
    await wrapper.get('.plan-check').trigger('click')
    expect(wrapper.emitted('toggle')?.[0]).toEqual(['today'])
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    expect(wrapper.text()).toContain('复盘写作报告')
  })
})
