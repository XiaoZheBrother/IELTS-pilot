import type { AssistantProviderMessage } from '../domain/learningAssistant'
import type { AiProviderSettings } from '../storage/aiSettingsRepository'
import { isDesktopRuntime } from './runtime'

export interface AssistantChatRequest {
  messages: AssistantProviderMessage[]
}

export interface AssistantChatResponse {
  content: string
  model: string
  requestId: string
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
}

export type AssistantAvailability =
  | { available: true; mode: 'gateway' | 'desktop'; model?: string }
  | { available: false; mode: 'gateway' | 'desktop'; reason: 'configuration-required' | 'unavailable' }

export interface AssistantConnectionResult {
  ok: boolean
  model?: string
  latencyMs?: number
  error?: string
}

export class LearningAssistantClientError extends Error {
  constructor(public code: string, message: string, public recoverable = true) {
    super(message)
    this.name = 'LearningAssistantClientError'
  }
}

type Invoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>

export interface LearningAssistantClient {
  checkAvailability: (settings: AiProviderSettings) => Promise<AssistantAvailability>
  chat: (request: AssistantChatRequest, settings: AiProviderSettings, options?: { signal?: AbortSignal }) => Promise<AssistantChatResponse>
  testConnection: (settings: AiProviderSettings, apiKey?: string) => Promise<AssistantConnectionResult>
  saveCredential: (apiKey: string) => Promise<void>
  clearCredential: () => Promise<void>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function responseValue(value: unknown): AssistantChatResponse {
  if (!isRecord(value) || typeof value.content !== 'string' || !value.content.trim()
    || typeof value.model !== 'string' || typeof value.requestId !== 'string') {
    throw new LearningAssistantClientError('INVALID_RESPONSE', 'AI 服务返回了无法识别的数据。')
  }
  const response: AssistantChatResponse = { content: value.content.trim(), model: value.model, requestId: value.requestId }
  if (isRecord(value.usage)) response.usage = {
    promptTokens: Number(value.usage.promptTokens) || 0,
    completionTokens: Number(value.usage.completionTokens) || 0,
    totalTokens: Number(value.usage.totalTokens) || 0,
  }
  return response
}

async function runtimeInvoke(command: string, args?: Record<string, unknown>): Promise<unknown> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke(command, args)
}

async function webError(response: Response): Promise<LearningAssistantClientError> {
  const value = await response.json().catch(() => ({})) as Record<string, unknown>
  return new LearningAssistantClientError(
    typeof value.code === 'string' ? value.code : 'GATEWAY_ERROR',
    typeof value.message === 'string' ? value.message : 'AI 服务暂时不可用。',
  )
}

export function createLearningAssistantClient(options: { fetcher?: typeof fetch; desktop?: boolean; invoke?: Invoke } = {}): LearningAssistantClient {
  const fetcher = options.fetcher ?? fetch
  const desktop = options.desktop ?? isDesktopRuntime()
  const invoke = options.invoke ?? runtimeInvoke
  return {
    async checkAvailability(settings) {
      if (desktop) {
        try {
          const value = await invoke('get_ai_settings_status')
          return isRecord(value) && value.hasKey === true
            ? { available: true, mode: 'desktop', model: settings.model }
            : { available: false, mode: 'desktop', reason: 'configuration-required' }
        } catch { return { available: false, mode: 'desktop', reason: 'unavailable' } }
      }
      try {
        const response = await fetcher('/api/v1/assistant/health', { headers: { Accept: 'application/json' } })
        if (!response.ok) return { available: false, mode: 'gateway', reason: 'unavailable' }
        const value = await response.json() as Record<string, unknown>
        return { available: true, mode: 'gateway', ...(typeof value.model === 'string' ? { model: value.model } : {}) }
      } catch { return { available: false, mode: 'gateway', reason: 'unavailable' } }
    },
    async chat(request, settings, chatOptions = {}) {
      try {
        if (chatOptions.signal?.aborted) throw new LearningAssistantClientError('ABORTED', '已停止生成。')
        if (desktop) {
          const pending = invoke('chat_assistant', { payload: { ...request, endpoint: settings.endpoint, model: settings.model } })
          const value = chatOptions.signal ? await Promise.race([
            pending,
            new Promise<never>((_, reject) => chatOptions.signal!.addEventListener('abort', () => reject(new LearningAssistantClientError('ABORTED', '已停止生成。')), { once: true })),
          ]) : await pending
          return responseValue(value)
        }
        const response = await fetcher('/api/v1/assistant/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(request),
          ...(chatOptions.signal ? { signal: chatOptions.signal } : {}),
        })
        if (!response.ok) throw await webError(response)
        return responseValue(await response.json())
      } catch (error) {
        if (error instanceof LearningAssistantClientError) throw error
        if (chatOptions.signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
          throw new LearningAssistantClientError('ABORTED', '已停止生成。')
        }
        throw new LearningAssistantClientError('NETWORK_ERROR', '无法连接 AI 服务，请检查网络或配置后重试。')
      }
    },
    async testConnection(settings, apiKey) {
      try {
        if (desktop) {
          const value = await invoke('test_ai_connection', { payload: { endpoint: settings.endpoint, model: settings.model, ...(apiKey?.trim() ? { apiKey: apiKey.trim() } : {}) } })
          if (!isRecord(value)) return { ok: false, error: '连接测试返回无效结果。' }
          return {
            ok: value.ok === true,
            ...(typeof value.model === 'string' ? { model: value.model } : {}),
            ...(typeof value.latencyMs === 'number' ? { latencyMs: value.latencyMs } : {}),
            ...(typeof value.error === 'string' ? { error: value.error } : {}),
          }
        }
        const availability = await this.checkAvailability(settings)
        return availability.available ? { ok: true, ...(availability.model ? { model: availability.model } : {}) } : { ok: false, error: '本地 AI 网关不可用。' }
      } catch (error) { return { ok: false, error: error instanceof Error ? error.message : '连接测试失败。' } }
    },
    async saveCredential(apiKey) {
      if (!desktop) throw new LearningAssistantClientError('UNSUPPORTED', '浏览器版密钥由本地网关管理。')
      if (!apiKey.trim()) throw new LearningAssistantClientError('CONFIGURATION_REQUIRED', '请输入 API Key。')
      await invoke('save_ai_credential', { apiKey: apiKey.trim() })
    },
    async clearCredential() {
      if (!desktop) throw new LearningAssistantClientError('UNSUPPORTED', '浏览器版密钥由本地网关管理。')
      await invoke('clear_ai_credential')
    },
  }
}
