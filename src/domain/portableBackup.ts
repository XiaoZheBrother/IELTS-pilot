import type { AssistantConversationRepository } from '../storage/assistantConversationRepository'
import type { LearningPlanRepository } from '../storage/learningPlanRepository'
import type { PracticeRepository } from '../storage/practiceRepository'
import type { WritingRepository } from '../storage/writingRepository'

const PROTOCOL = 'ielts-pilot-portable-backup'

export interface PortableBackupRepositories {
  practice: PracticeRepository
  writing: WritingRepository
  learningPlan: LearningPlanRepository
  assistant: AssistantConversationRepository
}

export interface PortableBackupCounts {
  readingDrafts: number
  readingAttempts: number
  importedSets: number
  writingDrafts: number
  writingReports: number
  planItems: number
  conversations: number
  messages: number
}

export type PortableBackupInspection =
  | { ok: true; appVersion: string; exportedAt: string; counts: PortableBackupCounts }
  | { ok: false; error: string }

interface PortableBackupEnvelope {
  protocol: typeof PROTOCOL
  version: 1
  appVersion: string
  exportedAt: string
  exclusions: ['ai-credential', 'ai-settings', 'sync-settings', 'network-addresses']
  sections: {
    practice: unknown
    writing: unknown
    learningPlan: unknown
    assistant: unknown
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseEnvelope(value: string): PortableBackupEnvelope | null {
  try {
    const raw = JSON.parse(value) as unknown
    if (!isRecord(raw) || raw.protocol !== PROTOCOL || raw.version !== 1 || typeof raw.appVersion !== 'string'
      || typeof raw.exportedAt !== 'string' || !Number.isFinite(Date.parse(raw.exportedAt)) || !isRecord(raw.sections)) return null
    if (!('practice' in raw.sections) || !('writing' in raw.sections) || !('learningPlan' in raw.sections) || !('assistant' in raw.sections)) return null
    return raw as unknown as PortableBackupEnvelope
  } catch { return null }
}

export function createPortableBackup(
  repositories: PortableBackupRepositories,
  options: { appVersion: string; now?: Date },
): string {
  const envelope: PortableBackupEnvelope = {
    protocol: PROTOCOL,
    version: 1,
    appVersion: options.appVersion,
    exportedAt: (options.now ?? new Date()).toISOString(),
    exclusions: ['ai-credential', 'ai-settings', 'sync-settings', 'network-addresses'],
    sections: {
      practice: JSON.parse(repositories.practice.exportBackup()) as unknown,
      writing: repositories.writing.exportBackup(),
      learningPlan: repositories.learningPlan.get(),
      assistant: repositories.assistant.exportBackup(),
    },
  }
  return JSON.stringify(envelope, null, 2)
}

export function inspectPortableBackup(value: string, repositories: PortableBackupRepositories): PortableBackupInspection {
  const envelope = parseEnvelope(value)
  if (!envelope) return { ok: false, error: '这不是有效的 IELTS Pilot 完整学习备份。' }
  const practice = repositories.practice.inspectBackup(JSON.stringify(envelope.sections.practice))
  if (!practice.ok) return practice
  const writing = repositories.writing.inspectBackup(envelope.sections.writing)
  if (!writing.ok) return writing
  const learningPlan = repositories.learningPlan.inspectBackup(envelope.sections.learningPlan)
  if (!learningPlan.ok) return learningPlan
  const assistant = repositories.assistant.inspectBackup(envelope.sections.assistant)
  if (!assistant.ok) return assistant
  return {
    ok: true,
    appVersion: envelope.appVersion,
    exportedAt: new Date(envelope.exportedAt).toISOString(),
    counts: {
      readingDrafts: practice.drafts, readingAttempts: practice.attempts, importedSets: practice.importedSets,
      writingDrafts: writing.drafts, writingReports: writing.reports, planItems: learningPlan.items,
      conversations: assistant.conversations, messages: assistant.messages,
    },
  }
}

export function restorePortableBackup(value: string, repositories: PortableBackupRepositories): PortableBackupInspection {
  const inspection = inspectPortableBackup(value, repositories)
  if (!inspection.ok) return inspection
  const incoming = parseEnvelope(value)!
  const previous = {
    practice: repositories.practice.exportBackup(), writing: repositories.writing.exportBackup(),
    learningPlan: repositories.learningPlan.get(), assistant: repositories.assistant.exportBackup(),
  }
  try {
    const results = [
      repositories.practice.importBackup(JSON.stringify(incoming.sections.practice)),
      repositories.writing.importBackup(incoming.sections.writing),
      repositories.learningPlan.importBackup(incoming.sections.learningPlan),
      repositories.assistant.importBackup(incoming.sections.assistant),
    ]
    if (results.some((result) => !result.ok)) throw new Error('备份写入未完成。')
    return inspection
  } catch {
    try {
      repositories.practice.importBackup(previous.practice)
      repositories.writing.importBackup(previous.writing)
      repositories.learningPlan.importBackup(previous.learningPlan)
      repositories.assistant.importBackup(previous.assistant)
    } catch { /* best-effort rollback after a storage failure */ }
    return { ok: false, error: '恢复失败，原有学习数据已保留。请检查本机存储空间后重试。' }
  }
}
