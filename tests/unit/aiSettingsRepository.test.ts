import { DEFAULT_AI_PROVIDER_SETTINGS, createAiSettingsRepository } from '../../src/storage/aiSettingsRepository'

function createMemoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  }
}

describe('AI settings repository', () => {
  it('persists only non-sensitive provider settings', () => {
    const storage = createMemoryStorage()
    const repository = createAiSettingsRepository(storage)
    repository.save({ endpoint: ' https://api.example.com/v1/chat/completions ', model: ' coach-model ' })

    expect(repository.get()).toEqual({ endpoint: 'https://api.example.com/v1/chat/completions', model: 'coach-model' })
    const serialized = storage.getItem('ielts-pilot:ai-settings:v1') ?? ''
    expect(serialized).not.toMatch(/apiKey|secret|credential|authorization|bearer/i)
  })

  it('recovers from invalid stored values', () => {
    const storage = createMemoryStorage()
    storage.setItem('ielts-pilot:ai-settings:v1', '{broken')
    expect(createAiSettingsRepository(storage).get()).toEqual(DEFAULT_AI_PROVIDER_SETTINGS)
    storage.setItem('ielts-pilot:ai-settings:v1', JSON.stringify({ endpoint: 'javascript:alert(1)', model: '' }))
    expect(createAiSettingsRepository(storage).get()).toEqual(DEFAULT_AI_PROVIDER_SETTINGS)
  })

  it('rejects endpoints containing URL credentials', () => {
    const repository = createAiSettingsRepository(createMemoryStorage())
    expect(() => repository.save({ endpoint: 'https://sk-secret@api.example.com/v1/chat/completions', model: 'coach-model' })).toThrow()
  })
})
