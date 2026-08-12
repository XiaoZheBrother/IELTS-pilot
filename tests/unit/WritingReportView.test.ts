import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import WritingReportView from '../../src/views/WritingReportView.vue'
import { WRITING_VIEW_KEY, type WritingViewDependencies } from '../../src/platform/writingViewDependencies'
import { createWritingRepository } from '../../src/storage/writingRepository'
import type { WritingAssessmentReport } from '../../src/domain/writingAssessment'

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return { get length() { return values.size }, clear: () => values.clear(), getItem: (key) => values.get(key) ?? null, key: (index) => [...values.keys()][index] ?? null, removeItem: (key) => values.delete(key), setItem: (key, value) => values.set(key, value) }
}

describe('WritingReportView', () => {
  it('renders four rubric rows, source-backed evidence, metadata and the assistance disclaimer', async () => {
    const repository = createWritingRepository(memoryStorage())
    const report: WritingAssessmentReport = {
      id: 'report-1', taskId: 'academic-task-2-library-balance', taskType: 'task-2', essay: 'A balanced library should protect quiet study rooms.', wordCount: 9,
      overallBand: 6.5, summary: 'The position is clear.',
      criteria: [
        { criterion: 'task-response', band: 6.5, rationale: 'Clear position.' }, { criterion: 'coherence-cohesion', band: 6, rationale: 'Logical sequence.' },
        { criterion: 'lexical-resource', band: 6.5, rationale: 'Appropriate vocabulary.' }, { criterion: 'grammatical-range-accuracy', band: 7, rationale: 'Accurate structures.' },
      ], strengths: ['Clear thesis'], priorities: ['Develop examples'],
      evidence: [{ criterion: 'task-response', quote: 'A balanced library', observation: 'Direct position.', revision: 'State the two priorities.' }],
      model: 'fixture-model', promptVersion: 'writing-v1', generatedAt: '2026-08-12T08:00:00.000Z', requestId: 'req-1',
    }
    repository.saveReport(report)
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/writing/report/:reportId', component: WritingReportView }] })
    await router.push('/writing/report/report-1')
    await router.isReady()
    const dependencies: WritingViewDependencies = { repository, client: {} as WritingViewDependencies['client'], desktop: false, now: () => new Date(), createId: () => '', navigate: vi.fn(async () => {}) }
    const wrapper = mount(WritingReportView, { global: { plugins: [router], provide: { [WRITING_VIEW_KEY as symbol]: dependencies }, stubs: { RouterLink: true } } })
    expect(wrapper.text()).toContain('辅助 Band 6.5')
    expect(wrapper.findAll('[data-testid="writing-criterion"]')).toHaveLength(4)
    expect(wrapper.text()).toContain('A balanced library')
    expect(wrapper.text()).toContain('fixture-model')
    expect(wrapper.text()).toContain('writing-v1')
    expect(wrapper.text()).toContain('不能替代官方 IELTS 成绩')
    expect(wrapper.get('#evidence-1').text()).toContain('A balanced library')
  })
})
