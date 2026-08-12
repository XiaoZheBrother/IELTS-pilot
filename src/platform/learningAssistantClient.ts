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
type ChannelLike = { onmessage?: (event: unknown) => void }

export interface LearningAssistantClient {
  checkAvailability: (settings: AiProviderSettings) => Promise<AssistantAvailability>
  chat: (request: AssistantChatRequest, settings: AiProviderSettings, options?: { signal?: AbortSignal }) => Promise<AssistantChatResponse>
  chatStream: (
    request: AssistantChatRequest,
    settings: AiProviderSettings,
    options: { signal?: AbortSignal; onDelta: (delta: string) => void },
  ) => Promise<AssistantChatResponse>
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

function desktopError(error: unknown): LearningAssistantClientError {
  const message = error instanceof Error ? error.message : String(error ?? '')
  if (/timed out|timeout/iu.test(message)) return new LearningAssistantClientError('UPSTREAM_TIMEOUT', 'AI 请求超时，请稍后重试。')
  if (/rate limit|429/iu.test(message)) return new LearningAssistantClientError('UPSTREAM_RATE_LIMIT', 'AI 请求过于频繁，请稍后重试。')
  if (/HTTP\s+(?:401|403)|credential|API key/iu.test(message)) return new LearningAssistantClientError('INVALID_CREDENTIAL', 'AI 密钥无效或没有权限，请在设置中检查。')
  return new LearningAssistantClientError('NETWORK_ERROR', '无法连接 AI 服务，请检查网络或配置后重试。')
}

export function createLearningAssistantClient(options: {
  fetcher?: typeof fetch
  desktop?: boolean
  invoke?: Invoke
  createChannel?: () => ChannelLike | Promise<ChannelLike>
} = {}): LearningAssistantClient {
  const fetcher = options.fetcher ?? fetch
  const desktop = options.desktop ?? isDesktopRuntime()
  const invoke = options.invoke ?? runtimeInvoke
  const createChannel = options.createChannel ?? (async () => {
    const { Channel } = await import('@tauri-apps/api/core')
    return new Channel<unknown>()
  })
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
        throw desktop ? desktopError(error) : new LearningAssistantClientError('NETWORK_ERROR', '无法连接 AI 服务，请检查网络或配置后重试。')
      }
    },
    async chatStream(request, settings, chatOptions) {
      try {
        if (chatOptions.signal?.aborted) throw new LearningAssistantClientError('ABORTED', '已停止生成。')
        if (desktop) {
          const requestId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID() : `assistant-${Date.now()}-${Math.random().toString(36).slice(2)}`
          const createdChannel = createChannel()
          const channel = createdChannel instanceof Promise ? await createdChannel : createdChannel
          channel.onmessage = (event) => {
            if (isRecord(event) && event.type === 'delta' && typeof event.delta === 'string') chatOptions.onDelta(event.delta)
          }
          const pending = invoke('chat_assistant_stream', {
            payload: { ...request, endpoint: settings.endpoint, model: settings.model, requestId }, onEvent: channel,
          })
          const value = chatOptions.signal ? await Promise.race([
            pending,
            new Promise<never>((_resolve, reject) => {
              const cancel = () => {
                void invoke('cancel_assistant_stream', { requestId }).catch(() => undefined)
                reject(new LearningAssistantClientError('ABORTED', '已停止生成。'))
              }
              if (chatOptions.signal!.aborted) cancel()
              else chatOptions.signal!.addEventListener('abort', cancel, { once: true })
            }),
          ]) : await pending
          return responseValue(value)
        }

        const response = await fetcher('/api/v1/assistant/chat/stream', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
          body: JSON.stringify(request), ...(chatOptions.signal ? { signal: chatOptions.signal } : {}),
        })
        if (!response.ok) throw await webError(response)
        if (!response.body) throw new LearningAssistantClientError('INVALID_RESPONSE', 'AI 流式响应不可读取。')
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffered = ''
        let completed: AssistantChatResponse | null = null
        const consume = (line: string) => {
          if (!line.trim()) return
          let event: unknown
          try { event = JSON.parse(line) as unknown } catch { throw new LearningAssistantClientError('INVALID_RESPONSE', 'AI 流式响应格式无效。') }
          if (!isRecord(event) || typeof event.type !== 'string') throw new LearningAssistantClientError('INVALID_RESPONSE', 'AI 流式事件无效。')
          if (event.type === 'delta' && typeof event.delta === 'string') chatOptions.onDelta(event.delta)
          else if (event.type === 'done') completed = responseValue(event.response)
          else if (event.type === 'error') throw new LearningAssistantClientError(
            typeof event.code === 'string' ? event.code : 'UPSTREAM_ERROR',
            typeof event.message === 'string' ? event.message : 'AI 流式请求失败。',
          )
        }
        while (true) {
          const { done, value } = await reader.read()
          buffered += decoder.decode(value, { stream: !done })
          const lines = buffered.split('\n')
          buffered = lines.pop() ?? ''
          lines.forEach(consume)
          if (done) break
        }
        if (buffered.trim()) consume(buffered)
        if (!completed) throw new LearningAssistantClientError('INVALID_RESPONSE', 'AI 流式响应没有完成事件。')
        return completed
      } catch (error) {
        if (error instanceof LearningAssistantClientError) throw error
        if (chatOptions.signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
          throw new LearningAssistantClientError('ABORTED', '已停止生成。')
        }
        throw desktop ? desktopError(error) : new LearningAssistantClientError('NETWORK_ERROR', '无法连接 AI 服务，请检查网络或配置后重试。')
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
      } catch (error) {
        const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
        return { ok: false, error: message.trim() || '连接测试失败。' }
      }
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
