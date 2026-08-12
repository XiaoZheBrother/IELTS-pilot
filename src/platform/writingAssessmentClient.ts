import type { WritingMessage, WritingTaskType } from '../domain/writingAssessment'
import { isDesktopRuntime } from './runtime'

export interface WritingEvaluationRequest {
  taskId: string
  taskType: WritingTaskType
  promptVersion: 'writing-v1'
  prompt: string
  essay: string
  wordCount: number
  messages: WritingMessage[]
}

export interface EphemeralAiConfig {
  endpoint: string
  apiKey: string
  model: string
}

export interface WritingModelResponse {
  content: string
  model: string
  requestId: string
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
}

export type WritingAvailability =
  | { available: true; mode: 'gateway' | 'desktop'; model?: string; promptVersion?: string }
  | { available: false; mode: 'gateway' | 'desktop'; reason: 'configuration-required' | 'unavailable' }

export class WritingAssessmentClientError extends Error {
  constructor(public code: string, message: string, public recoverable = true) {
    super(message)
    this.name = 'WritingAssessmentClientError'
  }
}

type Invoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>

export interface WritingAssessmentClient {
  checkAvailability: () => Promise<WritingAvailability>
  evaluate: (request: WritingEvaluationRequest, config?: EphemeralAiConfig) => Promise<WritingModelResponse>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function modelResponse(value: unknown): WritingModelResponse {
  if (!isRecord(value) || typeof value.content !== 'string' || typeof value.model !== 'string' || typeof value.requestId !== 'string') {
    throw new WritingAssessmentClientError('INVALID_RESPONSE', '评分服务返回了无法识别的数据。')
  }
  const response: WritingModelResponse = { content: value.content, model: value.model, requestId: value.requestId }
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

export function createWritingAssessmentClient(options: { fetcher?: typeof fetch; desktop?: boolean; invoke?: Invoke } = {}): WritingAssessmentClient {
  const desktop = options.desktop ?? isDesktopRuntime()
  const fetcher = options.fetcher ?? fetch
  const invoke = options.invoke ?? runtimeInvoke
  return {
    async checkAvailability() {
      if (desktop) return { available: false, mode: 'desktop', reason: 'configuration-required' }
      try {
        const response = await fetcher('/api/v1/writing/health', { headers: { Accept: 'application/json' } })
        if (!response.ok) return { available: false, mode: 'gateway', reason: 'unavailable' }
        const value = await response.json() as Record<string, unknown>
        return { available: true, mode: 'gateway', ...(typeof value.model === 'string' ? { model: value.model } : {}), ...(typeof value.promptVersion === 'string' ? { promptVersion: value.promptVersion } : {}) }
      } catch { return { available: false, mode: 'gateway', reason: 'unavailable' } }
    },
    async evaluate(request, config) {
      try {
        if (desktop) {
          if (!config?.endpoint || !config.apiKey || !config.model) throw new WritingAssessmentClientError('CONFIGURATION_REQUIRED', '桌面端需要提供一次性 AI 连接配置。')
          return modelResponse(await invoke('evaluate_writing', { ...request, ...config }))
        }
        const response = await fetcher('/api/v1/writing/evaluate', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(request),
        })
        const value = await response.json().catch(() => ({})) as Record<string, unknown>
        if (!response.ok) throw new WritingAssessmentClientError(typeof value.code === 'string' ? value.code : 'GATEWAY_ERROR', typeof value.message === 'string' ? value.message : '评分服务暂时不可用。')
        return modelResponse(value)
      } catch (error) {
        if (error instanceof WritingAssessmentClientError) throw error
        throw new WritingAssessmentClientError('NETWORK_ERROR', '无法连接评分服务，请检查网络或服务状态后重试。')
      }
    },
  }
}
