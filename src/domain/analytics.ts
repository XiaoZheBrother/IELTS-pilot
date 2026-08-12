import type { Attempt, QuestionType, ReadingItemResult } from './models'

export interface TypeAccuracy {
  type: QuestionType
  correct: number
  total: number
  percentage: number
}

export interface ReadingError extends ReadingItemResult {
  attemptId: string
  testId: string
  submittedAt: string
}

export interface ReadingAnalytics {
  attemptCount: number
  averageBand: number
  bestBand: number
  totalDurationSeconds: number
  recentTrend: Array<{ attemptId: string; submittedAt: string; percentage: number; band: number }>
  typeAccuracy: TypeAccuracy[]
  errors: ReadingError[]
}

export function deriveReadingAnalytics(attempts: Attempt[]): ReadingAnalytics {
  const attemptCount = attempts.length
  const bands = attempts.map(({ score }) => score.approximateBand)
  const typeMap = new Map<QuestionType, { correct: number; total: number }>()
  const errors: ReadingError[] = []

  attempts.forEach((attempt) => attempt.score.items.forEach((item) => {
    const stat = typeMap.get(item.questionType) ?? { correct: 0, total: 0 }
    stat.total += 1
    if (item.isCorrect) stat.correct += 1
    else errors.push({ ...item, attemptId: attempt.id, testId: attempt.testId, submittedAt: attempt.submittedAt })
    typeMap.set(item.questionType, stat)
  }))

  return {
    attemptCount,
    averageBand: attemptCount ? Math.round((bands.reduce((sum, band) => sum + band, 0) / attemptCount) * 10) / 10 : 0,
    bestBand: bands.length ? Math.max(...bands) : 0,
    totalDurationSeconds: attempts.reduce((sum, attempt) => sum + attempt.durationSeconds, 0),
    recentTrend: [...attempts].sort((a, b) => Date.parse(a.submittedAt) - Date.parse(b.submittedAt)).slice(-5).map((attempt) => ({ attemptId: attempt.id, submittedAt: attempt.submittedAt, percentage: attempt.score.percentage, band: attempt.score.approximateBand })),
    typeAccuracy: [...typeMap.entries()].map(([type, stat]) => ({ type, ...stat, percentage: Math.round((stat.correct / stat.total) * 100) })).sort((a, b) => a.type.localeCompare(b.type)),
    errors,
  }
}

