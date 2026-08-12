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
      { id: 'm2', role: 'assistant', content: '最近趋势上升。', createdAt: '2026-08-12T01:00:01.000Z' },
    ])
    expect(repository.list()).toHaveLength(2)
    const serialized = storage.getItem('ielts-pilot:assistant:v1') ?? ''
    expect(serialized).not.toMatch(/apiKey|authorization|bearer|credential|secret/i)
    repository.clear()
    expect(repository.list()).toEqual([])
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
    expect(storage.getItem('ielts-pilot:assistant:v1')).toBeNull()
  })
})
