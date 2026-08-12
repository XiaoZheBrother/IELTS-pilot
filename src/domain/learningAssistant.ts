import { deriveReadingAnalytics, type TypeAccuracy } from './analytics'
import type { Attempt } from './models'
import { questionTypeLabels } from './questionLabels'
import type { WritingAssessmentReport } from './writingAssessment'

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
    latestPriority: string | null
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
  const latestWriting = [...writingReports].sort((left, right) => Date.parse(right.generatedAt) - Date.parse(left.generatedAt))[0]
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
      latestPriority: latestWriting?.priorities[0] ?? null,
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
  const system = '你是 IELTS Pilot，一名基于本地学习数据提供建议的 IELTS 学习助手。必须区分已给出的事实与建议；关键判断要引用 LearningSnapshot 中的数字作为轻量证据；样本不足时明确说明；不能声称这是官方 IELTS 成绩，也不能编造用户未提供的数据。回答使用简体中文，先给结论，再给最多三条可执行建议，保持简洁。'
  const payload = {
    LearningSnapshot: snapshot,
    recentConversation: boundedHistory(history),
    question: question.trim().slice(0, 2_000),
  }
  return [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify(payload) },
  ]
}
