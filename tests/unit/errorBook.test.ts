import { createRetryPracticeSet, deriveErrorBook, filterErrorBook } from '../../src/domain/errorBook'
import { scoreReadingTest } from '../../src/domain/readingScorer'
import { practiceSets } from '../../src/data/practiceSets'
import type { Attempt } from '../../src/domain/models'

const set = practiceSets[0]!
const attempt: Attempt = {
  id: 'wrong-attempt', testId: set.id, mode: 'practice', answers: {}, score: scoreReadingTest(set, {}),
  submittedAt: '2026-08-12T00:00:00.000Z', durationSeconds: 120, submissionReason: 'manual',
}

describe('error book', () => {
  it('joins wrong answers with questions and filters by type and mastery', () => {
    const entries = deriveErrorBook([attempt], [set], [`wrong-attempt:${set.questions[0]!.id}`])
    expect(entries).toHaveLength(set.questions.length)
    expect(entries[0]).toMatchObject({ key: `wrong-attempt:${set.questions[0]!.id}`, mastered: true, practiceSet: { id: set.id } })
    expect(filterErrorBook(entries, { type: 'multiple-choice', setId: set.id, state: 'learning', query: '' }).every(({ question }) => question.type === 'multiple-choice')).toBe(true)
    expect(filterErrorBook(entries, { type: 'all', setId: 'all', state: 'mastered', query: '' })).toHaveLength(1)
  })

  it('creates a source-linked local retry drill with unique questions', () => {
    const entries = deriveErrorBook([attempt], [set], [])
    const retry = createRetryPracticeSet([...entries, entries[0]!], () => new Date('2026-08-12T01:00:00.000Z'))
    expect(retry).toMatchObject({ id: 'retry-errors-20260812-010000', title: '错题强化练习', durationMinutes: 26 })
    expect(retry.questions).toHaveLength(entries.length)
    expect(retry.passage.sections).toEqual(set.passage.sections)
  })
})
