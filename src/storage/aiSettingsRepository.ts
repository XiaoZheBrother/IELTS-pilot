const STORAGE_KEY = 'ielts-pilot:ai-settings:v1'

export interface AiProviderSettings {
  endpoint: string
  model: string
}

export const DEFAULT_AI_PROVIDER_SETTINGS: AiProviderSettings = {
  endpoint: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-4o-mini',
}

export interface AiSettingsRepository {
  get: () => AiProviderSettings
  save: (settings: AiProviderSettings) => void
  clear: () => void
}

function normalize(value: unknown): AiProviderSettings | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  if (typeof raw.endpoint !== 'string' || typeof raw.model !== 'string') return null
  const endpoint = raw.endpoint.trim()
  const model = raw.model.trim().slice(0, 180)
  if (!endpoint || !model) return null
  try {
    const url = new URL(endpoint)
    if (url.username || url.password) return null
    const loopback = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname)
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) return null
    return { endpoint: url.toString(), model }
  } catch { return null }
}

export function createAiSettingsRepository(storage: Storage): AiSettingsRepository {
  return {
    get() {
      const value = storage.getItem(STORAGE_KEY)
      if (!value) return { ...DEFAULT_AI_PROVIDER_SETTINGS }
      try { return normalize(JSON.parse(value) as unknown) ?? { ...DEFAULT_AI_PROVIDER_SETTINGS } } catch { return { ...DEFAULT_AI_PROVIDER_SETTINGS } }
    },
    save(settings) {
      const normalized = normalize(settings)
      if (!normalized) throw new Error('AI 接口地址或模型无效。')
      storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...normalized }))
    },
    clear() { storage.removeItem(STORAGE_KEY) },
  }
}

export function createBrowserAiSettingsRepository(): AiSettingsRepository {
  return createAiSettingsRepository(window.localStorage)
}
