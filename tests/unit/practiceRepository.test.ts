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

describe('practice repository v3', () => {
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

  it('stores installed packages and author drafts and exports a version three backup', () => {
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
    expect(JSON.parse(repository.exportBackup()).version).toBe(3)
    repository.removeInstalledPackage('sample-pack')
    repository.removeAuthorDraft('draft-1')
    expect(repository.listInstalledPackages()).toEqual([])
    expect(repository.listAuthorDrafts()).toEqual([])
  })
})

