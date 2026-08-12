import { mount } from '@vue/test-utils'
import AnalyticsView from '../../src/views/AnalyticsView.vue'
import { createBrowserPracticeRepository } from '../../src/storage/practiceRepository'
import type { Attempt } from '../../src/domain/models'

const attempt: Attempt = {
  id: 'analytics-attempt', testId: 'shade-networks', mode: 'practice', answers: { shade_q1: ['B'] },
  submittedAt: '2026-08-12T01:00:00.000Z', durationSeconds: 600, submissionReason: 'manual',
  score: { correct: 1, total: 1, percentage: 100, normalizedRaw40: 40, approximateBand: 7, scoringVersion: 'reading-v2', items: [{ questionId: 'shade_q1', questionType: 'multiple-choice', isCorrect: true, givenAnswer: ['B'], acceptedAnswers: ['B'], explanation: 'Correct.', sourceRef: { sectionIndex: 0, paragraphIndex: 0 } }] },
}

describe('AnalyticsView', () => {
  beforeEach(() => { localStorage.clear(); createBrowserPracticeRepository().saveAttempt(attempt) })

  it('shows locally derived study metrics and backup controls', () => {
    const wrapper = mount(AnalyticsView, { global: { stubs: { RouterLink: true } } })
    expect(wrapper.text()).toContain('1 次')
    expect(wrapper.text()).toContain('7.0')
    expect(wrapper.text()).toContain('题型诊断')
    expect(wrapper.get('[data-testid="export-backup"]').text()).toContain('导出')
  })
})

