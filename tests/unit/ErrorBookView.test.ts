import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import ErrorBookView from '../../src/views/ErrorBookView.vue'
import { practiceSets } from '../../src/data/practiceSets'
import { scoreReadingTest } from '../../src/domain/readingScorer'
import { createBrowserPracticeRepository } from '../../src/storage/practiceRepository'

describe('ErrorBookView', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear() })

  it('filters mistakes, marks mastery and creates a retry drill', async () => {
    const set = practiceSets[0]!
    createBrowserPracticeRepository().saveAttempt({ id: 'wrong-attempt', testId: set.id, mode: 'practice', answers: {}, score: scoreReadingTest(set, {}), submittedAt: '2026-08-12T00:00:00.000Z', durationSeconds: 90, submissionReason: 'manual' })
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/errors', component: ErrorBookView }] })
    await router.push('/errors')
    await router.isReady()
    const wrapper = mount(ErrorBookView, { global: { plugins: [router], stubs: { RouterLink: true } } })
    expect(wrapper.findAll('[data-testid="error-row"]')).toHaveLength(set.questions.length)
    await wrapper.findAll('[data-testid="master-error"]')[0]!.trigger('click')
    expect(wrapper.findAll('[data-testid="error-row"]')).toHaveLength(set.questions.length - 1)
    await wrapper.get('[data-testid="start-retry"]').trigger('click')
    expect(JSON.parse(sessionStorage.getItem('ielts-pilot:retry-drill') ?? '{}').questions).toHaveLength(set.questions.length - 1)
  })

  it('initializes strict type and state filters from local action query parameters', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/errors', component: ErrorBookView }] })
    await router.push('/errors?type=multiple-choice&state=mastered')
    await router.isReady()
    const wrapper = mount(ErrorBookView, { global: { plugins: [router], stubs: { RouterLink: true } } })
    const selects = wrapper.findAll('select')
    expect((selects[1]!.element as HTMLSelectElement).value).toBe('multiple-choice')
    expect((selects[2]!.element as HTMLSelectElement).value).toBe('mastered')
  })
})
