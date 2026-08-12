import { useMockSession } from '../../src/composables/useMockSession'
import { fullReadingMock, getMockPracticeSets } from '../../src/data/fullMock'
import { createPracticeRepository } from '../../src/storage/practiceRepository'

function createMemoryStorage(): Storage {
  const values = new Map<string, string>()
  return { get length() { return values.size }, clear: () => values.clear(), getItem: (key) => values.get(key) ?? null, key: (index) => [...values.keys()][index] ?? null, removeItem: (key) => values.delete(key), setItem: (key, value) => values.set(key, value) }
}

describe('complete mock session', () => {
  it('provides forty questions, switches passages and persists answers and flags', () => {
    const repository = createPracticeRepository(createMemoryStorage())
    const session = useMockSession(fullReadingMock, getMockPracticeSets(fullReadingMock.id), { repository, now: () => new Date('2026-08-12T00:00:00.000Z') })
    expect(session.entries).toHaveLength(40)
    session.goToPassage(2)
    expect(session.currentPassageIndex.value).toBe(2)
    expect(session.currentIndex.value).toBe(26)
    session.answerQuestion('rain_q1', ['ii'])
    session.toggleFlag('rain_q1')
    expect(repository.getDraft('mock:reading-mock-01')).toMatchObject({ answers: { rain_q1: ['ii'] }, flags: ['rain_q1'], currentIndex: 26 })
  })

  it('submits a single forty-question mock result and clears the draft', () => {
    const repository = createPracticeRepository(createMemoryStorage())
    const session = useMockSession(fullReadingMock, getMockPracticeSets(fullReadingMock.id), { repository, createId: () => 'mock-attempt' })
    session.answerQuestion('shade_q1', ['B'])
    const attempt = session.submit('manual')
    expect(attempt).toMatchObject({ id: 'mock-attempt', testId: 'reading-mock-01', mode: 'mock', mockId: 'reading-mock-01' })
    expect(attempt.score).toMatchObject({ correct: 1, total: 40 })
    expect(repository.getDraft('mock:reading-mock-01')).toBeNull()
  })
})

