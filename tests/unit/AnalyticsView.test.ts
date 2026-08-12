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

  it('shows locally derived study metrics and complete backup controls', () => {
    const wrapper = mount(AnalyticsView, { global: { stubs: { RouterLink: true } } })
    expect(wrapper.text()).toContain('1 次')
    expect(wrapper.text()).toContain('7.0')
    expect(wrapper.text()).toContain('题型诊断')
    expect(wrapper.get('[data-testid="export-backup"]').text()).toContain('导出')
    expect(wrapper.text()).toContain('完整学习备份')
    expect(wrapper.text()).toContain('不包含 API Key')
  })

  it('previews a portable backup before requiring explicit restore confirmation', async () => {
    const wrapper = mount(AnalyticsView, { global: { stubs: { RouterLink: true } } })
    const source = createBrowserPracticeRepository().exportBackup()
    const file = { name: 'legacy-reading.json', text: async () => source } as File
    Object.defineProperty(wrapper.get('[data-testid="import-backup-input"]').element, 'files', { configurable: true, value: [file] })
    await wrapper.get('[data-testid="import-backup-input"]').trigger('change')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(wrapper.text()).toContain('旧版阅读备份')
    expect(wrapper.find('[data-testid="confirm-backup-restore"]').exists()).toBe(true)
  })
})

