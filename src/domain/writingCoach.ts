import type { WritingAssessmentReport, WritingCriterionId, WritingTask } from './writingAssessment'

const CRITERION_LABELS: Record<WritingCriterionId, string> = {
  'task-response': '任务回应',
  'coherence-cohesion': '连贯与衔接',
  'lexical-resource': '词汇资源',
  'grammatical-range-accuracy': '语法多样性与准确性',
}

export interface WritingTaskRecommendation {
  taskId: string
  title: string
  reason: string
  criterion: WritingCriterionId
  to: string
  estimatedMinutes: number
}

export interface RewriteExercise {
  reportId: string
  criterion: WritingCriterionId
  instruction: string
  sourceQuote: string
  observation: string
  suggestedRevision: string
  evidenceHref: string
}

export function recommendNextWritingTask(
  reports: WritingAssessmentReport[],
  tasks: WritingTask[],
): WritingTaskRecommendation | null {
  const latest = [...reports].sort((left, right) => Date.parse(right.generatedAt) - Date.parse(left.generatedAt))[0]
  const weakest = [...(latest?.criteria ?? [])].sort((left, right) => left.band - right.band)[0]
  if (!latest || !weakest) return null
  const targetType = weakest.criterion === 'task-response' ? latest.taskType : latest.taskType === 'task-1' ? 'task-2' : 'task-1'
  const task = tasks.find(({ id }) => id === latest.taskId && targetType === latest.taskType)
    ?? tasks.find(({ type }) => type === targetType)
    ?? tasks[0]
  if (!task) return null
  return {
    taskId: task.id,
    title: `下一篇：${task.title}`,
    reason: `${CRITERION_LABELS[weakest.criterion]}是最近报告中分数最低的维度（辅助 Band ${weakest.band.toFixed(1)}）。`,
    criterion: weakest.criterion,
    to: `/writing?task=${encodeURIComponent(task.id)}`,
    estimatedMinutes: task.recommendedMinutes,
  }
}

export function buildRewriteExercise(report: WritingAssessmentReport | null): RewriteExercise | null {
  const evidence = report?.evidence[0]
  if (!report || !evidence) return null
  return {
    reportId: report.id,
    criterion: evidence.criterion,
    instruction: `保留原意，针对“${evidence.observation}”重写这句话，并比较建议版本。`,
    sourceQuote: evidence.quote,
    observation: evidence.observation,
    suggestedRevision: evidence.revision,
    evidenceHref: `/writing/report/${encodeURIComponent(report.id)}#evidence-1`,
  }
}
