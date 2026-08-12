import { createAssistantConversationRepository } from '../../src/storage/assistantConversationRepository'

function createMemoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() { return values.size }, clear: () => values.clear(), getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null, removeItem: (key) => values.delete(key), setItem: (key, value) => values.set(key, value),
  }
}

describe('assistant conversation repository', () => {
  it('persists bounded user and assistant messages without credentials', () => {
    const storage = createMemoryStorage()
    const repository = createAssistantConversationRepository(storage)
    repository.save([
      { id: 'm1', role: 'user', content: '分析我最近的状态', createdAt: '2026-08-12T01:00:00.000Z' },
      {
        id: 'm2', role: 'assistant', content: '最近趋势上升。', createdAt: '2026-08-12T01:00:01.000Z',
        promptVersion: 'assistant-v3', model: 'fixture-model', requestId: 'request-1',
        usage: { promptTokens: 80, completionTokens: 20, totalTokens: 100 },
        evidence: [{
          id: 'context.reading.answer_key', label: '本地答案与解析', value: '标准答案和原文定位已加载',
          sampleSize: 1, confidence: 'high',
        }],
        actionContext: { kind: 'reading-practice', targetId: 'shade-networks', questionType: 'short-answer' },
      },
    ])
    expect(repository.list()).toHaveLength(2)
    expect(repository.list()[1]).toMatchObject({
      promptVersion: 'assistant-v3', model: 'fixture-model', requestId: 'request-1',
      usage: { promptTokens: 80, completionTokens: 20, totalTokens: 100 },
    })
    expect(repository.list()[1]?.evidence?.[0]).toMatchObject({ id: 'context.reading.answer_key', sampleSize: 1 })
    expect(repository.list()[1]?.actionContext).toEqual({ kind: 'reading-practice', targetId: 'shade-networks', questionType: 'short-answer' })
    const serialized = storage.getItem('ielts-pilot:assistant:v2') ?? ''
    expect(serialized).not.toMatch(/apiKey|authorization|bearer|credential|secret/i)
    repository.clear()
    expect(repository.list()).toEqual([])
  })

  it('drops invalid assistant metadata rather than persisting arbitrary provider fields', () => {
    const storage = createMemoryStorage()
    const repository = createAssistantConversationRepository(storage)
    repository.save([{
      id: 'm1', role: 'assistant', content: '安全内容', createdAt: '2026-08-12T01:00:00.000Z',
      promptVersion: 'x'.repeat(200), model: 'm'.repeat(300), requestId: 'r'.repeat(300),
      usage: { promptTokens: -1, completionTokens: Number.NaN, totalTokens: 1e20 },
    }])
    expect(repository.list()[0]).toEqual(expect.objectContaining({ id: 'm1', content: '安全内容' }))
    expect(repository.list()[0]).not.toHaveProperty('usage')
  })

  it('discards corrupt or unsupported messages', () => {
    const storage = createMemoryStorage()
    storage.setItem('ielts-pilot:assistant:v1', JSON.stringify({ version: 1, messages: [{ role: 'system', content: 'not allowed' }] }))
    expect(createAssistantConversationRepository(storage).list()).toEqual([])
  })

  it('rejects messages that look like credentials before they reach storage', () => {
    const storage = createMemoryStorage()
    const repository = createAssistantConversationRepository(storage)
    expect(() => repository.save([{
      id: 'secret-message', role: 'user', content: 'Use sk-proj-abcdefghijklmnopqrstuvwxyz123456 for me', createdAt: '2026-08-12T01:00:00.000Z',
    }])).toThrow('敏感凭据')
    expect(storage.getItem('ielts-pilot:assistant:v2') ?? '').not.toContain('sk-proj-')
  })

  it('removes a previously stored assistant answer that contains an unsupported score prediction', () => {
    const storage = createMemoryStorage()
    storage.setItem('ielts-pilot:assistant:v2', JSON.stringify({
      version: 2,
      activeConversationId: 'conversation-1',
      conversations: [{
        id: 'conversation-1', title: '旧回答', createdAt: '2026-08-12T01:00:00.000Z', updatedAt: '2026-08-12T01:00:01.000Z',
        messages: [{
          id: 'unsafe-answer', role: 'assistant', content: '建议：优先练习最容易看到提分效果。', createdAt: '2026-08-12T01:00:01.000Z',
          answer: {
            schemaVersion: 1,
            conclusion: { text: '当前优先练习写作。', confidence: 'high', evidenceIds: ['writing.lowest_dimension'] },
            facts: [],
            inferences: [{ text: '有望稳定到 Band 7。', confidence: 'high', evidenceIds: ['writing.lowest_dimension'] }],
            actions: [{ id: 'writing', title: '专项练习', reason: '最容易看到提分效果', kind: 'writing' }],
          },
        }],
      }],
    }))
    expect(createAssistantConversationRepository(storage).list()).toEqual([])
    expect(storage.getItem('ielts-pilot:assistant:v2')).not.toContain('提分效果')
  })

  it('migrates v1 and supports bounded create, switch, delete and message removal', () => {
    const storage = createMemoryStorage()
    storage.setItem('ielts-pilot:assistant:v1', JSON.stringify({ version: 1, messages: [
      { id: 'legacy', role: 'user', content: '迁移问题', createdAt: '2026-08-12T01:00:00.000Z' },
    ] }))
    let tick = 2
    const repository = createAssistantConversationRepository(storage, () => new Date(`2026-08-12T01:00:0${tick++}.000Z`))
    expect(repository.list()[0]?.content).toBe('迁移问题')
    const original = repository.activeConversationId()
    const created = repository.create('专项计划')
    expect(repository.activeConversationId()).toBe(created.id)
    expect(repository.switchTo(original)).toBe(true)
    repository.deleteMessage('legacy')
    expect(repository.list()).toEqual([])
    repository.remove(original)
    expect(repository.listConversations().some(({ id }) => id === original)).toBe(false)
  })
})
