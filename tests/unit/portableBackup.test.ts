import { createPortableBackup, inspectPortableBackup, restorePortableBackup } from '../../src/domain/portableBackup'
import { createAssistantConversationRepository } from '../../src/storage/assistantConversationRepository'
import { createLearningPlanRepository } from '../../src/storage/learningPlanRepository'
import { createPracticeRepository } from '../../src/storage/practiceRepository'
import { createWritingRepository } from '../../src/storage/writingRepository'

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() { return values.size }, clear: () => values.clear(), getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null, removeItem: (key) => values.delete(key), setItem: (key, value) => values.set(key, value),
  }
}

function repositories(storage: Storage) {
  return {
    practice: createPracticeRepository(storage), writing: createWritingRepository(storage),
    learningPlan: createLearningPlanRepository(storage), assistant: createAssistantConversationRepository(storage, () => new Date('2026-08-12T06:00:00.000Z')),
  }
}

describe('portable learning backup', () => {
  it('round-trips reading, writing, plan and assistant data without device secrets', () => {
    const sourceStorage = memoryStorage()
    const source = repositories(sourceStorage)
    source.practice.saveDraft({
      testId: 'set-1', answers: { q1: ['B'] }, currentIndex: 1, remainingSeconds: 400,
      updatedAt: '2026-08-12T05:00:00.000Z', flags: ['q1'],
    })
    source.writing.saveDraft({ taskId: 'task-1', essay: 'Portable essay.', elapsedSeconds: 90, updatedAt: '2026-08-12T05:10:00.000Z' })
    source.learningPlan.save({
      version: 1, id: 'plan-1', cycle: 1, createdAt: '2026-08-12T05:20:00.000Z', updatedAt: '2026-08-12T05:20:00.000Z',
      items: [{ id: 'work-1', title: '练习判断题', reason: '样本不足', kind: 'practice', to: '/practice/set-1', estimatedMinutes: 20, sourceEvidenceIds: [], horizon: 'today', status: 'pending', priority: 'high', createdAt: '2026-08-12T05:20:00.000Z' }],
    })
    source.assistant.save([{ id: 'message-1', role: 'user', content: '下一步练什么？', createdAt: '2026-08-12T05:30:00.000Z' }])
    sourceStorage.setItem('ielts-pilot:ai-settings:v1', JSON.stringify({ endpoint: 'https://secret.example/v1', model: 'private-model' }))
    sourceStorage.setItem('ielts-pilot:sync-settings:v1', JSON.stringify({ endpoint: 'https://sync.secret', token: 'sync-secret' }))

    const serialized = createPortableBackup(source, { appVersion: '0.9.8', now: new Date('2026-08-12T06:00:00.000Z') })
    expect(serialized).not.toContain('secret.example')
    expect(serialized).not.toContain('private-model')
    expect(serialized).not.toContain('sync-secret')

    const target = repositories(memoryStorage())
    expect(inspectPortableBackup(serialized, target)).toMatchObject({
      ok: true, appVersion: '0.9.8', counts: { readingDrafts: 1, writingDrafts: 1, planItems: 1, conversations: 1, messages: 1 },
    })
    expect(restorePortableBackup(serialized, target)).toMatchObject({ ok: true })
    expect(target.practice.getDraft('set-1')?.answers).toEqual({ q1: ['B'] })
    expect(target.writing.getDraft('task-1')?.essay).toBe('Portable essay.')
    expect(target.learningPlan.get()?.items[0]?.title).toBe('练习判断题')
    expect(target.assistant.list()[0]?.content).toBe('下一步练什么？')
  })

  it('rejects an invalid partition before mutation and restores the previous snapshot on write failure', () => {
    const source = repositories(memoryStorage())
    source.writing.saveDraft({ taskId: 'task-1', essay: 'Valid.', elapsedSeconds: 10, updatedAt: '2026-08-12T05:00:00.000Z' })
    const raw = JSON.parse(createPortableBackup(source, { appVersion: '0.9.8', now: new Date('2026-08-12T06:00:00.000Z') }))
    raw.sections.writing = { version: 99, drafts: {}, reports: [] }

    const target = repositories(memoryStorage())
    target.practice.saveDraft({ testId: 'keep', answers: {}, currentIndex: 0, remainingSeconds: 1, updatedAt: '2026-08-12T05:00:00.000Z', flags: [] })
    expect(restorePortableBackup(JSON.stringify(raw), target)).toMatchObject({ ok: false })
    expect(target.practice.getDraft('keep')).not.toBeNull()
  })
})
