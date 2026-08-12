import type {
  Attempt, AuthorPackageDraft, InstalledContentPackage, PassageAnnotation, PracticeDraft, PracticeSet,
  QuestionType, ReaderPreferences, ReadingAnswers,
} from '../domain/models'

const STORAGE_KEY = 'ielts-pilot:practice:v4'
const V3_STORAGE_KEY = 'ielts-pilot:practice:v3'
const V2_STORAGE_KEY = 'ielts-pilot:practice:v2'
const LEGACY_STORAGE_KEY = 'ielts-pilot:practice:v1'
const EPOCH = '1970-01-01T00:00:00.000Z'

export const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
  theme: 'paper', fontScale: 1, lineHeight: 1.85, readingWidth: 850, defaultTimedPractice: true,
}

export interface PracticeBackupV4 {
  version: 4
  drafts: Record<string, PracticeDraft>
  attempts: Attempt[]
  installedPackages: InstalledContentPackage[]
  authorDrafts: AuthorPackageDraft[]
  preferences: ReaderPreferences
  annotations: PassageAnnotation[]
  favoriteSetIds: string[]
  favoriteQuestionIds: string[]
  masteredErrorKeys: string[]
  clocks: Record<string, string>
  tombstones: Record<string, string>
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
  listInstalledPackages: () => InstalledContentPackage[]
  getInstalledPackage: (packageId: string) => InstalledContentPackage | null
  saveInstalledPackage: (contentPackage: InstalledContentPackage) => void
  replaceInstalledPackages: (packages: InstalledContentPackage[]) => void
  removeInstalledPackage: (packageId: string) => void
  listAuthorDrafts: () => AuthorPackageDraft[]
  getAuthorDraft: (id: string) => AuthorPackageDraft | null
  saveAuthorDraft: (draft: AuthorPackageDraft) => void
  removeAuthorDraft: (id: string) => void
  getPreferences: () => ReaderPreferences
  savePreferences: (preferences: ReaderPreferences) => void
  listAnnotations: (setId?: string) => PassageAnnotation[]
  saveAnnotation: (annotation: PassageAnnotation) => void
  removeAnnotation: (id: string) => void
  listFavoriteSetIds: () => string[]
  toggleFavoriteSet: (id: string) => boolean
  listFavoriteQuestionIds: () => string[]
  toggleFavoriteQuestion: (id: string) => boolean
  listMasteredErrorKeys: () => string[]
  setErrorMastered: (key: string, mastered: boolean) => void
  exportBackup: () => string
  inspectBackup: (value: string) => BackupImportResult
  importBackup: (value: string) => BackupImportResult
}

function emptyState(): PracticeBackupV4 {
  return {
    version: 4, drafts: {}, attempts: [], installedPackages: [], authorDrafts: [],
    preferences: { ...DEFAULT_READER_PREFERENCES }, annotations: [], favoriteSetIds: [],
    favoriteQuestionIds: [], masteredErrorKeys: [], clocks: {}, tombstones: {},
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function normalizeAnswers(value: unknown): ReadingAnswers {
  if (!isRecord(value)) return {}
  return Object.fromEntries(Object.entries(value).map(([key, answer]) => [
    key,
    Array.isArray(answer) ? strings(answer) : typeof answer === 'string' ? [answer] : [],
  ]))
}

function migrateDraft(value: unknown): PracticeDraft | null {
  if (!isRecord(value) || typeof value.testId !== 'string') return null
  const draft: PracticeDraft = {
    testId: value.testId, answers: normalizeAnswers(value.answers),
    currentIndex: typeof value.currentIndex === 'number' ? value.currentIndex : 0,
    remainingSeconds: typeof value.remainingSeconds === 'number' ? value.remainingSeconds : 0,
    updatedAt: validTimestamp(value.updatedAt), flags: strings(value.flags),
  }
  if (typeof value.isPaused === 'boolean') draft.isPaused = value.isPaused
  return draft
}

function migrateAttempt(value: unknown): Attempt | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.testId !== 'string' || !isRecord(value.score)) return null
  const items = Array.isArray(value.score.items) ? value.score.items.filter(isRecord).map((item) => ({
    questionId: typeof item.questionId === 'string' ? item.questionId : '',
    questionType: (typeof item.questionType === 'string' ? item.questionType : 'multiple-choice') as QuestionType,
    isCorrect: Boolean(item.isCorrect),
    givenAnswer: Array.isArray(item.givenAnswer) ? strings(item.givenAnswer) : typeof item.givenAnswer === 'string' ? [item.givenAnswer] : [],
    acceptedAnswers: Array.isArray(item.acceptedAnswers) ? item.acceptedAnswers as Array<string | string[]> : [],
    explanation: typeof item.explanation === 'string' ? item.explanation : '',
    sourceRef: isRecord(item.sourceRef) && typeof item.sourceRef.sectionIndex === 'number' && typeof item.sourceRef.paragraphIndex === 'number'
      ? { sectionIndex: item.sourceRef.sectionIndex, paragraphIndex: item.sourceRef.paragraphIndex }
      : { sectionIndex: 0, paragraphIndex: 0 },
  })) : []
  return {
    id: value.id, testId: value.testId, mode: value.mode === 'mock' ? 'mock' : 'practice',
    mockId: typeof value.mockId === 'string' ? value.mockId : undefined, answers: normalizeAnswers(value.answers),
    score: {
      correct: Number(value.score.correct) || 0, total: Number(value.score.total) || 0,
      percentage: Number(value.score.percentage) || 0, normalizedRaw40: Number(value.score.normalizedRaw40) || 0,
      approximateBand: Number(value.score.approximateBand) || 0, scoringVersion: 'reading-v2', items,
    },
    submittedAt: validTimestamp(value.submittedAt), durationSeconds: Number(value.durationSeconds) || 0,
    submissionReason: value.submissionReason === 'time-expired' ? 'time-expired' : 'manual',
  }
}

function preferences(value: unknown): ReaderPreferences {
  if (!isRecord(value)) return { ...DEFAULT_READER_PREFERENCES }
  return {
    theme: value.theme === 'sepia' || value.theme === 'night' ? value.theme : 'paper',
    fontScale: typeof value.fontScale === 'number' ? Math.min(Math.max(value.fontScale, 0.85), 1.35) : 1,
    lineHeight: typeof value.lineHeight === 'number' ? Math.min(Math.max(value.lineHeight, 1.4), 2.2) : 1.72,
    readingWidth: typeof value.readingWidth === 'number' ? Math.min(Math.max(value.readingWidth, 600), 980) : 780,
    defaultTimedPractice: value.defaultTimedPractice !== false,
  }
}

function validTimestamp(value: unknown, fallback = EPOCH): string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : fallback
}

function timestampRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {}
  return Object.fromEntries(Object.entries(value).flatMap(([key, timestamp]) =>
    typeof timestamp === 'string' && Number.isFinite(Date.parse(timestamp)) ? [[key, new Date(timestamp).toISOString()]] : [],
  ))
}

function seedLegacyClocks(state: PracticeBackupV4): void {
  Object.values(state.drafts).forEach((draft) => { state.clocks[`draft:${draft.testId}`] = validTimestamp(draft.updatedAt) })
  state.attempts.forEach((attempt) => { state.clocks[`attempt:${attempt.id}`] = validTimestamp(attempt.submittedAt) })
  state.installedPackages.forEach((item) => { state.clocks[`package:${item.packageId}`] = validTimestamp(item.installedAt) })
  state.authorDrafts.forEach((draft) => { state.clocks[`author-draft:${draft.id}`] = validTimestamp(draft.updatedAt) })
  state.annotations.forEach((annotation) => { state.clocks[`annotation:${annotation.id}`] = validTimestamp(annotation.updatedAt) })
  state.favoriteSetIds.forEach((id) => { state.clocks[`favorite-set:${id}`] = EPOCH })
  state.favoriteQuestionIds.forEach((id) => { state.clocks[`favorite-question:${id}`] = EPOCH })
  state.masteredErrorKeys.forEach((id) => { state.clocks[`mastered-error:${id}`] = EPOCH })
  state.clocks['preferences:reader'] = EPOCH
}

function migrateState(value: unknown): PracticeBackupV4 | null {
  if (!isRecord(value) || !isRecord(value.drafts) || !Array.isArray(value.attempts)) return null
  const base = emptyState()
  base.drafts = Object.fromEntries(Object.entries(value.drafts).flatMap(([key, candidate]) => {
    const draft = migrateDraft(candidate)
    return draft ? [[key, draft]] : []
  }))
  base.attempts = value.attempts.map(migrateAttempt).filter((attempt): attempt is Attempt => Boolean(attempt))
  if (value.version === 3 || value.version === 4) {
    base.installedPackages = Array.isArray(value.installedPackages) ? clone(value.installedPackages) as InstalledContentPackage[] : []
    base.authorDrafts = Array.isArray(value.authorDrafts) ? clone(value.authorDrafts) as AuthorPackageDraft[] : []
    base.preferences = preferences(value.preferences)
    base.annotations = Array.isArray(value.annotations) ? clone(value.annotations) as PassageAnnotation[] : []
    base.favoriteSetIds = strings(value.favoriteSetIds)
    base.favoriteQuestionIds = strings(value.favoriteQuestionIds)
    base.masteredErrorKeys = strings(value.masteredErrorKeys)
    if (value.version === 4) {
      base.clocks = timestampRecord(value.clocks)
      base.tombstones = timestampRecord(value.tombstones)
    } else {
      seedLegacyClocks(base)
    }
  } else if (Array.isArray(value.importedSets) && value.importedSets.length) {
    base.installedPackages = [{
      packageId: 'legacy-imports', name: '旧版导入内容', version: '1.0.0', owner: '本地用户',
      license: 'User supplied', note: 'Migrated from IELTS Pilot storage version 2.',
      digest: 'legacy', installedAt: EPOCH, sets: clone(value.importedSets) as PracticeSet[],
    }]
    seedLegacyClocks(base)
  } else {
    seedLegacyClocks(base)
  }
  return base
}

function parseState(value: string | null): PracticeBackupV4 | null {
  if (!value) return null
  try { return migrateState(JSON.parse(value) as unknown) } catch { return null }
}

function readState(storage: Storage): PracticeBackupV4 {
  return parseState(storage.getItem(STORAGE_KEY))
    ?? parseState(storage.getItem(V3_STORAGE_KEY))
    ?? parseState(storage.getItem(V2_STORAGE_KEY))
    ?? parseState(storage.getItem(LEGACY_STORAGE_KEY))
    ?? emptyState()
}

function writeState(storage: Storage, state: PracticeBackupV4): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function inspectBackup(value: string): { result: BackupImportResult; state?: PracticeBackupV4 } {
  let raw: unknown
  try { raw = JSON.parse(value) as unknown } catch { return { result: { ok: false, error: '备份文件不是有效 JSON。' } } }
  if (!isRecord(raw) || (raw.version !== 2 && raw.version !== 3 && raw.version !== 4)) {
    return { result: { ok: false, error: '仅支持版本 2、3 或 4 的阅读备份文件。' } }
  }
  const parsed = migrateState(raw)
  if (!parsed) return { result: { ok: false, error: '阅读备份格式无效或已经损坏。' } }
  return {
    state: parsed,
    result: {
      ok: true, drafts: Object.keys(parsed.drafts).length, attempts: parsed.attempts.length,
      importedSets: parsed.installedPackages.reduce((sum, item) => sum + item.sets.length, 0),
    },
  }
}

export function parsePracticeBackup(value: string | unknown): PracticeBackupV4 | null {
  if (typeof value !== 'string') return migrateState(value)
  try { return migrateState(JSON.parse(value) as unknown) } catch { return null }
}

export function serializePracticeBackup(state: PracticeBackupV4): string {
  return JSON.stringify(state, null, 2)
}

function toggle(items: string[], id: string): { items: string[]; active: boolean } {
  const active = !items.includes(id)
  return { active, items: active ? [...items, id] : items.filter((item) => item !== id) }
}

function nextTimestamp(state: PracticeBackupV4, key: string, now: () => Date): string {
  const candidate = validTimestamp(now().toISOString())
  const previous = state.clocks[key] ?? state.tombstones[key]
  if (!previous || Date.parse(candidate) > Date.parse(previous)) return candidate
  return new Date(Date.parse(previous) + 1).toISOString()
}

function markPresent(state: PracticeBackupV4, key: string, now: () => Date): void {
  state.clocks[key] = nextTimestamp(state, key, now)
  delete state.tombstones[key]
}

function markRemoved(state: PracticeBackupV4, key: string, now: () => Date): void {
  state.tombstones[key] = nextTimestamp(state, key, now)
  delete state.clocks[key]
}

export function createPracticeRepository(storage: Storage, now: () => Date = () => new Date()): PracticeRepository {
  return {
    getDraft(testId) { return clone(readState(storage).drafts[testId] ?? null) },
    saveDraft(draft) { const state = readState(storage); state.drafts[draft.testId] = clone(draft); markPresent(state, `draft:${draft.testId}`, now); writeState(storage, state) },
    removeDraft(testId) { const state = readState(storage); delete state.drafts[testId]; markRemoved(state, `draft:${testId}`, now); writeState(storage, state) },
    listAttempts() { return clone(readState(storage).attempts).sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt)) },
    getAttempt(attemptId) { return clone(readState(storage).attempts.find(({ id }) => id === attemptId) ?? null) },
    saveAttempt(attempt) { const state = readState(storage); state.attempts = [clone(attempt), ...state.attempts.filter(({ id }) => id !== attempt.id)]; markPresent(state, `attempt:${attempt.id}`, now); writeState(storage, state) },
    listImportedSets() { return clone(readState(storage).installedPackages.flatMap(({ sets }) => sets)) },
    saveImportedSets(sets) {
      const state = readState(storage)
      const existing = state.installedPackages.find(({ packageId }) => packageId === 'legacy-imports')
      const byId = new Map((existing?.sets ?? []).map((set) => [set.id, set]))
      sets.forEach((set) => byId.set(set.id, clone(set)))
      const legacy: InstalledContentPackage = {
        packageId: 'legacy-imports', name: '兼容导入内容', version: '1.0.0', owner: '本地用户',
        license: 'User supplied', note: 'Imported through schema version 1.', digest: 'legacy',
        installedAt: new Date().toISOString(), sets: [...byId.values()],
      }
      state.installedPackages = [...state.installedPackages.filter(({ packageId }) => packageId !== legacy.packageId), legacy]
      markPresent(state, `package:${legacy.packageId}`, now)
      writeState(storage, state)
    },
    listInstalledPackages() { return clone(readState(storage).installedPackages) },
    getInstalledPackage(packageId) { return clone(readState(storage).installedPackages.find((item) => item.packageId === packageId) ?? null) },
    saveInstalledPackage(contentPackage) { const state = readState(storage); state.installedPackages = [...state.installedPackages.filter(({ packageId }) => packageId !== contentPackage.packageId), clone(contentPackage)]; markPresent(state, `package:${contentPackage.packageId}`, now); writeState(storage, state) },
    replaceInstalledPackages(packages) {
      const state = readState(storage)
      const incoming = new Set(packages.map(({ packageId }) => packageId))
      state.installedPackages.filter(({ packageId }) => !incoming.has(packageId)).forEach(({ packageId }) => markRemoved(state, `package:${packageId}`, now))
      packages.forEach(({ packageId }) => markPresent(state, `package:${packageId}`, now))
      state.installedPackages = clone(packages)
      writeState(storage, state)
    },
    removeInstalledPackage(packageId) { const state = readState(storage); state.installedPackages = state.installedPackages.filter((item) => item.packageId !== packageId); markRemoved(state, `package:${packageId}`, now); writeState(storage, state) },
    listAuthorDrafts() { return clone(readState(storage).authorDrafts).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)) },
    getAuthorDraft(id) { return clone(readState(storage).authorDrafts.find((item) => item.id === id) ?? null) },
    saveAuthorDraft(draft) { const state = readState(storage); state.authorDrafts = [clone(draft), ...state.authorDrafts.filter(({ id }) => id !== draft.id)]; markPresent(state, `author-draft:${draft.id}`, now); writeState(storage, state) },
    removeAuthorDraft(id) { const state = readState(storage); state.authorDrafts = state.authorDrafts.filter((item) => item.id !== id); markRemoved(state, `author-draft:${id}`, now); writeState(storage, state) },
    getPreferences() { return clone(readState(storage).preferences) },
    savePreferences(value) { const state = readState(storage); state.preferences = preferences(value); markPresent(state, 'preferences:reader', now); writeState(storage, state) },
    listAnnotations(setId) { return clone(readState(storage).annotations.filter((item) => !setId || item.setId === setId)) },
    saveAnnotation(annotation) { const state = readState(storage); state.annotations = [...state.annotations.filter(({ id }) => id !== annotation.id), clone(annotation)]; markPresent(state, `annotation:${annotation.id}`, now); writeState(storage, state) },
    removeAnnotation(id) { const state = readState(storage); state.annotations = state.annotations.filter((item) => item.id !== id); markRemoved(state, `annotation:${id}`, now); writeState(storage, state) },
    listFavoriteSetIds() { return clone(readState(storage).favoriteSetIds) },
    toggleFavoriteSet(id) { const state = readState(storage); const result = toggle(state.favoriteSetIds, id); state.favoriteSetIds = result.items; result.active ? markPresent(state, `favorite-set:${id}`, now) : markRemoved(state, `favorite-set:${id}`, now); writeState(storage, state); return result.active },
    listFavoriteQuestionIds() { return clone(readState(storage).favoriteQuestionIds) },
    toggleFavoriteQuestion(id) { const state = readState(storage); const result = toggle(state.favoriteQuestionIds, id); state.favoriteQuestionIds = result.items; result.active ? markPresent(state, `favorite-question:${id}`, now) : markRemoved(state, `favorite-question:${id}`, now); writeState(storage, state); return result.active },
    listMasteredErrorKeys() { return clone(readState(storage).masteredErrorKeys) },
    setErrorMastered(key, mastered) { const state = readState(storage); state.masteredErrorKeys = mastered ? [...new Set([...state.masteredErrorKeys, key])] : state.masteredErrorKeys.filter((item) => item !== key); mastered ? markPresent(state, `mastered-error:${key}`, now) : markRemoved(state, `mastered-error:${key}`, now); writeState(storage, state) },
    exportBackup() { return serializePracticeBackup(readState(storage)) },
    inspectBackup(value) { return inspectBackup(value).result },
    importBackup(value) {
      const inspected = inspectBackup(value)
      if (!inspected.state || !inspected.result.ok) return inspected.result
      writeState(storage, inspected.state)
      return inspected.result
    },
  }
}

export function createBrowserPracticeRepository(): PracticeRepository {
  return createPracticeRepository(window.localStorage)
}
