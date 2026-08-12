import type { Attempt, PracticeDraft, PracticeSet, QuestionType, ReadingAnswers } from '../domain/models'

const STORAGE_KEY = 'ielts-pilot:practice:v2'
const LEGACY_STORAGE_KEY = 'ielts-pilot:practice:v1'

interface PersistedPracticeState {
  version: 2
  drafts: Record<string, PracticeDraft>
  attempts: Attempt[]
  importedSets: PracticeSet[]
}

export type BackupImportResult =
  | { ok: true; drafts: number; attempts: number; importedSets: number }
  | { ok: false; error: string }

export interface PracticeRepository {
  getDraft: (testId: string) => PracticeDraft | null
  saveDraft: (draft: PracticeDraft) => void
  removeDraft: (testId: string) => void
  listAttempts: () => Attempt[]
  getAttempt: (attemptId: string) => Attempt | null
  saveAttempt: (attempt: Attempt) => void
  listImportedSets: () => PracticeSet[]
  saveImportedSets: (sets: PracticeSet[]) => void
  exportBackup: () => string
  importBackup: (value: string) => BackupImportResult
}

function emptyState(): PersistedPracticeState {
  return { version: 2, drafts: {}, attempts: [], importedSets: [] }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function normalizeAnswers(value: unknown): ReadingAnswers {
  if (!isRecord(value)) return {}
  return Object.fromEntries(Object.entries(value).map(([key, answer]) => [
    key,
    Array.isArray(answer) ? answer.filter((item): item is string => typeof item === 'string') : typeof answer === 'string' ? [answer] : [],
  ]))
}

function migrateDraft(value: unknown): PracticeDraft | null {
  if (!isRecord(value) || typeof value.testId !== 'string') return null
  return {
    testId: value.testId,
    answers: normalizeAnswers(value.answers),
    currentIndex: typeof value.currentIndex === 'number' ? value.currentIndex : 0,
    remainingSeconds: typeof value.remainingSeconds === 'number' ? value.remainingSeconds : 0,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date(0).toISOString(),
    flags: Array.isArray(value.flags) ? value.flags.filter((flag): flag is string => typeof flag === 'string') : [],
  }
}

function migrateAttempt(value: unknown): Attempt | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.testId !== 'string' || !isRecord(value.score)) return null
  const items = Array.isArray(value.score.items) ? value.score.items.filter(isRecord).map((item) => ({
    questionId: typeof item.questionId === 'string' ? item.questionId : '',
    questionType: (typeof item.questionType === 'string' ? item.questionType : 'multiple-choice') as QuestionType,
    isCorrect: Boolean(item.isCorrect),
    givenAnswer: Array.isArray(item.givenAnswer) ? item.givenAnswer.filter((answer): answer is string => typeof answer === 'string') : typeof item.givenAnswer === 'string' ? [item.givenAnswer] : [],
    acceptedAnswers: Array.isArray(item.acceptedAnswers) ? item.acceptedAnswers as Array<string | string[]> : [],
    explanation: typeof item.explanation === 'string' ? item.explanation : '',
    sourceRef: isRecord(item.sourceRef) && typeof item.sourceRef.sectionIndex === 'number' && typeof item.sourceRef.paragraphIndex === 'number'
      ? { sectionIndex: item.sourceRef.sectionIndex, paragraphIndex: item.sourceRef.paragraphIndex }
      : { sectionIndex: 0, paragraphIndex: 0 },
  })) : []
  return {
    id: value.id,
    testId: value.testId,
    mode: value.mode === 'mock' ? 'mock' : 'practice',
    mockId: typeof value.mockId === 'string' ? value.mockId : undefined,
    answers: normalizeAnswers(value.answers),
    score: {
      correct: Number(value.score.correct) || 0,
      total: Number(value.score.total) || 0,
      percentage: Number(value.score.percentage) || 0,
      normalizedRaw40: Number(value.score.normalizedRaw40) || 0,
      approximateBand: Number(value.score.approximateBand) || 0,
      scoringVersion: 'reading-v2',
      items,
    },
    submittedAt: typeof value.submittedAt === 'string' ? value.submittedAt : new Date(0).toISOString(),
    durationSeconds: Number(value.durationSeconds) || 0,
    submissionReason: value.submissionReason === 'time-expired' ? 'time-expired' : 'manual',
  }
}

function parseState(value: string | null): PersistedPracticeState | null {
  if (!value) return null
  try {
    const parsed: unknown = JSON.parse(value)
    if (!isRecord(parsed) || !isRecord(parsed.drafts) || !Array.isArray(parsed.attempts)) return null
    const drafts = Object.fromEntries(Object.entries(parsed.drafts).flatMap(([key, candidate]) => {
      const draft = migrateDraft(candidate)
      return draft ? [[key, draft]] : []
    }))
    const attempts = parsed.attempts.map(migrateAttempt).filter((attempt): attempt is Attempt => Boolean(attempt))
    const importedSets = Array.isArray(parsed.importedSets) ? clone(parsed.importedSets) as PracticeSet[] : []
    return { version: 2, drafts, attempts, importedSets }
  } catch {
    return null
  }
}

function readState(storage: Storage): PersistedPracticeState {
  return parseState(storage.getItem(STORAGE_KEY)) ?? parseState(storage.getItem(LEGACY_STORAGE_KEY)) ?? emptyState()
}

function writeState(storage: Storage, state: PersistedPracticeState): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function createPracticeRepository(storage: Storage): PracticeRepository {
  return {
    getDraft(testId) { return clone(readState(storage).drafts[testId] ?? null) },
    saveDraft(draft) {
      const state = readState(storage)
      state.drafts[draft.testId] = clone(draft)
      writeState(storage, state)
    },
    removeDraft(testId) {
      const state = readState(storage)
      delete state.drafts[testId]
      writeState(storage, state)
    },
    listAttempts() {
      return clone(readState(storage).attempts).sort((left, right) => Date.parse(right.submittedAt) - Date.parse(left.submittedAt))
    },
    getAttempt(attemptId) { return clone(readState(storage).attempts.find(({ id }) => id === attemptId) ?? null) },
    saveAttempt(attempt) {
      const state = readState(storage)
      state.attempts = [clone(attempt), ...state.attempts.filter(({ id }) => id !== attempt.id)]
      writeState(storage, state)
    },
    listImportedSets() { return clone(readState(storage).importedSets) },
    saveImportedSets(sets) {
      const state = readState(storage)
      const byId = new Map(state.importedSets.map((set) => [set.id, set]))
      sets.forEach((set) => byId.set(set.id, clone(set)))
      state.importedSets = [...byId.values()]
      writeState(storage, state)
    },
    exportBackup() { return JSON.stringify(readState(storage), null, 2) },
    importBackup(value) {
      const parsed = parseState(value)
      if (!parsed) return { ok: false, error: '备份文件格式无效或已损坏。' }
      try {
        const raw = JSON.parse(value) as { version?: unknown }
        if (raw.version !== 2) return { ok: false, error: '仅支持版本 2 的备份文件。' }
      } catch {
        return { ok: false, error: '备份文件不是有效 JSON。' }
      }
      writeState(storage, parsed)
      return { ok: true, drafts: Object.keys(parsed.drafts).length, attempts: parsed.attempts.length, importedSets: parsed.importedSets.length }
    },
  }
}

export function createBrowserPracticeRepository(): PracticeRepository {
  return createPracticeRepository(window.localStorage)
}

