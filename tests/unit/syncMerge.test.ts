import { mergePracticeBackups } from '../../src/domain/syncMerge'
import type { PracticeBackupV4 } from '../../src/storage/practiceRepository'
import type { Attempt, InstalledContentPackage, PracticeDraft } from '../../src/domain/models'

const preferences = { theme: 'paper' as const, fontScale: 1, lineHeight: 1.85, readingWidth: 850, defaultTimedPractice: true }

function backup(overrides: Partial<PracticeBackupV4> = {}): PracticeBackupV4 {
  return {
    version: 4, drafts: {}, attempts: [], installedPackages: [], authorDrafts: [], preferences,
    annotations: [], favoriteSetIds: [], favoriteQuestionIds: [], masteredErrorKeys: [], clocks: {}, tombstones: {},
    ...overrides,
  }
}

const draft = (updatedAt: string, currentIndex: number): PracticeDraft => ({
  testId: 'set-1', answers: {}, currentIndex, remainingSeconds: 1200, updatedAt,
})

const attempt = (id: string): Attempt => ({
  id, testId: 'set-1', answers: {}, score: { correct: 0, total: 0, percentage: 0, normalizedRaw40: 0, approximateBand: 0, scoringVersion: 'reading-v2', items: [] },
  submittedAt: '2026-08-12T01:00:00.000Z', durationSeconds: 60, submissionReason: 'manual',
})

describe('deterministic practice backup merge', () => {
  it('unions immutable attempts and selects the newer draft', () => {
    const local = backup({
      drafts: { 'set-1': draft('2026-08-12T01:00:00.000Z', 1) }, attempts: [attempt('local')],
      clocks: { 'draft:set-1': '2026-08-12T01:00:00.000Z', 'attempt:local': '2026-08-12T01:00:00.000Z' },
    })
    const remote = backup({
      drafts: { 'set-1': draft('2026-08-12T02:00:00.000Z', 4) }, attempts: [attempt('remote')],
      clocks: { 'draft:set-1': '2026-08-12T02:00:00.000Z', 'attempt:remote': '2026-08-12T01:00:00.000Z' },
    })

    const result = mergePracticeBackups(local, remote)
    expect(result.state.drafts['set-1'].currentIndex).toBe(4)
    expect(result.state.attempts.map(({ id }) => id)).toEqual(['local', 'remote'])
    expect(result.preview.added).toBe(2)
    expect(result.preview.conflicts).toBe(1)
  })

  it('applies a newer tombstone and accepts a still newer recreation', () => {
    const present = backup({
      drafts: { 'set-1': draft('2026-08-12T01:00:00.000Z', 1) },
      clocks: { 'draft:set-1': '2026-08-12T01:00:00.000Z' },
    })
    const removed = backup({ tombstones: { 'draft:set-1': '2026-08-12T02:00:00.000Z' } })
    expect(mergePracticeBackups(present, removed).state.drafts['set-1']).toBeUndefined()
    expect(mergePracticeBackups(present, removed).preview.deleted).toBe(1)

    const recreated = backup({
      drafts: { 'set-1': draft('2026-08-12T03:00:00.000Z', 0) },
      clocks: { 'draft:set-1': '2026-08-12T03:00:00.000Z' },
    })
    expect(mergePracticeBackups(removed, recreated).state.drafts['set-1']).toBeDefined()
    expect(mergePracticeBackups(removed, recreated).state.tombstones['draft:set-1']).toBeUndefined()
  })

  it('uses stable content tie-breaking for simultaneous package updates', () => {
    const packageA = { packageId: 'pack', name: 'Alpha', version: '1.0.0', owner: 'A', license: 'CC0', note: '', digest: 'sha256:a', installedAt: '2026-08-12T01:00:00.000Z', sets: [] } as InstalledContentPackage
    const packageB = { ...packageA, name: 'Beta', digest: 'sha256:b' }
    const clock = { 'package:pack': '2026-08-12T01:00:00.000Z' }
    const result = mergePracticeBackups(backup({ installedPackages: [packageA], clocks: clock }), backup({ installedPackages: [packageB], clocks: clock }))
    expect(result.state.installedPackages[0].name).toBe('Beta')
    expect(result.preview.conflicts).toBe(1)
  })

  it('merges boolean collections with the same clock and tombstone rules', () => {
    const local = backup({ favoriteSetIds: ['set-1'], clocks: { 'favorite-set:set-1': '2026-08-12T01:00:00.000Z' } })
    const remote = backup({ tombstones: { 'favorite-set:set-1': '2026-08-12T02:00:00.000Z' } })
    expect(mergePracticeBackups(local, remote).state.favoriteSetIds).toEqual([])
  })

  it('is byte-for-byte commutative regardless of input order', () => {
    const local = backup({
      attempts: [attempt('z')], favoriteQuestionIds: ['q-2'],
      clocks: { 'attempt:z': '2026-08-12T01:00:00.000Z', 'favorite-question:q-2': '2026-08-12T01:00:00.000Z' },
    })
    const remote = backup({
      attempts: [attempt('a')], favoriteQuestionIds: ['q-1'],
      clocks: { 'attempt:a': '2026-08-12T01:00:00.000Z', 'favorite-question:q-1': '2026-08-12T01:00:00.000Z' },
    })
    const left = mergePracticeBackups(local, remote)
    const right = mergePracticeBackups(remote, local)
    expect(left.serialized).toBe(right.serialized)
    expect(left.preview).toEqual(right.preview)
  })

  it('rejects malformed backups instead of silently discarding data', () => {
    expect(() => mergePracticeBackups('{broken', JSON.stringify(backup()))).toThrow('无效')
  })
})
