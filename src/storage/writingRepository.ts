import {
  WRITING_CRITERIA,
  WRITING_PROMPT_VERSION,
  calculateOverallBand,
  type WritingAssessmentReport,
  type WritingCriterion,
  type WritingCriterionId,
  type WritingDraft,
  type WritingEvidence,
} from '../domain/writingAssessment'

const STORAGE_KEY = 'ielts-pilot:writing:v1'

export interface WritingBackupV1 {
  version: 1
  drafts: Record<string, WritingDraft>
  reports: WritingAssessmentReport[]
}

export type WritingBackupResult =
  | { ok: true; drafts: number; reports: number }
  | { ok: false; error: string }

export interface WritingRepository {
  getDraft: (taskId: string) => WritingDraft | null
  saveDraft: (draft: WritingDraft) => void
  removeDraft: (taskId: string) => void
  listReports: () => WritingAssessmentReport[]
  getReport: (reportId: string) => WritingAssessmentReport | null
  saveReport: (report: WritingAssessmentReport) => void
  removeReport: (reportId: string) => void
  exportBackup: () => WritingBackupV1
  inspectBackup: (value: unknown) => WritingBackupResult
  importBackup: (value: unknown) => WritingBackupResult
}

function emptyState(): WritingBackupV1 {
  return { version: 1, drafts: {}, reports: [] }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function timestamp(value: unknown): string | null {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) return null
  return value.map((item) => String(item).trim()).slice(0, 5)
}

function criterionId(value: unknown): WritingCriterionId | null {
  return WRITING_CRITERIA.some(({ id }) => id === value) ? value as WritingCriterionId : null
}

function validBand(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 9 && value * 2 === Math.round(value * 2)
}

function migrateDraft(value: unknown): WritingDraft | null {
  if (!isRecord(value) || typeof value.taskId !== 'string' || typeof value.essay !== 'string') return null
  const updatedAt = timestamp(value.updatedAt)
  if (!updatedAt) return null
  return {
    taskId: value.taskId,
    essay: value.essay.slice(0, 20_000),
    elapsedSeconds: typeof value.elapsedSeconds === 'number' && value.elapsedSeconds >= 0 ? Math.floor(value.elapsedSeconds) : 0,
    updatedAt,
  }
}

function migrateCriteria(value: unknown): WritingCriterion[] | null {
  if (!Array.isArray(value) || value.length !== 4) return null
  const criteria = value.flatMap((item): WritingCriterion[] => {
    if (!isRecord(item)) return []
    const criterion = criterionId(item.criterion)
    if (!criterion || !validBand(item.band) || typeof item.rationale !== 'string' || !item.rationale.trim()) return []
    return [{ criterion, band: item.band, rationale: item.rationale.trim().slice(0, 600) }]
  })
  const ids = new Set(criteria.map(({ criterion }) => criterion))
  return criteria.length === 4 && WRITING_CRITERIA.every(({ id }) => ids.has(id)) ? criteria : null
}

function migrateEvidence(value: unknown, essay: string): WritingEvidence[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 8).flatMap((item): WritingEvidence[] => {
    if (!isRecord(item)) return []
    const criterion = criterionId(item.criterion)
    if (!criterion || typeof item.quote !== 'string' || !item.quote.trim() || !essay.includes(item.quote.trim())
      || typeof item.observation !== 'string' || !item.observation.trim() || typeof item.revision !== 'string' || !item.revision.trim()) return []
    return [{ criterion, quote: item.quote.trim().slice(0, 500), observation: item.observation.trim().slice(0, 600), revision: item.revision.trim().slice(0, 600) }]
  })
}

function migrateReport(value: unknown): WritingAssessmentReport | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.taskId !== 'string'
    || (value.taskType !== 'task-1' && value.taskType !== 'task-2') || typeof value.essay !== 'string'
    || typeof value.summary !== 'string' || !value.summary.trim() || typeof value.model !== 'string' || !value.model.trim()
    || value.promptVersion !== WRITING_PROMPT_VERSION) return null
  const generatedAt = timestamp(value.generatedAt)
  const criteria = migrateCriteria(value.criteria)
  const strengths = stringArray(value.strengths)
  const priorities = stringArray(value.priorities)
  if (!generatedAt || !criteria || !strengths || !priorities) return null
  return {
    id: value.id, taskId: value.taskId, taskType: value.taskType, essay: value.essay.slice(0, 20_000),
    wordCount: typeof value.wordCount === 'number' && value.wordCount >= 0 ? Math.floor(value.wordCount) : 0,
    overallBand: calculateOverallBand(criteria.map(({ band }) => band)), summary: value.summary.trim().slice(0, 1_000),
    criteria, strengths, priorities, evidence: migrateEvidence(value.evidence, value.essay),
    model: value.model.trim().slice(0, 180), promptVersion: WRITING_PROMPT_VERSION, generatedAt,
    ...(typeof value.requestId === 'string' && value.requestId ? { requestId: value.requestId.slice(0, 180) } : {}),
  }
}

function parseBackup(value: unknown, strict: boolean): WritingBackupV1 | null {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.drafts) || !Array.isArray(value.reports)) return null
  const draftEntries = Object.entries(value.drafts).flatMap(([id, entry]) => {
    const draft = migrateDraft(entry)
    return draft ? [[id, draft] as const] : []
  })
  const reports = value.reports.map(migrateReport).filter((item): item is WritingAssessmentReport => Boolean(item))
  if (strict && (draftEntries.length !== Object.keys(value.drafts).length || reports.length !== value.reports.length)) return null
  return { version: 1, drafts: Object.fromEntries(draftEntries), reports }
}

function readState(storage: Storage): WritingBackupV1 {
  const serialized = storage.getItem(STORAGE_KEY)
  if (!serialized) return emptyState()
  try {
    const raw = JSON.parse(serialized) as unknown
    return parseBackup(raw, false) ?? emptyState()
  } catch { return emptyState() }
}

function writeState(storage: Storage, state: WritingBackupV1): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function inspectBackup(value: unknown): { result: WritingBackupResult; state?: WritingBackupV1 } {
  const state = parseBackup(value, true)
  if (!state) return { result: { ok: false, error: '写作备份格式无效或已经损坏。' } }
  return { state, result: { ok: true, drafts: Object.keys(state.drafts).length, reports: state.reports.length } }
}

export function createWritingRepository(storage: Storage): WritingRepository {
  return {
    getDraft(taskId) { return clone(readState(storage).drafts[taskId] ?? null) },
    saveDraft(draft) { const state = readState(storage); state.drafts[draft.taskId] = clone(draft); writeState(storage, state) },
    removeDraft(taskId) { const state = readState(storage); delete state.drafts[taskId]; writeState(storage, state) },
    listReports() { return clone(readState(storage).reports).sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt)) },
    getReport(reportId) { return clone(readState(storage).reports.find(({ id }) => id === reportId) ?? null) },
    saveReport(report) {
      const normalized = migrateReport(report)
      if (!normalized) throw new Error('Writing report is invalid and was not saved.')
      const state = readState(storage)
      state.reports = [normalized, ...state.reports.filter(({ id }) => id !== normalized.id)]
      writeState(storage, state)
    },
    removeReport(reportId) { const state = readState(storage); state.reports = state.reports.filter(({ id }) => id !== reportId); writeState(storage, state) },
    exportBackup() { return clone(readState(storage)) },
    inspectBackup(value) { return inspectBackup(value).result },
    importBackup(value) {
      const inspected = inspectBackup(value)
      if (!inspected.state || !inspected.result.ok) return inspected.result
      writeState(storage, inspected.state)
      return inspected.result
    },
  }
}

export function createBrowserWritingRepository(): WritingRepository {
  return createWritingRepository(window.localStorage)
}
