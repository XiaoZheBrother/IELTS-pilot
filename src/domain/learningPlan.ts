import type { CoachAnswer } from './coachAnswer'
import type { LearningSnapshot } from './learningAssistant'
import type { Attempt, PracticeSet, QuestionType } from './models'
import { questionTypeLabels } from './questionLabels'
import type { WritingAssessmentReport } from './writingAssessment'
import { writingTasks } from '../data/writingTasks'

export type LearningActionKind = 'practice' | 'errors' | 'writing' | 'plan'
export type LearningPlanHorizon = 'today' | 'week'
export type LearningPlanStatus = 'pending' | 'started' | 'completed'
export type LearningPlanPriority = 'high' | 'medium' | 'low'

export interface ResolvedLearningAction {
  id: string
  title: string
  reason: string
  kind: LearningActionKind
  to: string
  estimatedMinutes: number
  questionType?: QuestionType
  targetId?: string
  sourceEvidenceIds: string[]
}

export interface ActionBaseline {
  questionType: QuestionType
  percentage: number | null
  sampleSize: number
  capturedAt: string
}

export interface ActionOutcome {
  status: 'waiting' | 'insufficient' | 'measured'
  baselinePercentage: number | null
  currentPercentage: number | null
  delta: number | null
  sampleSize: number
  label: string
}

export interface LearningPlanItem extends ResolvedLearningAction {
  horizon: LearningPlanHorizon
  status: LearningPlanStatus
  priority: LearningPlanPriority
  createdAt: string
  startedAt?: string
  completedAt?: string
  baseline?: ActionBaseline
}

export interface LearningPlan {
  version: 1
  id: string
  cycle: number
  createdAt: string
  updatedAt: string
  items: LearningPlanItem[]
}

export interface WeeklyLearningSummary {
  weekStartedAt: string
  readingAttempts: number
  writingReports: number
  completedActions: number
  focusMinutes: number
  accuracy: number | null
  accuracyDelta: number | null
  narrative: string
}

function encoded(value: string): string {
  return encodeURIComponent(value)
}

function bestMatchingSet(sets: PracticeSet[], questionType: QuestionType | undefined, targetId?: string): PracticeSet | null {
  const direct = targetId ? sets.find(({ id }) => id === targetId) : undefined
  if (direct) return direct
  return [...sets].sort((left, right) => {
    const leftCount = questionType ? left.questions.filter(({ type }) => type === questionType).length : left.questions.length
    const rightCount = questionType ? right.questions.filter(({ type }) => type === questionType).length : right.questions.length
    return rightCount - leftCount || left.durationMinutes - right.durationMinutes || left.id.localeCompare(right.id)
  }).find((set) => !questionType || set.questions.some(({ type }) => type === questionType)) ?? sets[0] ?? null
}

function latestReport(reports: WritingAssessmentReport[], targetId?: string): WritingAssessmentReport | null {
  const direct = targetId ? reports.find(({ id }) => id === targetId) : undefined
  return direct ?? [...reports].sort((left, right) => Date.parse(right.generatedAt) - Date.parse(left.generatedAt))[0] ?? null
}

export function resolveCoachActions(
  answer: CoachAnswer,
  snapshot: LearningSnapshot,
  sets: PracticeSet[],
  reports: WritingAssessmentReport[],
): ResolvedLearningAction[] {
  const weakType = snapshot.reading.weakestType?.type
  return answer.actions.flatMap((action): ResolvedLearningAction[] => {
    if (action.kind === 'practice') {
      const set = bestMatchingSet(sets, weakType, action.targetId)
      if (!set) return []
      return [{
        ...action,
        kind: 'practice',
        title: action.title || `开始${weakType ? questionTypeLabels[weakType] : '阅读'}练习`,
        to: `/practice/${encoded(set.id)}`,
        estimatedMinutes: set.durationMinutes,
        ...(weakType ? { questionType: weakType } : {}),
        targetId: set.id,
        sourceEvidenceIds: answer.conclusion.evidenceIds,
      }]
    }
    if (action.kind === 'errors') return [{
      ...action,
      kind: 'errors',
      to: weakType ? `/errors?type=${encoded(weakType)}&state=learning` : '/errors?state=learning',
      estimatedMinutes: 12,
      ...(weakType ? { questionType: weakType } : {}),
      sourceEvidenceIds: answer.conclusion.evidenceIds,
    }]
    if (action.kind === 'writing') {
      const directReport = action.targetId ? reports.find(({ id }) => id === action.targetId) : undefined
      const directTask = action.targetId ? writingTasks.find(({ id }) => id === action.targetId) : undefined
      const report = directReport ?? (!directTask ? latestReport(reports) : null)
      return [{
        ...action,
        kind: 'writing',
        to: directTask ? `/writing?task=${encoded(directTask.id)}` : report
          ? `/writing/report/${encoded(report.id)}${report.evidence.length ? '#evidence-1' : ''}` : '/writing',
        estimatedMinutes: directTask?.recommendedMinutes ?? 20,
        ...(directTask ? { targetId: directTask.id } : report ? { targetId: report.id } : {}),
        sourceEvidenceIds: answer.conclusion.evidenceIds,
      }]
    }
    return [{ ...action, kind: 'plan', to: '#learning-plan', estimatedMinutes: 5, sourceEvidenceIds: answer.conclusion.evidenceIds }]
  }).slice(0, 3)
}

function accuracy(attempts: Attempt[], questionType: QuestionType): { percentage: number | null; sampleSize: number } {
  const items = attempts.flatMap(({ score }) => score.items).filter((item) => item.questionType === questionType)
  if (!items.length) return { percentage: null, sampleSize: 0 }
  return { percentage: Math.round(items.filter(({ isCorrect }) => isCorrect).length / items.length * 100), sampleSize: items.length }
}

export function buildActionBaseline(questionType: QuestionType, attempts: Attempt[], capturedAt: string): ActionBaseline {
  const result = accuracy(attempts.filter(({ submittedAt }) => Date.parse(submittedAt) <= Date.parse(capturedAt)), questionType)
  return { questionType, ...result, capturedAt: new Date(capturedAt).toISOString() }
}

export function measureActionOutcome(action: Pick<LearningPlanItem, 'createdAt' | 'questionType' | 'baseline'>, attempts: Attempt[]): ActionOutcome {
  if (!action.questionType) return { status: 'waiting', baselinePercentage: null, currentPercentage: null, delta: null, sampleSize: 0, label: '完成行动后再比较结果' }
  const recent = attempts.filter(({ submittedAt }) => Date.parse(submittedAt) > Date.parse(action.createdAt))
  const current = accuracy(recent, action.questionType)
  const baselinePercentage = action.baseline?.percentage ?? null
  if (!current.sampleSize) return { status: 'waiting', baselinePercentage, currentPercentage: null, delta: null, sampleSize: 0, label: '等待新的同题型练习' }
  if (current.sampleSize < 5 || baselinePercentage === null) return {
    status: 'insufficient', baselinePercentage, currentPercentage: current.percentage, delta: null,
    sampleSize: current.sampleSize, label: `已有 ${current.sampleSize} 题，样本不足（至少 5 题）`,
  }
  const delta = (current.percentage ?? 0) - baselinePercentage
  return {
    status: 'measured', baselinePercentage, currentPercentage: current.percentage, delta,
    sampleSize: current.sampleSize, label: `${delta >= 0 ? '+' : ''}${delta} 个百分点`,
  }
}

function planAction(id: string, title: string, reason: string, kind: LearningActionKind): CoachAnswer['actions'][number] {
  return { id, title, reason, kind }
}

export function buildLearningPlan(
  snapshot: LearningSnapshot,
  sets: PracticeSet[],
  reports: WritingAssessmentReport[],
  attempts: Attempt[],
  now: Date = new Date(),
): LearningPlan {
  const createdAt = now.toISOString()
  const weak = snapshot.reading.weakestType
  const answer: CoachAnswer = {
    schemaVersion: 1,
    conclusion: {
      text: weak ? `优先巩固${questionTypeLabels[weak.type]}。` : '先建立可比较的学习样本。',
      confidence: weak ? 'high' : 'insufficient',
      evidenceIds: weak ? ['reading.weakest_type'] : ['reading.attempt_count'],
    },
    facts: [], inferences: [],
    actions: [
      planAction('today-practice', weak ? `完成一次${questionTypeLabels[weak.type]}专项` : '完成一次计时阅读', '形成一份新的可比较样本', 'practice'),
      planAction('today-errors', '复盘当前错题', '把错误转成下一次可执行练习', 'errors'),
      planAction('week-writing', reports.length ? '复盘最近写作报告' : '完成一次写作评估', '跟踪写作维度和重复优先项', 'writing'),
    ],
  }
  const resolved = resolveCoachActions(answer, snapshot, sets, reports)
  const items: LearningPlanItem[] = resolved.map((action, index) => ({
    ...action,
    id: action.id,
    horizon: index < 2 ? 'today' : 'week',
    status: 'pending',
    priority: action.kind === 'practice'
      ? weak ? 'high' : 'medium'
      : action.kind === 'errors'
        ? snapshot.reading.openErrorCount >= 3 ? 'high' : 'medium'
        : 'medium',
    createdAt,
    ...(action.questionType ? { baseline: buildActionBaseline(action.questionType, attempts, createdAt) } : {}),
  }))
  return { version: 1, id: `plan-${createdAt.slice(0, 10)}`, cycle: 1, createdAt, updatedAt: createdAt, items }
}

export function markPlanItemStarted(plan: LearningPlan, itemId: string, now: Date = new Date()): LearningPlan {
  const updatedAt = now.toISOString()
  return {
    ...plan,
    updatedAt,
    items: plan.items.map((item) => item.id === itemId && item.status === 'pending'
      ? { ...item, status: 'started', startedAt: updatedAt }
      : item),
  }
}

export function togglePlanItem(plan: LearningPlan, itemId: string, now: Date = new Date()): LearningPlan {
  const updatedAt = now.toISOString()
  return {
    ...plan,
    updatedAt,
    items: plan.items.map((item) => item.id === itemId
      ? item.status === 'completed'
        ? { ...item, status: 'pending', startedAt: undefined, completedAt: undefined }
        : { ...item, status: 'completed', completedAt: updatedAt }
      : item),
  }
}

export function refreshLearningPlan(
  current: LearningPlan,
  snapshot: LearningSnapshot,
  sets: PracticeSet[],
  reports: WritingAssessmentReport[],
  attempts: Attempt[],
  now: Date = new Date(),
): LearningPlan {
  const next = buildLearningPlan(snapshot, sets, reports, attempts, now)
  const previous = new Map(current.items.map((item) => [`${item.kind}:${item.questionType ?? item.targetId ?? item.id}`, item]))
  next.items = next.items.map((item) => {
    const match = previous.get(`${item.kind}:${item.questionType ?? item.targetId ?? item.id}`)
    return match ? {
      ...item,
      status: match.status,
      createdAt: match.createdAt,
      ...(match.startedAt ? { startedAt: match.startedAt } : {}),
      ...(match.completedAt ? { completedAt: match.completedAt } : {}),
      ...(match.baseline ? { baseline: match.baseline } : {}),
    } : item
  })
  return { ...next, id: current.id, cycle: current.cycle || 1, createdAt: current.createdAt }
}

function itemCompletedByActivity(item: LearningPlanItem, attempts: Attempt[], reports: WritingAssessmentReport[]): boolean {
  const after = Date.parse(item.startedAt ?? item.createdAt)
  if (item.kind === 'practice') return attempts.some((attempt) => Date.parse(attempt.submittedAt) > after
    && (!item.targetId || attempt.testId === item.targetId))
  if (item.kind === 'writing') return reports.some((report) => Date.parse(report.generatedAt) > after
    && (!item.targetId || report.taskId === item.targetId))
  return false
}

export function reconcileLearningPlan(
  current: LearningPlan,
  snapshot: LearningSnapshot,
  sets: PracticeSet[],
  reports: WritingAssessmentReport[],
  attempts: Attempt[],
  now: Date = new Date(),
): LearningPlan {
  const completedAt = now.toISOString()
  const newlyCompleted: LearningActionKind[] = []
  const items = current.items.map((item) => {
    if (item.status === 'completed' || !itemCompletedByActivity(item, attempts, reports)) return item
    newlyCompleted.push(item.kind)
    return { ...item, status: 'completed' as const, completedAt }
  })
  if (!newlyCompleted.length) return { ...current, items }

  const nextCycle = (current.cycle || 1) + 1
  const generated = buildLearningPlan(snapshot, sets, reports, attempts, now)
  const additions = [...new Set(newlyCompleted)].flatMap((kind) => {
    if (items.some((item) => item.kind === kind && item.status !== 'completed')) return []
    const candidate = generated.items.find((item) => item.kind === kind)
    return candidate ? [{ ...candidate, id: `${candidate.id}-round-${nextCycle}`, horizon: 'today' as const }] : []
  })
  return {
    ...current,
    cycle: nextCycle,
    updatedAt: completedAt,
    items: [...items, ...additions].slice(-12),
  }
}

function startOfWeek(now: Date): Date {
  const result = new Date(now)
  result.setUTCHours(0, 0, 0, 0)
  result.setUTCDate(result.getUTCDate() - ((result.getUTCDay() + 6) % 7))
  return result
}

function attemptAccuracy(attempts: Attempt[]): number | null {
  const totals = attempts.reduce((result, attempt) => ({
    correct: result.correct + attempt.score.correct,
    total: result.total + attempt.score.total,
  }), { correct: 0, total: 0 })
  return totals.total ? Math.round(totals.correct / totals.total * 100) : null
}

export function buildWeeklyLearningSummary(
  plan: LearningPlan,
  attempts: Attempt[],
  reports: WritingAssessmentReport[],
  now: Date = new Date(),
): WeeklyLearningSummary {
  const started = startOfWeek(now)
  const previous = new Date(started)
  previous.setUTCDate(previous.getUTCDate() - 7)
  const currentAttempts = attempts.filter(({ submittedAt }) => Date.parse(submittedAt) >= started.getTime() && Date.parse(submittedAt) <= now.getTime())
  const previousAttempts = attempts.filter(({ submittedAt }) => Date.parse(submittedAt) >= previous.getTime() && Date.parse(submittedAt) < started.getTime())
  const accuracyValue = attemptAccuracy(currentAttempts)
  const previousAccuracy = attemptAccuracy(previousAttempts)
  const accuracyDelta = accuracyValue === null || previousAccuracy === null ? null : accuracyValue - previousAccuracy
  const writingReports = reports.filter(({ generatedAt }) => Date.parse(generatedAt) >= started.getTime() && Date.parse(generatedAt) <= now.getTime()).length
  const completedActions = plan.items.filter(({ completedAt: value }) => value && Date.parse(value) >= started.getTime() && Date.parse(value) <= now.getTime()).length
  const focusMinutes = Math.round(currentAttempts.reduce((sum, attempt) => sum + attempt.durationSeconds, 0) / 60)
  const comparison = accuracyDelta === null ? '还没有足够的前周样本用于比较。'
    : `正确率较前周${accuracyDelta >= 0 ? '提高' : '下降'} ${Math.abs(accuracyDelta)} 个百分点。`
  return {
    weekStartedAt: started.toISOString(), readingAttempts: currentAttempts.length, writingReports,
    completedActions, focusMinutes, accuracy: accuracyValue, accuracyDelta,
    narrative: `本周完成 ${currentAttempts.length} 次阅读练习、${writingReports} 份写作反馈和 ${completedActions} 项计划，累计专注 ${focusMinutes} 分钟。${comparison}`,
  }
}
