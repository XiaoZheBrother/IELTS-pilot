import { containsSensitiveCredential } from '../domain/sensitiveText'

const STORAGE_KEY = 'ielts-pilot:assistant:v1'
const MAX_MESSAGES = 40
const MAX_CONTENT_LENGTH = 4_000

export interface AssistantStoredMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface AssistantConversationRepository {
  list: () => AssistantStoredMessage[]
  save: (messages: AssistantStoredMessage[]) => void
  clear: () => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeMessage(value: unknown): AssistantStoredMessage | null {
  if (!isRecord(value) || typeof value.id !== 'string'
    || (value.role !== 'user' && value.role !== 'assistant')
    || typeof value.content !== 'string' || typeof value.createdAt !== 'string') return null
  const content = value.content.trim().slice(0, MAX_CONTENT_LENGTH)
  if (!value.id.trim() || !content || !Number.isFinite(Date.parse(value.createdAt))) return null
  return {
    id: value.id.trim().slice(0, 180),
    role: value.role,
    content,
    createdAt: new Date(value.createdAt).toISOString(),
  }
}

function normalizeMessages(value: unknown): AssistantStoredMessage[] {
  const raw = isRecord(value) && value.version === 1 && Array.isArray(value.messages) ? value.messages : []
  return raw.map(normalizeMessage).filter((item): item is AssistantStoredMessage => Boolean(item)).slice(-MAX_MESSAGES)
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function createAssistantConversationRepository(storage: Storage): AssistantConversationRepository {
  return {
    list() {
      const serialized = storage.getItem(STORAGE_KEY)
      if (!serialized) return []
      try { return clone(normalizeMessages(JSON.parse(serialized) as unknown)) } catch { return [] }
    },
    save(messages) {
      if (messages.some(({ content }) => containsSensitiveCredential(content))) {
        throw new Error('检测到疑似敏感凭据，未保存对话。')
      }
      const normalized = messages.map(normalizeMessage).filter((item): item is AssistantStoredMessage => Boolean(item)).slice(-MAX_MESSAGES)
      storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, messages: normalized }))
    },
    clear() { storage.removeItem(STORAGE_KEY) },
  }
}

export function createBrowserAssistantConversationRepository(): AssistantConversationRepository {
  return createAssistantConversationRepository(window.localStorage)
}
