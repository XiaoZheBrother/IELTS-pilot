import type { LearningPlan } from '../domain/learningPlan'

export const LEARNING_PLAN_STORAGE_KEY = 'ielts-pilot:learning-plan:v1'

export interface LearningPlanRepository {
  get: () => LearningPlan | null
  save: (plan: LearningPlan) => void
  clear: () => void
}

function isPlan(value: unknown): value is LearningPlan {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Partial<LearningPlan>
  return candidate.version === 1 && typeof candidate.id === 'string'
    && typeof candidate.createdAt === 'string' && Number.isFinite(Date.parse(candidate.createdAt))
    && typeof candidate.updatedAt === 'string' && Number.isFinite(Date.parse(candidate.updatedAt))
    && Array.isArray(candidate.items)
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
        return isPlan(parsed) ? clone(parsed) : null
      } catch { return null }
    },
    save(plan) {
      if (!isPlan(plan)) throw new Error('学习计划格式无效。')
      storage.setItem(LEARNING_PLAN_STORAGE_KEY, JSON.stringify(plan))
    },
    clear() { storage.removeItem(LEARNING_PLAN_STORAGE_KEY) },
  }
}

export function createBrowserLearningPlanRepository(): LearningPlanRepository {
  return createLearningPlanRepository(window.localStorage)
}
