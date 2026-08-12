import { deriveReadingAnalytics } from '../../src/domain/analytics'
import type { Attempt } from '../../src/domain/models'

function createAttempt(id: string, band: number, submittedAt: string, correct: boolean): Attempt {
  return {
    id, testId: 'set-1', mode: 'practice', answers: { q1: [correct ? 'A' : 'B'] }, submittedAt,
    durationSeconds: id === 'a1' ? 600 : 900, submissionReason: 'manual',
    score: {
      correct: correct ? 1 : 0, total: 1, percentage: correct ? 100 : 0,
      normalizedRaw40: correct ? 40 : 0, approximateBand: band, scoringVersion: 'reading-v2',
      items: [{ questionId: 'q1', questionType: 'multiple-choice', isCorrect: correct, givenAnswer: [correct ? 'A' : 'B'], acceptedAnswers: ['A'], explanation: 'A is correct.', sourceRef: { sectionIndex: 0, paragraphIndex: 0 } }],
    },
  }
}

describe('reading analytics', () => {
  it('derives summary, chronological trend, type accuracy and errors', () => {
    const attempts = [
      createAttempt('a2', 7, '2026-08-12T02:00:00.000Z', true),
      createAttempt('a1', 5, '2026-08-12T01:00:00.000Z', false),
    ]
    const analytics = deriveReadingAnalytics(attempts)
    expect(analytics).toMatchObject({ attemptCount: 2, averageBand: 6, bestBand: 7, totalDurationSeconds: 1500 })
    expect(analytics.recentTrend.map(({ attemptId }) => attemptId)).toEqual(['a1', 'a2'])
    expect(analytics.typeAccuracy).toEqual([{ type: 'multiple-choice', correct: 1, total: 2, percentage: 50 }])
    expect(analytics.errors).toHaveLength(1)
    expect(analytics.errors[0]).toMatchObject({ attemptId: 'a1', questionId: 'q1' })
  })

  it('returns stable zero values for a new learner', () => {
    expect(deriveReadingAnalytics([])).toMatchObject({ attemptCount: 0, averageBand: 0, bestBand: 0, totalDurationSeconds: 0, recentTrend: [], typeAccuracy: [], errors: [] })
  })
})

