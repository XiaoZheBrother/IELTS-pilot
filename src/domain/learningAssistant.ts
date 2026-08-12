import { deriveReadingAnalytics, type TypeAccuracy } from './analytics'
import type { Attempt } from './models'
import { questionTypeLabels } from './questionLabels'
import { WRITING_CRITERIA, type WritingAssessmentReport, type WritingCriterionId } from './writingAssessment'
import type { CoachEvidenceEntry } from './coachAnswer'

export const ASSISTANT_PROMPT_VERSION = 'assistant-v2' as const

export type LearningTrend = 'insufficient' | 'improving' | 'stable' | 'declining'
export type CoachConfidence = 'insufficient' | 'medium' | 'high'
export type AssistantConversationRole = 'user' | 'assistant'

export interface AssistantConversationMessage {
  role: AssistantConversationRole
  content: string
}

export interface LearningSnapshot {
  reading: {
    attemptCount: number
    averageBand: number
    bestBand: number
    focusMinutes: number
    trend: LearningTrend
    recent: Array<{ percentage: number; band: number; submittedAt: string }>
    weakestType: TypeAccuracy | null
    openErrorCount: number
  }
  writing: {
    reportCount: number
    latestBand: number | null
    latestSummary: string | null
    latestPriority: string | null
    latestReportId: string | null
    trend: LearningTrend
    criterionAverages: Array<{ criterion: WritingCriterionId; averageBand: number; sampleSize: number }>
    criterionDeltas: Array<{ criterion: WritingCriterionId; delta: number | null }>
    repeatedPriorities: Array<{ text: string; count: number }>
    evidenceCount: number
  }
}

export interface CoachEvidence {
  label: string
  value: string
}

export interface CoachInsight {
  id: 'status' | 'problem' | 'direction'
  title: string
  body: string
  confidence: CoachConfidence
  evidence: CoachEvidence[]
}

export interface AssistantProviderMessage {
  role: 'system' | 'user'
  content: string
}

export function buildEvidenceCatalog(snapshot: LearningSnapshot): CoachEvidenceEntry[] {
  const { reading, writing } = snapshot
  const readingConfidence: CoachConfidence = reading.attemptCount >= 3 ? 'high' : reading.attemptCount ? 'medium' : 'insufficient'
  const entries: CoachEvidenceEntry[] = [
    { id: 'reading.attempt_count', label: '练习记录', value: `${reading.attemptCount} 次`, sampleSize: reading.attemptCount, confidence: readingConfidence },
    { id: 'reading.average_band', label: '平均估算', value: `Band ${reading.averageBand.toFixed(1)}`, sampleSize: reading.attemptCount, confidence: readingConfidence },
    { id: 'reading.best_band', label: '最佳估算', value: `Band ${reading.bestBand.toFixed(1)}`, sampleSize: reading.attemptCount, confidence: readingConfidence },
    { id: 'reading.trend', label: '近期趋势', value: trendLabel(reading.trend), sampleSize: reading.recent.length, confidence: reading.trend === 'insufficient' ? 'insufficient' : 'high' },
    { id: 'reading.open_errors', label: '待巩固错题', value: `${reading.openErrorCount} 题`, sampleSize: reading.openErrorCount, confidence: reading.attemptCount ? 'high' : 'insufficient' },
  ]
  if (reading.weakestType) entries.push({
    id: 'reading.weakest_type', label: '薄弱题型',
    value: `${questionTypeLabels[reading.weakestType.type]} ${reading.weakestType.percentage}%（${reading.weakestType.total} 题）`,
    sampleSize: reading.weakestType.total, confidence: reading.weakestType.total >= 5 ? 'high' : 'insufficient',
  })
  entries.push({ id: 'writing.report_count', label: '写作报告', value: `${writing.reportCount} 份`, sampleSize: writing.reportCount, confidence: writing.reportCount >= 2 ? 'high' : writing.reportCount ? 'medium' : 'insufficient' })
  if (writing.latestBand !== null) entries.push({ id: 'writing.latest_band', label: '最近写作辅助分', value: `Band ${writing.latestBand.toFixed(1)}`, sampleSize: writing.reportCount, confidence: writing.reportCount >= 2 ? 'high' : 'insufficient' })
  entries.push({ id: 'writing.trend', label: '写作趋势', value: trendLabel(writing.trend), sampleSize: writing.reportCount, confidence: writing.trend === 'insufficient' ? 'insufficient' : 'high' })
  writing.criterionAverages.forEach(({ criterion, averageBand, sampleSize }) => entries.push({
    id: `writing.criterion.${criterion}`, label: WRITING_CRITERIA.find(({ id }) => id === criterion)?.label ?? criterion,
    value: `Band ${averageBand.toFixed(1)}`, sampleSize, confidence: sampleSize >= 2 ? 'high' : 'insufficient',
  }))
  if (writing.repeatedPriorities[0]) entries.push({
    id: 'writing.repeated_priority', label: '重复写作优先项', value: writing.repeatedPriorities[0].text,
    sampleSize: writing.repeatedPriorities[0].count, confidence: writing.repeatedPriorities[0].count >= 2 ? 'high' : 'insufficient',
  })
  return entries
}

function deriveTrend(recent: LearningSnapshot['reading']['recent']): LearningTrend {
  if (recent.length < 3) return 'insufficient'
  const change = recent[recent.length - 1]!.band - recent[0]!.band
  if (change >= 0.5) return 'improving'
  if (change <= -0.5) return 'declining'
  return 'stable'
}

function weakestReliableType(values: TypeAccuracy[]): TypeAccuracy | null {
  return [...values]
    .filter(({ total }) => total >= 5)
    .sort((left, right) => left.percentage - right.percentage || right.total - left.total)[0] ?? null
}

export function buildLearningSnapshot(
  attempts: Attempt[],
  masteredErrorKeys: string[],
  writingReports: WritingAssessmentReport[],
): LearningSnapshot {
  const analytics = deriveReadingAnalytics(attempts)
  const mastered = new Set(masteredErrorKeys)
  const recent = analytics.recentTrend.map(({ percentage, band, submittedAt }) => ({ percentage, band, submittedAt }))
  const recentWriting = [...writingReports].sort((left, right) => Date.parse(right.generatedAt) - Date.parse(left.generatedAt)).slice(0, 5)
  const latestWriting = recentWriting[0]
  const previousWriting = recentWriting[1]
  const criterionAverages = WRITING_CRITERIA.flatMap(({ id }): LearningSnapshot['writing']['criterionAverages'] => {
    const values = recentWriting.flatMap(({ criteria }) => criteria.filter(({ criterion }) => criterion === id).map(({ band }) => band))
    return values.length ? [{ criterion: id, averageBand: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10, sampleSize: values.length }] : []
  })
  const criterionDeltas = WRITING_CRITERIA.map(({ id }) => {
    const latest = latestWriting?.criteria.find(({ criterion }) => criterion === id)?.band
    const previous = previousWriting?.criteria.find(({ criterion }) => criterion === id)?.band
    return { criterion: id, delta: latest === undefined || previous === undefined ? null : latest - previous }
  })
  const priorityCounts = new Map<string, number>()
  recentWriting.flatMap(({ priorities }) => priorities.slice(0, 3)).forEach((priority) => {
    const bounded = priority.trim().slice(0, 240)
    if (bounded) priorityCounts.set(bounded, (priorityCounts.get(bounded) ?? 0) + 1)
  })
  const repeatedPriorities = [...priorityCounts.entries()].filter(([, count]) => count >= 2)
    .map(([text, count]) => ({ text, count })).sort((left, right) => right.count - left.count || left.text.localeCompare(right.text)).slice(0, 3)
  const writingTrend: LearningTrend = recentWriting.length < 2 ? 'insufficient'
    : latestWriting!.overallBand - recentWriting[recentWriting.length - 1]!.overallBand >= 0.5 ? 'improving'
      : latestWriting!.overallBand - recentWriting[recentWriting.length - 1]!.overallBand <= -0.5 ? 'declining' : 'stable'
  return {
    reading: {
      attemptCount: analytics.attemptCount,
      averageBand: analytics.averageBand,
      bestBand: analytics.bestBand,
      focusMinutes: Math.round(analytics.totalDurationSeconds / 60),
      trend: deriveTrend(recent),
      recent,
      weakestType: weakestReliableType(analytics.typeAccuracy),
      openErrorCount: analytics.errors.filter(({ attemptId, questionId }) => !mastered.has(`${attemptId}:${questionId}`)).length,
    },
    writing: {
      reportCount: writingReports.length,
      latestBand: latestWriting?.overallBand ?? null,
      latestSummary: latestWriting?.summary.trim().slice(0, 600) ?? null,
      latestPriority: latestWriting?.priorities[0] ?? null,
      latestReportId: latestWriting?.id ?? null,
      trend: writingTrend,
      criterionAverages,
      criterionDeltas,
      repeatedPriorities,
      evidenceCount: recentWriting.reduce((sum, report) => sum + report.evidence.length, 0),
    },
  }
}

function trendLabel(trend: LearningTrend): string {
  if (trend === 'improving') return '上升'
  if (trend === 'declining') return '下降'
  if (trend === 'stable') return '平稳'
  return '待积累'
}

export function buildCoachOverview(snapshot: LearningSnapshot): CoachInsight[] {
  const { reading, writing } = snapshot
  if (!reading.attemptCount) {
    return [
      {
        id: 'status', title: '当前状态', confidence: 'insufficient',
        body: '还没有足够的练习记录，IELTS Pilot 暂时不能判断你的成绩趋势。',
        evidence: [{ label: '练习记录', value: '0 次' }],
      },
      {
        id: 'problem', title: '主要问题', confidence: 'insufficient',
        body: '当前样本不足，不能可靠识别薄弱题型。',
        evidence: [{ label: '可分析题型', value: '0 类' }],
      },
      {
        id: 'direction', title: '提高方向', confidence: 'medium',
        body: '先完成一篇计时练习，建立第一份可比较的学习基线。',
        evidence: [{ label: '下一步', value: '1 次完整练习' }],
      },
    ]
  }

  const weak = reading.weakestType
  const statusEvidence: CoachEvidence[] = [
    { label: '练习记录', value: `${reading.attemptCount} 次` },
    { label: '平均估算', value: `Band ${reading.averageBand.toFixed(1)}` },
    { label: '近期趋势', value: trendLabel(reading.trend) },
  ]
  if (writing.latestBand !== null) statusEvidence.push({ label: '最近写作', value: `Band ${writing.latestBand.toFixed(1)}` })

  const problem: CoachInsight = weak ? {
    id: 'problem', title: '主要问题', confidence: 'high',
    body: `${questionTypeLabels[weak.type]}是当前最明确的薄弱项，建议先处理这类题的定位与干扰项判断。`,
    evidence: [
      { label: '题型正确率', value: `${weak.percentage}%` },
      { label: '样本', value: `${weak.total} 题` },
      { label: '待巩固错题', value: `${reading.openErrorCount} 题` },
    ],
  } : {
    id: 'problem', title: '主要问题', confidence: 'insufficient',
    body: reading.openErrorCount
      ? '已经出现待巩固错题，但各题型样本尚不足 5 题，暂不做薄弱题型排名。'
      : '目前没有足够的单题型样本形成稳定判断。',
    evidence: [
      { label: '判定门槛', value: '每类至少 5 题' },
      { label: '待巩固错题', value: `${reading.openErrorCount} 题` },
    ],
  }

  const directionBody = weak
    ? `下一轮优先完成一次${questionTypeLabels[weak.type]}专项，并在结束后回看仍未掌握的错题。`
    : '继续完成不同题型的计时练习，积累足够样本后再安排针对性强化。'
  return [
    {
      id: 'status', title: '当前状态', confidence: reading.trend === 'insufficient' ? 'medium' : 'high',
      body: `已完成 ${reading.attemptCount} 次练习，累计专注 ${reading.focusMinutes} 分钟，最佳练习估算为 Band ${reading.bestBand.toFixed(1)}。`,
      evidence: statusEvidence,
    },
    problem,
    {
      id: 'direction', title: '提高方向', confidence: weak ? 'high' : 'medium',
      body: directionBody,
      evidence: [
        { label: '优先级', value: weak ? questionTypeLabels[weak.type] : '继续积累样本' },
        { label: '待巩固错题', value: `${reading.openErrorCount} 题` },
      ],
    },
  ]
}

function boundedHistory(messages: AssistantConversationMessage[]): AssistantConversationMessage[] {
  return messages.slice(-6).map(({ role, content }) => ({ role, content: content.trim().slice(0, 1_200) })).filter(({ content }) => content)
}

export function buildAssistantMessages(
  snapshot: LearningSnapshot,
  question: string,
  history: AssistantConversationMessage[] = [],
): AssistantProviderMessage[] {
  const system = `你是 IELTS Pilot，一名基于本地学习数据提供建议的 IELTS 学习助手。提示词版本 ${ASSISTANT_PROMPT_VERSION}。只返回 JSON，不要 Markdown。必须使用 schemaVersion 1；结论、事实和推断只引用 EvidenceCatalog 中存在的 evidenceIds；样本不足时不得声称稳定、确定、一定或保证提分；任何样本下都不得预测分数将稳定到某一 Band，不得使用“有望提分”“最容易看到提分效果”等结果承诺，只能描述证据中已经发生的趋势；不能声称这是官方 IELTS 成绩；最多给三条行动，kind 只能是 practice、errors、writing 或 plan，不得输出 URL。JSON 字段必须是 schemaVersion、conclusion、facts、inferences、actions。conclusion 和 inferences 包含 text、confidence、evidenceIds；facts 包含 text、evidenceIds；actions 包含 id、title、reason、kind 和可选 targetId。使用简体中文。`
  const payload = {
    promptVersion: ASSISTANT_PROMPT_VERSION,
    schemaVersion: 1,
    EvidenceCatalog: buildEvidenceCatalog(snapshot),
    LearningSnapshot: snapshot,
    recentConversation: boundedHistory(history),
    question: question.trim().slice(0, 2_000),
    responseSchema: {
      schemaVersion: 1,
      conclusion: { text: 'string', confidence: 'insufficient|medium|high', evidenceIds: ['reading.attempt_count'] },
      facts: [{ text: 'string', evidenceIds: ['evidence.id'] }],
      inferences: [{ text: 'string', confidence: 'insufficient|medium|high', evidenceIds: ['evidence.id'] }],
      actions: [{ id: 'string', title: 'string', reason: 'string', kind: 'practice|errors|writing|plan', targetId: 'optional string' }],
    },
  }
  return [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify(payload) },
  ]
}
