import type { Attempt, PracticeDraft } from '../domain/models'

const STORAGE_KEY = 'ielts-pilot:practice:v1'

interface PersistedPracticeState {
  version: 1
  drafts: Record<string, PracticeDraft>
  attempts: Attempt[]
}

export interface PracticeRepository {
  getDraft: (testId: string) => PracticeDraft | null
  saveDraft: (draft: PracticeDraft) => void
  removeDraft: (testId: string) => void
  listAttempts: () => Attempt[]
  getAttempt: (attemptId: string) => Attempt | null
  saveAttempt: (attempt: Attempt) => void
}

function emptyState(): PersistedPracticeState {
  return { version: 1, drafts: {}, attempts: [] }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readState(storage: Storage): PersistedPracticeState {
  const value = storage.getItem(STORAGE_KEY)
  if (!value) return emptyState()

  try {
    const parsed: unknown = JSON.parse(value)
    if (
      !isRecord(parsed) ||
      parsed.version !== 1 ||
      !isRecord(parsed.drafts) ||
      !Array.isArray(parsed.attempts)
    ) {
      return emptyState()
    }

    return parsed as unknown as PersistedPracticeState
  } catch {
    return emptyState()
  }
}

function writeState(storage: Storage, state: PersistedPracticeState): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function createPracticeRepository(storage: Storage): PracticeRepository {
  return {
    getDraft(testId) {
      return readState(storage).drafts[testId] ?? null
    },
    saveDraft(draft) {
      const state = readState(storage)
      state.drafts[draft.testId] = {
        ...draft,
        answers: { ...draft.answers },
      }
      writeState(storage, state)
    },
    removeDraft(testId) {
      const state = readState(storage)
      delete state.drafts[testId]
      writeState(storage, state)
    },
    listAttempts() {
      return [...readState(storage).attempts].sort(
        (left, right) => Date.parse(right.submittedAt) - Date.parse(left.submittedAt),
      )
    },
    getAttempt(attemptId) {
      return readState(storage).attempts.find(({ id }) => id === attemptId) ?? null
    },
    saveAttempt(attempt) {
      const state = readState(storage)
      state.attempts = [attempt, ...state.attempts.filter(({ id }) => id !== attempt.id)]
      writeState(storage, state)
    },
  }
}

export function createBrowserPracticeRepository(): PracticeRepository {
  return createPracticeRepository(window.localStorage)
}
