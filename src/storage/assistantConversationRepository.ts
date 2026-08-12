import { containsUnsupportedOutcomePrediction, type CoachAnswer, type CoachEvidenceEntry } from '../domain/coachAnswer'
import { containsSensitiveCredential } from '../domain/sensitiveText'
import type { AssistantActionContext, AssistantPageContextKind } from '../domain/assistantPageContext'
import { questionTypeLabels } from '../domain/questionLabels'

const STORAGE_KEY = 'ielts-pilot:assistant:v2'
const LEGACY_STORAGE_KEY = 'ielts-pilot:assistant:v1'
const MAX_CONVERSATIONS = 12
const MAX_MESSAGES = 40
const MAX_CONTENT_LENGTH = 4_000

export interface AssistantStoredMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  answer?: CoachAnswer
  evidence?: CoachEvidenceEntry[]
  actionContext?: AssistantActionContext
  promptVersion?: string
  model?: string
  requestId?: string
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
}

export interface AssistantConversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: AssistantStoredMessage[]
}

export interface AssistantConversationBackupV2 {
  version: 2
  activeConversationId: string
  conversations: AssistantConversation[]
}

export type AssistantBackupResult =
  | { ok: true; conversations: number; messages: number }
  | { ok: false; error: string }

export interface AssistantConversationRepository {
  list: () => AssistantStoredMessage[]
  save: (messages: AssistantStoredMessage[]) => void
  clear: () => void
  listConversations: () => AssistantConversation[]
  activeConversationId: () => string
  create: (title?: string) => AssistantConversation
  switchTo: (conversationId: string) => boolean
  remove: (conversationId: string) => void
  deleteMessage: (messageId: string) => void
  exportBackup: () => AssistantConversationBackupV2
  inspectBackup: (value: unknown) => AssistantBackupResult
  importBackup: (value: unknown) => AssistantBackupResult
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function validAnswer(value: unknown): value is CoachAnswer {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.conclusion)
    || !Array.isArray(value.facts) || !Array.isArray(value.inferences) || !Array.isArray(value.actions)) return false
  return typeof value.conclusion.text === 'string' && Array.isArray(value.conclusion.evidenceIds)
    && (value.conclusion.confidence === 'high' || value.conclusion.confidence === 'medium' || value.conclusion.confidence === 'insufficient')
    && value.actions.every((action) => isRecord(action) && typeof action.id === 'string' && typeof action.title === 'string'
      && typeof action.reason === 'string' && ['practice', 'errors', 'writing', 'plan'].includes(String(action.kind))
      && !Object.keys(action).some((key) => key.toLowerCase().includes('url')))
}

function normalizeEvidence(value: unknown): CoachEvidenceEntry[] | undefined {
  if (!Array.isArray(value)) return undefined
  const entries = value.slice(0, 24).flatMap((entry): CoachEvidenceEntry[] => {
    if (!isRecord(entry) || typeof entry.id !== 'string' || typeof entry.label !== 'string' || typeof entry.value !== 'string'
      || !Number.isInteger(entry.sampleSize) || Number(entry.sampleSize) < 0
      || !['high', 'medium', 'insufficient'].includes(String(entry.confidence))) return []
    const id = entry.id.trim().slice(0, 180)
    const label = entry.label.trim().slice(0, 120)
    const text = entry.value.trim().slice(0, 600)
    if (!id || !label || !text || containsSensitiveCredential(`${label} ${text}`)) return []
    return [{ id, label, value: text, sampleSize: Number(entry.sampleSize), confidence: entry.confidence as CoachEvidenceEntry['confidence'] }]
  })
  return entries.length ? entries : undefined
}

function normalizeActionContext(value: unknown): AssistantActionContext | undefined {
  if (!isRecord(value) || !['reading-practice', 'reading-mock', 'reading-result', 'writing-draft', 'writing-report'].includes(String(value.kind))) return undefined
  const targetId = typeof value.targetId === 'string' ? value.targetId.trim().slice(0, 180) : ''
  const questionType = typeof value.questionType === 'string' && Object.hasOwn(questionTypeLabels, value.questionType)
    ? value.questionType as keyof typeof questionTypeLabels : undefined
  return {
    kind: value.kind as AssistantPageContextKind,
    ...(targetId ? { targetId } : {}),
    ...(questionType ? { questionType } : {}),
  }
}

function normalizeMessage(value: unknown): AssistantStoredMessage | null {
  if (!isRecord(value) || typeof value.id !== 'string'
    || (value.role !== 'user' && value.role !== 'assistant')
    || typeof value.content !== 'string' || typeof value.createdAt !== 'string') return null
  const content = value.content.trim().slice(0, MAX_CONTENT_LENGTH)
  if (!value.id.trim() || !content || !Number.isFinite(Date.parse(value.createdAt)) || containsSensitiveCredential(content)) return null
  if (value.role === 'assistant' && (containsUnsupportedOutcomePrediction(content)
    || (value.answer !== undefined && containsUnsupportedOutcomePrediction(JSON.stringify(value.answer))))) return null
  const usage = isRecord(value.usage)
    && Number.isInteger(value.usage.promptTokens) && Number(value.usage.promptTokens) >= 0 && Number(value.usage.promptTokens) <= 1_000_000
    && Number.isInteger(value.usage.completionTokens) && Number(value.usage.completionTokens) >= 0 && Number(value.usage.completionTokens) <= 1_000_000
    && Number.isInteger(value.usage.totalTokens) && Number(value.usage.totalTokens) >= 0 && Number(value.usage.totalTokens) <= 2_000_000
      ? {
          promptTokens: Number(value.usage.promptTokens), completionTokens: Number(value.usage.completionTokens),
          totalTokens: Number(value.usage.totalTokens),
        }
      : undefined
  const boundedMetadata = (entry: unknown, maximum: number): string | undefined => typeof entry === 'string' && entry.trim().length <= maximum
    ? entry.trim() || undefined : undefined
  const evidence = value.role === 'assistant' ? normalizeEvidence(value.evidence) : undefined
  const actionContext = value.role === 'assistant' ? normalizeActionContext(value.actionContext) : undefined
  return {
    id: value.id.trim().slice(0, 180), role: value.role, content,
    createdAt: new Date(value.createdAt).toISOString(),
    ...(value.role === 'assistant' && validAnswer(value.answer) ? { answer: clone(value.answer) } : {}),
    ...(evidence ? { evidence } : {}),
    ...(actionContext ? { actionContext } : {}),
    ...(value.role === 'assistant' && boundedMetadata(value.promptVersion, 80) ? { promptVersion: boundedMetadata(value.promptVersion, 80) } : {}),
    ...(value.role === 'assistant' && boundedMetadata(value.model, 180) ? { model: boundedMetadata(value.model, 180) } : {}),
    ...(value.role === 'assistant' && boundedMetadata(value.requestId, 180) ? { requestId: boundedMetadata(value.requestId, 180) } : {}),
    ...(value.role === 'assistant' && usage ? { usage } : {}),
  }
}

function defaultConversation(now: Date): AssistantConversation {
  const createdAt = now.toISOString()
  return { id: `conversation-${now.getTime()}`, title: '新对话', createdAt, updatedAt: createdAt, messages: [] }
}

function normalizeConversation(value: unknown): AssistantConversation | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.title !== 'string'
    || typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string' || !Array.isArray(value.messages)
    || !Number.isFinite(Date.parse(value.createdAt)) || !Number.isFinite(Date.parse(value.updatedAt))) return null
  return {
    id: value.id.trim().slice(0, 180), title: value.title.trim().slice(0, 36) || '新对话',
    createdAt: new Date(value.createdAt).toISOString(), updatedAt: new Date(value.updatedAt).toISOString(),
    messages: value.messages.map(normalizeMessage).filter((item): item is AssistantStoredMessage => Boolean(item)).slice(-MAX_MESSAGES),
  }
}

function parseValue(raw: unknown, strict = false): AssistantConversationBackupV2 | null {
  if (!isRecord(raw) || raw.version !== 2 || typeof raw.activeConversationId !== 'string' || !Array.isArray(raw.conversations)) return null
  const conversations = raw.conversations.map(normalizeConversation).filter((item): item is AssistantConversation => Boolean(item))
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)).slice(0, MAX_CONVERSATIONS)
  if (!conversations.length || (strict && conversations.length !== raw.conversations.length)) return null
  if (strict && raw.conversations.some((conversation) => isRecord(conversation) && Array.isArray(conversation.messages)
    && normalizeConversation(conversation)?.messages.length !== conversation.messages.length)) return null
  return {
    version: 2,
    activeConversationId: conversations.some(({ id }) => id === raw.activeConversationId) ? raw.activeConversationId : conversations[0]!.id,
    conversations,
  }
}

function parse(serialized: string | null): AssistantConversationBackupV2 | null {
  if (!serialized) return null
  try {
    const raw = JSON.parse(serialized) as unknown
    return parseValue(raw)
  } catch { return null }
}

function migrateLegacy(storage: Storage, now: Date): AssistantConversationBackupV2 | null {
  const serialized = storage.getItem(LEGACY_STORAGE_KEY)
  if (!serialized) return null
  try {
    const raw = JSON.parse(serialized) as unknown
    if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.messages)) return null
    const messages = raw.messages.map(normalizeMessage).filter((item): item is AssistantStoredMessage => Boolean(item)).slice(-MAX_MESSAGES)
    if (!messages.length) return null
    const first = messages.find(({ role }) => role === 'user')
    const conversation: AssistantConversation = {
      ...defaultConversation(now), title: first?.content.slice(0, 36) || '迁移的对话', messages,
      createdAt: messages[0]!.createdAt, updatedAt: messages[messages.length - 1]!.createdAt,
    }
    return { version: 2, activeConversationId: conversation.id, conversations: [conversation] }
  } catch { return null }
}

export function createAssistantConversationRepository(storage: Storage, now: () => Date = () => new Date()): AssistantConversationRepository {
  function write(state: AssistantConversationBackupV2): void {
    storage.setItem(STORAGE_KEY, JSON.stringify(state))
  }
  function read(): AssistantConversationBackupV2 {
    const current = parse(storage.getItem(STORAGE_KEY)) ?? migrateLegacy(storage, now())
    if (current) { write(current); return current }
    const conversation = defaultConversation(now())
    const state: AssistantConversationBackupV2 = { version: 2, activeConversationId: conversation.id, conversations: [conversation] }
    write(state)
    return state
  }
  function active(state: AssistantConversationBackupV2): AssistantConversation {
    return state.conversations.find(({ id }) => id === state.activeConversationId) ?? state.conversations[0]!
  }
  return {
    list() { return clone(active(read()).messages) },
    save(messages) {
      if (messages.some(({ content }) => containsSensitiveCredential(content))) throw new Error('检测到疑似敏感凭据，未保存对话。')
      const state = read()
      const conversation = active(state)
      conversation.messages = messages.map(normalizeMessage).filter((item): item is AssistantStoredMessage => Boolean(item)).slice(-MAX_MESSAGES)
      conversation.updatedAt = now().toISOString()
      const first = conversation.messages.find(({ role }) => role === 'user')
      if (conversation.title === '新对话' && first) conversation.title = first.content.slice(0, 36)
      write(state)
    },
    clear() { const state = read(); const conversation = active(state); conversation.messages = []; conversation.updatedAt = now().toISOString(); write(state) },
    listConversations() { return clone(read().conversations) },
    activeConversationId() { return read().activeConversationId },
    create(title = '新对话') {
      const state = read()
      const conversation = { ...defaultConversation(now()), title: title.trim().slice(0, 36) || '新对话' }
      state.conversations = [conversation, ...state.conversations].slice(0, MAX_CONVERSATIONS)
      state.activeConversationId = conversation.id
      write(state)
      return clone(conversation)
    },
    switchTo(conversationId) {
      const state = read()
      if (!state.conversations.some(({ id }) => id === conversationId)) return false
      state.activeConversationId = conversationId
      write(state)
      return true
    },
    remove(conversationId) {
      const state = read()
      state.conversations = state.conversations.filter(({ id }) => id !== conversationId)
      if (!state.conversations.length) state.conversations = [defaultConversation(now())]
      if (!state.conversations.some(({ id }) => id === state.activeConversationId)) state.activeConversationId = state.conversations[0]!.id
      write(state)
    },
    deleteMessage(messageId) {
      const state = read(); const conversation = active(state)
      conversation.messages = conversation.messages.filter(({ id }) => id !== messageId)
      conversation.updatedAt = now().toISOString(); write(state)
    },
    exportBackup() { return clone(read()) },
    inspectBackup(value) {
      const state = parseValue(value, true)
      return state
        ? { ok: true, conversations: state.conversations.length, messages: state.conversations.reduce((sum, item) => sum + item.messages.length, 0) }
        : { ok: false, error: '助手会话备份格式无效或已经损坏。' }
    },
    importBackup(value) {
      const state = parseValue(value, true)
      if (!state) return { ok: false, error: '助手会话备份格式无效或已经损坏。' }
      write(state)
      return { ok: true, conversations: state.conversations.length, messages: state.conversations.reduce((sum, item) => sum + item.messages.length, 0) }
    },
  }
}

export function createBrowserAssistantConversationRepository(): AssistantConversationRepository {
  return createAssistantConversationRepository(window.localStorage)
}
