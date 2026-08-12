import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import CoachAnswerView from '../../src/components/CoachAnswerView.vue'
import type { CoachAnswer, CoachEvidenceEntry } from '../../src/domain/coachAnswer'

const catalog: CoachEvidenceEntry[] = [{ id: 'reading.weakest_type', label: '薄弱题型', value: '标题配对 40%（5 题）', sampleSize: 5, confidence: 'high' }]
const answer: CoachAnswer = {
  schemaVersion: 1,
  conclusion: { text: '先处理标题配对。', confidence: 'high', evidenceIds: ['reading.weakest_type'] },
  facts: [{ text: '该题型正确率为 40%。', evidenceIds: ['reading.weakest_type'] }], inferences: [],
  actions: [{ id: 'errors', title: '复盘错题', reason: '处理错误', kind: 'errors' }],
}

describe('CoachAnswerView', () => {
  it('reveals local evidence and renders only resolved action links', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/errors', component: { template: '<main />' } }] })
    await router.push('/')
    const wrapper = mount(CoachAnswerView, { props: {
      answer, catalog,
      actions: [{ id: 'errors', title: '复盘错题', reason: '处理错误', kind: 'errors', to: '/errors?state=learning', estimatedMinutes: 12, sourceEvidenceIds: ['reading.weakest_type'] }],
    }, global: { plugins: [router] } })
    expect(wrapper.text()).toContain('先处理标题配对')
    await wrapper.get('.coach-evidence-toggle').trigger('click')
    expect(wrapper.text()).toContain('标题配对 40%')
    expect(wrapper.get('.coach-actions a').attributes('href')).toBe('/errors?state=learning')
  })
})
