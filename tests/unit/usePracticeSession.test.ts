import { createPracticeRepository } from '../../src/storage/practiceRepository'
import { practiceSets } from '../../src/data/practiceSets'
import { usePracticeSession } from '../../src/composables/usePracticeSession'

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

const practiceSet = practiceSets[0]!

describe('practice session', () => {
  it('restores a draft and autosaves answers and position', () => {
    const repository = createPracticeRepository(createMemoryStorage())
    repository.saveDraft({
      testId: practiceSet.id,
      answers: { shade_q1: 'B' },
      currentIndex: 2,
      remainingSeconds: 910,
      updatedAt: '2026-08-12T00:00:00.000Z',
    })

    const session = usePracticeSession(practiceSet, {
      repository,
      now: () => new Date('2026-08-12T00:05:00.000Z'),
    })

    expect(session.answers.value).toEqual({ shade_q1: 'B' })
    expect(session.currentIndex.value).toBe(2)
    expect(session.remainingSeconds.value).toBe(910)

    session.answerQuestion('shade_q2', 'false')
    session.goToQuestion(4)

    expect(repository.getDraft(practiceSet.id)).toMatchObject({
      answers: { shade_q1: 'B', shade_q2: 'false' },
      currentIndex: 4,
      updatedAt: '2026-08-12T00:05:00.000Z',
    })
  })

  it('scores once, records the attempt and removes the draft', () => {
    const repository = createPracticeRepository(createMemoryStorage())
    const session = usePracticeSession(practiceSet, {
      repository,
      now: () => new Date('2026-08-12T00:10:00.000Z'),
      createId: () => 'attempt-fixed',
    })

    session.answerQuestion('shade_q1', 'B')
    const first = session.submit('manual')
    const second = session.submit('manual')

    expect(first).toBe(second)
    expect(first.id).toBe('attempt-fixed')
    expect(first.score.correct).toBe(1)
    expect(repository.getDraft(practiceSet.id)).toBeNull()
    expect(repository.getAttempt('attempt-fixed')).toEqual(first)
    expect(session.status.value).toBe('submitted')
  })

  it('submits automatically when the timer reaches zero', () => {
    const repository = createPracticeRepository(createMemoryStorage())
    repository.saveDraft({
      testId: practiceSet.id,
      answers: {},
      currentIndex: 0,
      remainingSeconds: 1,
      updatedAt: '2026-08-12T00:00:00.000Z',
    })
    const session = usePracticeSession(practiceSet, {
      repository,
      now: () => new Date('2026-08-12T00:10:00.000Z'),
      createId: () => 'timed-attempt',
    })

    const attempt = session.tick()

    expect(session.remainingSeconds.value).toBe(0)
    expect(attempt?.submissionReason).toBe('time-expired')
    expect(repository.getAttempt('timed-attempt')).not.toBeNull()
  })
})
