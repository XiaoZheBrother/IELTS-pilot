import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import ResultView from '../../src/views/ResultView.vue'
import { createBrowserPracticeRepository } from '../../src/storage/practiceRepository'
import { practiceSets } from '../../src/data/practiceSets'
import { scoreReadingTest } from '../../src/domain/readingScorer'

describe('ResultView', () => {
  beforeEach(() => localStorage.clear())

  it('prints the source-linked attempt report', async () => {
    const set = practiceSets[0]!
    createBrowserPracticeRepository().saveAttempt({ id: 'print-attempt', testId: set.id, mode: 'practice', answers: {}, score: scoreReadingTest(set, {}), submittedAt: '2026-08-12T00:00:00.000Z', durationSeconds: 10, submissionReason: 'manual' })
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/result/:attemptId', component: ResultView }, { path: '/analytics', component: { template: '<main />' } }, { path: '/practice/:id', component: { template: '<main />' } }] })
    await router.push('/result/print-attempt')
    await router.isReady()
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    const wrapper = mount(ResultView, { global: { plugins: [router] } })
    await wrapper.get('.print-report').trigger('click')
    expect(print).toHaveBeenCalledOnce()
    print.mockRestore()
  })
})
