import { createWritingRepository } from '../../src/storage/writingRepository'
import type { WritingAssessmentReport, WritingDraft } from '../../src/domain/writingAssessment'

function createMemoryStorage(): Storage {
  const values = new Map<string, string>()
  return { get length() { return values.size }, clear: () => values.clear(), getItem: (key) => values.get(key) ?? null, key: (index) => [...values.keys()][index] ?? null, removeItem: (key) => values.delete(key), setItem: (key, value) => values.set(key, value) }
}

const draft: WritingDraft = {
  taskId: 'academic-task-2-library-balance',
  essay: 'A saved essay draft.',
  elapsedSeconds: 240,
  updatedAt: '2026-08-12T04:00:00.000Z',
}

const report: WritingAssessmentReport = {
  id: 'writing-report-1', taskId: draft.taskId, taskType: 'task-2', essay: draft.essay,
  wordCount: 4, overallBand: 6.5, summary: 'A focused response.',
  criteria: [
    { criterion: 'task-response', band: 6.5, rationale: 'Clear response.' },
    { criterion: 'coherence-cohesion', band: 6, rationale: 'Logical progression.' },
    { criterion: 'lexical-resource', band: 6.5, rationale: 'Appropriate wording.' },
    { criterion: 'grammatical-range-accuracy', band: 7, rationale: 'Accurate grammar.' },
  ],
  strengths: ['Position', 'Vocabulary', 'Accuracy'], priorities: ['Examples', 'Links', 'Conclusion'],
  evidence: [{ criterion: 'task-response', quote: 'saved essay', observation: 'Direct language.', revision: 'Develop it.' }],
  model: 'demo-model', promptVersion: 'writing-v1', generatedAt: '2026-08-12T04:10:00.000Z', requestId: 'req-1',
}

describe('writing repository', () => {
  it('persists and removes drafts without mutating caller objects', () => {
    const storage = createMemoryStorage()
    const repository = createWritingRepository(storage)
    repository.saveDraft(draft)
    const loaded = repository.getDraft(draft.taskId)
    expect(loaded).toEqual(draft)
    loaded!.essay = 'mutated outside'
    expect(repository.getDraft(draft.taskId)?.essay).toBe(draft.essay)
    repository.removeDraft(draft.taskId)
    expect(repository.getDraft(draft.taskId)).toBeNull()
  })

  it('stores reports newest-first and replaces matching ids', () => {
    const repository = createWritingRepository(createMemoryStorage())
    repository.saveReport(report)
    repository.saveReport({ ...report, id: 'writing-report-2', generatedAt: '2026-08-12T05:00:00.000Z' })
    repository.saveReport({ ...report, summary: 'Updated.' })
    expect(repository.listReports().map(({ id }) => id)).toEqual(['writing-report-2', 'writing-report-1'])
    expect(repository.getReport(report.id)?.summary).toBe('Updated.')
  })

  it('recovers from corrupt storage and discards malformed reports', () => {
    const storage = createMemoryStorage()
    storage.setItem('ielts-pilot:writing:v1', '{broken')
    expect(createWritingRepository(storage).listReports()).toEqual([])
    storage.setItem('ielts-pilot:writing:v1', JSON.stringify({ version: 1, drafts: {}, reports: [{ id: 'bad', criteria: [] }] }))
    expect(createWritingRepository(storage).listReports()).toEqual([])
  })

  it('never serializes credential or raw-response fields', () => {
    const storage = createMemoryStorage()
    const repository = createWritingRepository(storage)
    repository.saveDraft(draft)
    repository.saveReport(report)
    const serialized = storage.getItem('ielts-pilot:writing:v1') ?? ''
    expect(serialized).not.toMatch(/apiKey|authorization|bearer|rawResponse|accessToken/i)
  })
})
