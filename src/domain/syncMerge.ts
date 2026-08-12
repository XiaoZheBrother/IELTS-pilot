import type {
  Attempt, AuthorPackageDraft, InstalledContentPackage, PassageAnnotation, PracticeDraft, ReaderPreferences,
} from './models'
import { canonicalJson } from './canonicalJson'
import { parsePracticeBackup, type PracticeBackupV4 } from '../storage/practiceRepository'

const EPOCH = '1970-01-01T00:00:00.000Z'

export interface SyncMergePreview {
  total: number
  added: number
  conflicts: number
  deleted: number
  unchanged: number
}

export interface SyncMergeResult {
  state: PracticeBackupV4
  serialized: string
  preview: SyncMergePreview
}

interface Event<T> {
  present: boolean
  time: string
  value?: T
}

interface CollectionDescriptor<T> {
  prefix: string
  values: (state: PracticeBackupV4) => Map<string, T>
  assign: (state: PracticeBackupV4, values: Array<[string, T]>) => void
}

function recordMap<T>(value: Record<string, T>): Map<string, T> {
  return new Map(Object.entries(value))
}

function arrayMap<T>(value: T[], id: (item: T) => string): Map<string, T> {
  return new Map(value.map((item) => [id(item), item]))
}

const collections: Array<CollectionDescriptor<unknown>> = [
  {
    prefix: 'draft', values: (state) => recordMap(state.drafts),
    assign: (state, values) => { state.drafts = Object.fromEntries(values) as Record<string, PracticeDraft> },
  },
  {
    prefix: 'attempt', values: (state) => arrayMap(state.attempts, (item) => item.id),
    assign: (state, values) => { state.attempts = values.map(([, item]) => item) as Attempt[] },
  },
  {
    prefix: 'package', values: (state) => arrayMap(state.installedPackages, (item) => item.packageId),
    assign: (state, values) => { state.installedPackages = values.map(([, item]) => item) as InstalledContentPackage[] },
  },
  {
    prefix: 'author-draft', values: (state) => arrayMap(state.authorDrafts, (item) => item.id),
    assign: (state, values) => { state.authorDrafts = values.map(([, item]) => item) as AuthorPackageDraft[] },
  },
  {
    prefix: 'annotation', values: (state) => arrayMap(state.annotations, (item) => item.id),
    assign: (state, values) => { state.annotations = values.map(([, item]) => item) as PassageAnnotation[] },
  },
  {
    prefix: 'favorite-set', values: (state) => new Map(state.favoriteSetIds.map((id) => [id, id])),
    assign: (state, values) => { state.favoriteSetIds = values.map(([id]) => id) },
  },
  {
    prefix: 'favorite-question', values: (state) => new Map(state.favoriteQuestionIds.map((id) => [id, id])),
    assign: (state, values) => { state.favoriteQuestionIds = values.map(([id]) => id) },
  },
  {
    prefix: 'mastered-error', values: (state) => new Map(state.masteredErrorKeys.map((id) => [id, id])),
    assign: (state, values) => { state.masteredErrorKeys = values.map(([id]) => id) },
  },
]

function idsFor(prefix: string, left: PracticeBackupV4, right: PracticeBackupV4, leftValues: Map<string, unknown>, rightValues: Map<string, unknown>): string[] {
  const marker = `${prefix}:`
  const ids = new Set([...leftValues.keys(), ...rightValues.keys()])
  for (const state of [left, right]) {
    for (const key of [...Object.keys(state.clocks), ...Object.keys(state.tombstones)]) {
      if (key.startsWith(marker)) ids.add(key.slice(marker.length))
    }
  }
  return [...ids].sort((a, b) => a.localeCompare(b))
}

function eventFor<T>(state: PracticeBackupV4, key: string, values: Map<string, T>): Event<T> | null {
  const clock = state.clocks[key]
  const tombstone = state.tombstones[key]
  if (tombstone && (!clock || Date.parse(tombstone) >= Date.parse(clock))) return { present: false, time: tombstone }
  if (clock) return { present: true, time: clock, value: values.get(key.slice(key.indexOf(':') + 1)) }
  const value = values.get(key.slice(key.indexOf(':') + 1))
  return value === undefined ? null : { present: true, time: EPOCH, value }
}

function choose<T>(left: Event<T> | null, right: Event<T> | null): Event<T> | null {
  if (!left) return right
  if (!right) return left
  const delta = Date.parse(left.time) - Date.parse(right.time)
  if (delta !== 0) return delta > 0 ? left : right
  if (left.present !== right.present) return left.present ? right : left
  if (!left.present) return left
  return canonicalJson(left.value) >= canonicalJson(right.value) ? left : right
}

function sameEvent(left: Event<unknown> | null, right: Event<unknown> | null): boolean {
  if (!left || !right || left.present !== right.present) return false
  return !left.present || canonicalJson(left.value) === canonicalJson(right.value)
}

function notePreview(preview: SyncMergePreview, left: Event<unknown> | null, right: Event<unknown> | null, selected: Event<unknown>): void {
  preview.total += 1
  if (left && right) {
    if (sameEvent(left, right)) preview.unchanged += 1
    else preview.conflicts += 1
  } else if (selected.present) {
    preview.added += 1
  }
  if (!selected.present && ((left?.present ?? false) || (right?.present ?? false))) preview.deleted += 1
}

function sortedRecord(value: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)))
}

function normalizeInput(value: PracticeBackupV4 | string): PracticeBackupV4 {
  const parsed = parsePracticeBackup(value)
  if (!parsed) throw new Error('无效的练习备份，无法执行同步合并。')
  return parsed
}

export function mergePracticeBackups(leftInput: PracticeBackupV4 | string, rightInput: PracticeBackupV4 | string): SyncMergeResult {
  const left = normalizeInput(leftInput)
  const right = normalizeInput(rightInput)
  const state: PracticeBackupV4 = {
    version: 4, drafts: {}, attempts: [], installedPackages: [], authorDrafts: [],
    preferences: left.preferences, annotations: [], favoriteSetIds: [], favoriteQuestionIds: [],
    masteredErrorKeys: [], clocks: {}, tombstones: {},
  }
  const preview: SyncMergePreview = { total: 0, added: 0, conflicts: 0, deleted: 0, unchanged: 0 }

  for (const descriptor of collections) {
    const leftValues = descriptor.values(left)
    const rightValues = descriptor.values(right)
    const merged: Array<[string, unknown]> = []
    for (const id of idsFor(descriptor.prefix, left, right, leftValues, rightValues)) {
      const key = `${descriptor.prefix}:${id}`
      const leftEvent = eventFor(left, key, leftValues)
      const rightEvent = eventFor(right, key, rightValues)
      const selected = choose(leftEvent, rightEvent)
      if (!selected) continue
      notePreview(preview, leftEvent, rightEvent, selected)
      if (selected.present && selected.value !== undefined) {
        merged.push([id, selected.value])
        state.clocks[key] = selected.time
      } else {
        state.tombstones[key] = selected.time
      }
    }
    descriptor.assign(state, merged)
  }

  const preferenceKey = 'preferences:reader'
  const preferenceValuesLeft = new Map([['reader', left.preferences as ReaderPreferences]])
  const preferenceValuesRight = new Map([['reader', right.preferences as ReaderPreferences]])
  const leftPreference = eventFor(left, preferenceKey, preferenceValuesLeft)
  const rightPreference = eventFor(right, preferenceKey, preferenceValuesRight)
  const selectedPreference = choose(leftPreference, rightPreference)
  if (selectedPreference?.present && selectedPreference.value) {
    state.preferences = selectedPreference.value
    state.clocks[preferenceKey] = selectedPreference.time
    notePreview(preview, leftPreference, rightPreference, selectedPreference)
  }

  state.clocks = sortedRecord(state.clocks)
  state.tombstones = sortedRecord(state.tombstones)
  const serialized = canonicalJson(state, 2)
  return { state, serialized, preview }
}
