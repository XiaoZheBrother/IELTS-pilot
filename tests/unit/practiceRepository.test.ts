import { createPracticeRepository } from '../../src/storage/practiceRepository'
import type { Attempt, PracticeDraft } from '../../src/domain/models'

function createMemoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  }
}

const draft: PracticeDraft = {
  testId: 'shade-networks',
  answers: { shade_q1: 'B' },
  currentIndex: 2,
  remainingSeconds: 930,
  updatedAt: '2026-08-12T00:00:00.000Z',
}

const attempt: Attempt = {
  id: 'attempt-1',
  testId: 'shade-networks',
  answers: { shade_q1: 'B' },
  score: {
    correct: 1,
    total: 8,
    percentage: 13,
    normalizedRaw40: 5,
    approximateBand: 2.5,
    scoringVersion: 'reading-v1',
    items: [],
  },
  submittedAt: '2026-08-12T00:10:00.000Z',
  durationSeconds: 300,
  submissionReason: 'manual',
}

describe('practice repository', () => {
  it('persists drafts across repository instances and removes them after submission', () => {
    const storage = createMemoryStorage()
    const first = createPracticeRepository(storage)
    first.saveDraft(draft)

    const second = createPracticeRepository(storage)
    expect(second.getDraft('shade-networks')).toEqual(draft)

    second.removeDraft('shade-networks')
    expect(first.getDraft('shade-networks')).toBeNull()
  })

  it('keeps attempts newest-first and can retrieve one by id', () => {
    const storage = createMemoryStorage()
    const repository = createPracticeRepository(storage)
    repository.saveAttempt(attempt)
    repository.saveAttempt({
      ...attempt,
      id: 'attempt-2',
      submittedAt: '2026-08-12T00:20:00.000Z',
    })

    expect(repository.listAttempts().map(({ id }) => id)).toEqual(['attempt-2', 'attempt-1'])
    expect(repository.getAttempt('attempt-1')).toEqual(attempt)
  })

  it('recovers safely when stored data is malformed', () => {
    const storage = createMemoryStorage()
    storage.setItem('ielts-pilot:practice:v1', '{broken json')

    const repository = createPracticeRepository(storage)
    expect(repository.listAttempts()).toEqual([])
    expect(repository.getDraft('shade-networks')).toBeNull()
  })
})
