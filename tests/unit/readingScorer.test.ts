import { scoreReadingTest } from '../../src/domain/readingScorer'
import type { PracticeSet } from '../../src/domain/models'

const test: PracticeSet = {
  id: 'test-score',
  sequence: '01',
  eyebrow: 'Field Notes',
  title: 'A Small Reading Test',
  summary: 'Fixture for deterministic scoring.',
  level: 'B2',
  durationMinutes: 12,
  passage: {
    title: 'A Test Passage',
    deck: 'A deliberately small passage.',
    sections: [{ heading: 'One', paragraphs: ['A paragraph.'] }],
  },
  provenance: {
    kind: 'original',
    author: 'IELTS Pilot',
    note: 'Created for automated tests.',
  },
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      prompt: 'Choose A.',
      options: [
        { key: 'A', label: 'First' },
        { key: 'B', label: 'Second' },
      ],
      acceptedAnswers: ['A'],
      explanation: 'A is correct.',
    },
    {
      id: 'q2',
      type: 'true-false-not-given',
      prompt: 'Choose false.',
      acceptedAnswers: ['false'],
      explanation: 'The statement contradicts the passage.',
    },
    {
      id: 'q3',
      type: 'short-answer',
      prompt: 'Type blue.',
      acceptedAnswers: ['blue'],
      wordLimit: 1,
      explanation: 'The passage says blue.',
    },
    {
      id: 'q4',
      type: 'short-answer',
      prompt: 'Type paper.',
      acceptedAnswers: ['paper'],
      wordLimit: 1,
      explanation: 'The passage says paper.',
    },
  ],
}

describe('reading scorer', () => {
  it('returns an auditable item-level result and an approximate band', () => {
    const score = scoreReadingTest(test, {
      q1: 'A',
      q2: 'true',
      q3: 'Blue.',
      q4: '',
    })

    expect(score.correct).toBe(2)
    expect(score.total).toBe(4)
    expect(score.percentage).toBe(50)
    expect(score.normalizedRaw40).toBe(20)
    expect(score.approximateBand).toBe(5.5)
    expect(score.scoringVersion).toBe('reading-v1')
    expect(score.items[1]).toMatchObject({
      questionId: 'q2',
      isCorrect: false,
      givenAnswer: 'true',
      explanation: 'The statement contradicts the passage.',
    })
  })

  it('maps a perfect short practice set to band 9', () => {
    const score = scoreReadingTest(test, {
      q1: 'A',
      q2: 'false',
      q3: 'blue',
      q4: 'paper',
    })

    expect(score.approximateBand).toBe(9)
    expect(score.normalizedRaw40).toBe(40)
  })
})
