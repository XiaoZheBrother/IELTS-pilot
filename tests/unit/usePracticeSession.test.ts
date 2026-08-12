import { createPracticeRepository } from '../../src/storage/practiceRepository'
import { practiceSets } from '../../src/data/practiceSets'
import { usePracticeSession } from '../../src/composables/usePracticeSession'

function createMemoryStorage(): Storage {
  const values = new Map<string, string>()
  return { get length() { return values.size }, clear: () => values.clear(), getItem: (key) => values.get(key) ?? null, key: (index) => [...values.keys()][index] ?? null, removeItem: (key) => values.delete(key), setItem: (key, value) => values.set(key, value) }
}

const practiceSet = practiceSets[0]!

describe('practice session', () => {
  it('restores and autosaves array answers, flags and position', () => {
    const repository = createPracticeRepository(createMemoryStorage())
    repository.saveDraft({ testId: practiceSet.id, answers: { shade_q1: ['B'] }, currentIndex: 2, remainingSeconds: 910, updatedAt: '2026-08-12T00:00:00.000Z', flags: ['shade_q3'] })
    const session = usePracticeSession(practiceSet, { repository, now: () => new Date('2026-08-12T00:05:00.000Z') })

    expect(session.answers.value).toEqual({ shade_q1: ['B'] })
    expect(session.flags.value).toEqual(['shade_q3'])
    session.answerQuestion('shade_q2', ['false'])
    session.toggleFlag('shade_q2')
    session.goToQuestion(4)

    expect(repository.getDraft(practiceSet.id)).toMatchObject({ answers: { shade_q1: ['B'], shade_q2: ['false'] }, flags: ['shade_q3', 'shade_q2'], currentIndex: 4, updatedAt: '2026-08-12T00:05:00.000Z' })
  })

  it('scores once, records a practice attempt and removes the draft', () => {
    const repository = createPracticeRepository(createMemoryStorage())
    const session = usePracticeSession(practiceSet, { repository, now: () => new Date('2026-08-12T00:10:00.000Z'), createId: () => 'attempt-fixed' })
    session.answerQuestion('shade_q1', ['B'])
    const first = session.submit('manual')
    expect(session.submit('manual')).toBe(first)
    expect(first).toMatchObject({ id: 'attempt-fixed', mode: 'practice' })
    expect(first.score.correct).toBe(1)
    expect(repository.getDraft(practiceSet.id)).toBeNull()
  })

  it('submits automatically when the timer reaches zero', () => {
    const repository = createPracticeRepository(createMemoryStorage())
    repository.saveDraft({ testId: practiceSet.id, answers: {}, currentIndex: 0, remainingSeconds: 1, updatedAt: '2026-08-12T00:00:00.000Z' })
    const session = usePracticeSession(practiceSet, { repository, createId: () => 'timed-attempt' })
    expect(session.tick()?.submissionReason).toBe('time-expired')
    expect(repository.getAttempt('timed-attempt')).not.toBeNull()
  })

  it('pauses and restores an untimed practice without decrementing the timer', () => {
    const repository = createPracticeRepository(createMemoryStorage())
    const session = usePracticeSession(practiceSet, { repository })
    const before = session.remainingSeconds.value
    session.togglePause()
    expect(session.isPaused.value).toBe(true)
    expect(session.tick()).toBeNull()
    expect(session.remainingSeconds.value).toBe(before)
    expect(repository.getDraft(practiceSet.id)?.isPaused).toBe(true)

    const restored = usePracticeSession(practiceSet, { repository })
    expect(restored.isPaused.value).toBe(true)
    restored.togglePause()
    restored.tick()
    expect(restored.remainingSeconds.value).toBe(before - 1)
  })

  it('starts a new practice paused when timed practice is disabled by default', () => {
    const repository = createPracticeRepository(createMemoryStorage())
    const session = usePracticeSession(practiceSet, { repository, defaultTimed: false })
    expect(session.isPaused.value).toBe(true)
    const before = session.remainingSeconds.value
    session.tick()
    expect(session.remainingSeconds.value).toBe(before)
  })
})

