import { createPracticeRepository } from '../../src/storage/practiceRepository'
import type { Attempt, PracticeDraft, PracticeSet } from '../../src/domain/models'

function createMemoryStorage(): Storage {
  const values = new Map<string, string>()
  return { get length() { return values.size }, clear: () => values.clear(), getItem: (key) => values.get(key) ?? null, key: (index) => [...values.keys()][index] ?? null, removeItem: (key) => values.delete(key), setItem: (key, value) => values.set(key, value) }
}

const draft: PracticeDraft = { testId: 'shade-networks', answers: { shade_q1: ['B'] }, currentIndex: 2, remainingSeconds: 930, updatedAt: '2026-08-12T00:00:00.000Z', flags: ['shade_q3'] }
const attempt: Attempt = {
  id: 'attempt-1', testId: 'shade-networks', mode: 'practice', answers: { shade_q1: ['B'] },
  score: { correct: 1, total: 8, percentage: 13, normalizedRaw40: 5, approximateBand: 2.5, scoringVersion: 'reading-v2', items: [] },
  submittedAt: '2026-08-12T00:10:00.000Z', durationSeconds: 300, submissionReason: 'manual',
}
const importedSet = { id: 'imported-set', title: 'Imported set' } as PracticeSet

describe('practice repository v2', () => {
  it('persists drafts, attempts and imported sets across instances', () => {
    const storage = createMemoryStorage()
    const first = createPracticeRepository(storage)
    first.saveDraft(draft)
    first.saveAttempt(attempt)
    first.saveImportedSets([importedSet])

    const second = createPracticeRepository(storage)
    expect(second.getDraft('shade-networks')).toEqual(draft)
    expect(second.getAttempt('attempt-1')).toEqual(attempt)
    expect(second.listImportedSets()).toEqual([importedSet])
  })

  it('keeps attempts newest-first and replaces matching ids', () => {
    const storage = createMemoryStorage()
    const repository = createPracticeRepository(storage)
    repository.saveAttempt(attempt)
    repository.saveAttempt({ ...attempt, id: 'attempt-2', submittedAt: '2026-08-12T00:20:00.000Z' })
    repository.saveAttempt({ ...attempt, durationSeconds: 999 })
    expect(repository.listAttempts().map(({ id }) => id)).toEqual(['attempt-2', 'attempt-1'])
    expect(repository.getAttempt('attempt-1')?.durationSeconds).toBe(999)
  })

  it('migrates v1 string answers into answer arrays', () => {
    const storage = createMemoryStorage()
    storage.setItem('ielts-pilot:practice:v1', JSON.stringify({ version: 1, drafts: { 'shade-networks': { ...draft, answers: { shade_q1: 'B' } } }, attempts: [{ ...attempt, answers: { shade_q1: 'B' }, score: { ...attempt.score, scoringVersion: 'reading-v1' } }] }))
    const repository = createPracticeRepository(storage)
    expect(repository.getDraft('shade-networks')?.answers.shade_q1).toEqual(['B'])
    expect(repository.getAttempt('attempt-1')?.answers.shade_q1).toEqual(['B'])
    expect(repository.getAttempt('attempt-1')?.score.scoringVersion).toBe('reading-v2')
  })

  it('round-trips a versioned backup and rejects malformed input without mutation', () => {
    const sourceStorage = createMemoryStorage()
    const source = createPracticeRepository(sourceStorage)
    source.saveDraft(draft)
    source.saveAttempt(attempt)
    source.saveImportedSets([importedSet])

    const target = createPracticeRepository(createMemoryStorage())
    expect(target.importBackup(source.exportBackup())).toEqual({ ok: true, drafts: 1, attempts: 1, importedSets: 1 })
    expect(target.getDraft('shade-networks')).toEqual(draft)
    expect(target.importBackup('{broken')).toMatchObject({ ok: false })
    expect(target.listAttempts()).toHaveLength(1)
  })

  it('recovers safely when stored data is malformed', () => {
    const storage = createMemoryStorage()
    storage.setItem('ielts-pilot:practice:v2', '{broken json')
    const repository = createPracticeRepository(storage)
    expect(repository.listAttempts()).toEqual([])
    expect(repository.getDraft('shade-networks')).toBeNull()
  })
})

