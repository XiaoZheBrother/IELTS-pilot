import { scoreReadingTest } from '../../src/domain/readingScorer'
import type { PracticeSet } from '../../src/domain/models'

const sourceRef = { sectionIndex: 0, paragraphIndex: 0 }
const test: PracticeSet = {
  id: 'test-score', sequence: '01', eyebrow: 'Field Notes', title: 'A Small Reading Test',
  summary: 'Fixture for deterministic scoring.', level: 'B2', durationMinutes: 12,
  topics: ['science'], difficulty: 'medium', estimatedBand: 6,
  passage: { title: 'A Test Passage', deck: 'A deliberately small passage.', sections: [{ heading: 'One', paragraphs: ['A paragraph.'] }] },
  provenance: { kind: 'original', author: 'IELTS Pilot', note: 'Created for automated tests.', license: 'CC-BY-4.0' },
  questions: [
    { id: 'q1', type: 'multiple-choice', prompt: 'Choose A.', options: [{ key: 'A', label: 'First' }, { key: 'B', label: 'Second' }], acceptedAnswers: ['A'], explanation: 'A is correct.', sourceRef },
    { id: 'q2', type: 'true-false-not-given', prompt: 'Choose false.', acceptedAnswers: ['false'], explanation: 'The statement contradicts the passage.', sourceRef },
    { id: 'q3', type: 'short-answer', prompt: 'Type blue.', acceptedAnswers: ['blue'], wordLimit: 1, explanation: 'The passage says blue.', sourceRef },
    { id: 'q4', type: 'multiple-select', prompt: 'Choose A and C.', options: [{ key: 'A', label: 'A' }, { key: 'B', label: 'B' }, { key: 'C', label: 'C' }], selectLimit: 2, acceptedAnswers: [['A', 'C']], explanation: 'A and C are correct.', sourceRef },
  ],
}

describe('reading scorer', () => {
  it('returns auditable item-level results including type and source reference', () => {
    const score = scoreReadingTest(test, { q1: ['A'], q2: ['true'], q3: ['Blue.'], q4: ['C', 'A'] })

    expect(score.correct).toBe(3)
    expect(score.total).toBe(4)
    expect(score.percentage).toBe(75)
    expect(score.normalizedRaw40).toBe(30)
    expect(score.approximateBand).toBe(7)
    expect(score.scoringVersion).toBe('reading-v2')
    expect(score.items[1]).toMatchObject({
      questionId: 'q2', questionType: 'true-false-not-given', isCorrect: false,
      givenAnswer: ['true'], sourceRef,
    })
  })

  it('maps a perfect short practice set to band 9', () => {
    const score = scoreReadingTest(test, { q1: ['A'], q2: ['false'], q3: ['blue'], q4: ['A', 'C'] })
    expect(score.approximateBand).toBe(9)
    expect(score.normalizedRaw40).toBe(40)
  })
})

