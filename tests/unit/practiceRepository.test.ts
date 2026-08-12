import { createPracticeRepository } from '../../src/storage/practiceRepository'
import type { Attempt, AuthorPackageDraft, InstalledContentPackage, PassageAnnotation, PracticeDraft, PracticeSet, ReaderPreferences } from '../../src/domain/models'

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

describe('practice repository v4', () => {
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

  it('persists reader preferences, annotations, favorites and mastered errors', () => {
    const repository = createPracticeRepository(createMemoryStorage())
    const preferences: ReaderPreferences = { theme: 'sepia', fontScale: 1.1, lineHeight: 1.9, readingWidth: 760, defaultTimedPractice: false }
    const annotation: PassageAnnotation = {
      id: 'annotation-1', setId: 'shade-networks', sectionIndex: 0, paragraphIndex: 0,
      startOffset: 0, endOffset: 5, selectedText: 'Shade', color: 'sage', note: 'Key concept',
      createdAt: '2026-08-12T00:00:00.000Z', updatedAt: '2026-08-12T00:00:00.000Z',
    }

    repository.savePreferences(preferences)
    repository.saveAnnotation(annotation)
    repository.toggleFavoriteSet('shade-networks')
    repository.toggleFavoriteQuestion('shade_q1')
    repository.setErrorMastered('attempt-1:shade_q1', true)

    expect(repository.getPreferences()).toEqual(preferences)
    expect(repository.listAnnotations('shade-networks')).toEqual([annotation])
    expect(repository.listFavoriteSetIds()).toEqual(['shade-networks'])
    expect(repository.listFavoriteQuestionIds()).toEqual(['shade_q1'])
    expect(repository.listMasteredErrorKeys()).toEqual(['attempt-1:shade_q1'])
    repository.removeAnnotation(annotation.id)
    expect(repository.listAnnotations()).toEqual([])
  })

  it('stores installed packages and author drafts and exports a version four backup', () => {
    const repository = createPracticeRepository(createMemoryStorage())
    const installed: InstalledContentPackage = {
      packageId: 'sample-pack', name: 'Sample pack', version: '1.0.0', owner: 'Example Author',
      license: 'CC-BY-4.0', note: 'Authorized sample.', installedAt: '2026-08-12T00:00:00.000Z',
      digest: 'sha256:test', sets: [importedSet],
    }
    const authorDraft: AuthorPackageDraft = { id: 'draft-1', name: 'My pack', updatedAt: '2026-08-12T00:00:00.000Z', package: { name: 'My pack' } }

    repository.saveInstalledPackage(installed)
    repository.saveAuthorDraft(authorDraft)

    expect(repository.getInstalledPackage('sample-pack')).toEqual(installed)
    expect(repository.listImportedSets()).toEqual([importedSet])
    expect(repository.listAuthorDrafts()).toEqual([authorDraft])
    expect(JSON.parse(repository.exportBackup()).version).toBe(4)
    repository.removeInstalledPackage('sample-pack')
    repository.removeAuthorDraft('draft-1')
    expect(repository.listInstalledPackages()).toEqual([])
    expect(repository.listAuthorDrafts()).toEqual([])
  })

  it('migrates a version three backup and assigns deterministic entity clocks', () => {
    const storage = createMemoryStorage()
    storage.setItem('ielts-pilot:practice:v3', JSON.stringify({
      version: 3,
      drafts: { [draft.testId]: draft },
      attempts: [attempt],
      installedPackages: [], authorDrafts: [], annotations: [],
      favoriteSetIds: ['shade-networks'], favoriteQuestionIds: [], masteredErrorKeys: [],
      preferences: { theme: 'paper', fontScale: 1, lineHeight: 1.85, readingWidth: 850, defaultTimedPractice: true },
    }))

    const backup = JSON.parse(createPracticeRepository(storage).exportBackup())
    expect(backup.version).toBe(4)
    expect(backup.clocks['draft:shade-networks']).toBe(draft.updatedAt)
    expect(backup.clocks['attempt:attempt-1']).toBe(attempt.submittedAt)
    expect(backup.clocks['favorite-set:shade-networks']).toBe('1970-01-01T00:00:00.000Z')
    expect(backup.tombstones).toEqual({})
  })

  it('records strictly increasing clocks and deletion tombstones', () => {
    const storage = createMemoryStorage()
    const timestamps = [
      '2026-08-12T01:00:00.000Z',
      '2026-08-12T01:00:00.000Z',
      '2026-08-12T00:59:00.000Z',
    ]
    const repository = createPracticeRepository(storage, () => new Date(timestamps.shift() ?? '2026-08-12T01:00:00.000Z'))

    repository.saveDraft(draft)
    const first = JSON.parse(repository.exportBackup()).clocks['draft:shade-networks']
    repository.removeDraft(draft.testId)
    const removed = JSON.parse(repository.exportBackup())
    repository.saveDraft(draft)
    const recreated = JSON.parse(repository.exportBackup())

    expect(first).toBe('2026-08-12T01:00:00.000Z')
    expect(removed.clocks['draft:shade-networks']).toBeUndefined()
    expect(removed.tombstones['draft:shade-networks']).toBe('2026-08-12T01:00:00.001Z')
    expect(recreated.tombstones['draft:shade-networks']).toBeUndefined()
    expect(recreated.clocks['draft:shade-networks']).toBe('2026-08-12T01:00:00.002Z')
  })

  it('tracks boolean collection removals as tombstones', () => {
    const repository = createPracticeRepository(createMemoryStorage(), () => new Date('2026-08-12T02:00:00.000Z'))
    repository.toggleFavoriteSet('shade-networks')
    repository.toggleFavoriteSet('shade-networks')
    repository.setErrorMastered('attempt-1:shade_q1', true)
    repository.setErrorMastered('attempt-1:shade_q1', false)

    const backup = JSON.parse(repository.exportBackup())
    expect(backup.favoriteSetIds).toEqual([])
    expect(backup.tombstones['favorite-set:shade-networks']).toBeDefined()
    expect(backup.masteredErrorKeys).toEqual([])
    expect(backup.tombstones['mastered-error:attempt-1:shade_q1']).toBeDefined()
  })

  it('imports version four clocks and tombstones without losing them', () => {
    const source = createPracticeRepository(createMemoryStorage(), () => new Date('2026-08-12T03:00:00.000Z'))
    source.saveDraft(draft)
    source.removeDraft(draft.testId)

    const target = createPracticeRepository(createMemoryStorage())
    expect(target.importBackup(source.exportBackup())).toMatchObject({ ok: true })
    expect(JSON.parse(target.exportBackup()).tombstones['draft:shade-networks']).toBe('2026-08-12T03:00:00.001Z')
  })
})

