import type { LearningPlan } from '../domain/learningPlan'

export const LEARNING_PLAN_STORAGE_KEY = 'ielts-pilot:learning-plan:v1'

export interface LearningPlanRepository {
  get: () => LearningPlan | null
  save: (plan: LearningPlan) => void
  clear: () => void
  inspectBackup: (value: unknown) => { ok: true; items: number } | { ok: false; error: string }
  importBackup: (value: unknown) => { ok: true; items: number } | { ok: false; error: string }
}

function normalizePlan(value: unknown): LearningPlan | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = value as Partial<LearningPlan>
  const valid = candidate.version === 1 && typeof candidate.id === 'string'
    && typeof candidate.createdAt === 'string' && Number.isFinite(Date.parse(candidate.createdAt))
    && typeof candidate.updatedAt === 'string' && Number.isFinite(Date.parse(candidate.updatedAt))
    && Array.isArray(candidate.items)
  if (!valid) return null
  const items = candidate.items!.map((item) => ({
    ...item,
    priority: item.priority === 'high' || item.priority === 'low' ? item.priority : 'medium' as const,
    status: item.status === 'started' || item.status === 'completed' ? item.status : 'pending' as const,
  }))
  return { ...candidate as LearningPlan, cycle: Number.isInteger(candidate.cycle) && Number(candidate.cycle) > 0 ? Number(candidate.cycle) : 1, items }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function createLearningPlanRepository(storage: Storage): LearningPlanRepository {
  return {
    get() {
      const value = storage.getItem(LEARNING_PLAN_STORAGE_KEY)
      if (!value) return null
      try {
        const parsed = JSON.parse(value) as unknown
        const plan = normalizePlan(parsed)
        return plan ? clone(plan) : null
      } catch { return null }
    },
    save(plan) {
      const normalized = normalizePlan(plan)
      if (!normalized) throw new Error('学习计划格式无效。')
      storage.setItem(LEARNING_PLAN_STORAGE_KEY, JSON.stringify(normalized))
    },
    clear() { storage.removeItem(LEARNING_PLAN_STORAGE_KEY) },
    inspectBackup(value) {
      if (value === null) return { ok: true, items: 0 }
      const plan = normalizePlan(value)
      return plan ? { ok: true, items: plan.items.length } : { ok: false, error: '学习计划备份格式无效或已经损坏。' }
    },
    importBackup(value) {
      if (value === null) { storage.removeItem(LEARNING_PLAN_STORAGE_KEY); return { ok: true, items: 0 } }
      const plan = normalizePlan(value)
      if (!plan) return { ok: false, error: '学习计划备份格式无效或已经损坏。' }
      storage.setItem(LEARNING_PLAN_STORAGE_KEY, JSON.stringify(plan))
      return { ok: true, items: plan.items.length }
    },
  }
}

export function createBrowserLearningPlanRepository(): LearningPlanRepository {
  return createLearningPlanRepository(window.localStorage)
}
