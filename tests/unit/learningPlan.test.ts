import { practiceSets } from '../../src/data/practiceSets'
import type { CoachAnswer } from '../../src/domain/coachAnswer'
import {
  buildActionBaseline, buildLearningPlan, buildWeeklyLearningSummary, markPlanItemStarted,
  measureActionOutcome, reconcileLearningPlan, resolveCoachActions, togglePlanItem,
} from '../../src/domain/learningPlan'
import type { LearningSnapshot } from '../../src/domain/learningAssistant'
import type { Attempt } from '../../src/domain/models'
import type { WritingAssessmentReport } from '../../src/domain/writingAssessment'

const snapshot: LearningSnapshot = {
  reading: { attemptCount: 3, averageBand: 6, bestBand: 6.5, focusMinutes: 60, trend: 'improving', recent: [], weakestType: { type: 'multiple-choice', correct: 2, total: 6, percentage: 33 }, openErrorCount: 4 },
  writing: { reportCount: 0, latestBand: null, latestSummary: null, latestPriority: null, latestReportId: null, trend: 'insufficient', criterionAverages: [], criterionDeltas: [], repeatedPriorities: [], evidenceCount: 0 },
}

const answer: CoachAnswer = {
  schemaVersion: 1,
  conclusion: { text: '先练选择题', confidence: 'high', evidenceIds: ['reading.weakest_type'] }, facts: [], inferences: [],
  actions: [
    { id: 'practice', title: '开始专项', reason: '当前正确率最低', kind: 'practice' },
    { id: 'errors', title: '复盘错题', reason: '巩固错误', kind: 'errors' },
  ],
}

function attempt(id: string, submittedAt: string, correct: number): Attempt {
  return {
    id, testId: 'shade-networks', answers: {}, submittedAt, durationSeconds: 600, submissionReason: 'manual',
    score: { correct, total: 5, percentage: correct * 20, normalizedRaw40: correct * 8, approximateBand: 6, scoringVersion: 'reading-v2', items: Array.from({ length: 5 }, (_, index) => ({
      questionId: `${id}-${index}`, questionType: 'multiple-choice' as const, isCorrect: index < correct,
      givenAnswer: [], acceptedAnswers: [], explanation: '', sourceRef: { sectionIndex: 0, paragraphIndex: 0 },
    })) },
  }
}

describe('learning actions and plans', () => {
  it('resolves only local practice and error routes', () => {
    const actions = resolveCoachActions(answer, snapshot, practiceSets, [])
    expect(actions[0]!.to).toMatch(/^\/practice\//)
    expect(practiceSets.some(({ id }) => actions[0]!.to.endsWith(id))).toBe(true)
    expect(actions[1]!.to).toBe('/errors?type=multiple-choice&state=learning')
  })

  it('deep-links report evidence and resolves a concrete next writing task', () => {
    const report: WritingAssessmentReport = {
      id: 'report-1', taskId: 'academic-task-2-library-balance', taskType: 'task-2', essay: 'Evidence sentence.', wordCount: 2,
      overallBand: 6, summary: 'Summary', criteria: [], strengths: [], priorities: [],
      evidence: [{ criterion: 'task-response', quote: 'Evidence sentence.', observation: 'Observation', revision: 'Revision' }],
      model: 'fixture', promptVersion: 'writing-v1', generatedAt: '2026-08-12T08:00:00.000Z',
    }
    const reportAction = resolveCoachActions({ ...answer, actions: [{ id: 'report', title: '查看证据', reason: '回到原文', kind: 'writing', targetId: 'report-1' }] }, snapshot, practiceSets, [report])[0]!
    const taskAction = resolveCoachActions({ ...answer, actions: [{ id: 'task', title: '开始下一题', reason: '继续练习', kind: 'writing', targetId: 'academic-task-2-library-balance' }] }, snapshot, practiceSets, [report])[0]!
    expect(reportAction.to).toBe('/writing/report/report-1#evidence-1')
    expect(taskAction.to).toBe('/writing?task=academic-task-2-library-balance')
  })

  it('measures only attempts after action creation and labels small samples', () => {
    const before = attempt('before', '2026-08-11T00:00:00.000Z', 1)
    const after = attempt('after', '2026-08-13T00:00:00.000Z', 4)
    const createdAt = '2026-08-12T00:00:00.000Z'
    const baseline = buildActionBaseline('multiple-choice', [before, after], createdAt)
    const outcome = measureActionOutcome({ createdAt, questionType: 'multiple-choice', baseline }, [before, after])
    expect(baseline.percentage).toBe(20)
    expect(outcome).toMatchObject({ status: 'measured', currentPercentage: 80, delta: 60, sampleSize: 5 })
  })

  it('creates and toggles a persistent-ready today/week plan', () => {
    const plan = buildLearningPlan(snapshot, practiceSets, [], [], new Date('2026-08-12T08:00:00.000Z'))
    expect(plan.items.some(({ horizon }) => horizon === 'today')).toBe(true)
    expect(plan.items.some(({ horizon }) => horizon === 'week')).toBe(true)
    const toggled = togglePlanItem(plan, plan.items[0]!.id, new Date('2026-08-12T09:00:00.000Z'))
    expect(toggled.items[0]).toMatchObject({ status: 'completed', completedAt: '2026-08-12T09:00:00.000Z' })
    expect(plan.items.map(({ priority }) => priority)).toEqual(expect.arrayContaining(['high', 'medium']))
  })

  it('tracks an opened recommendation, completes it from a matching attempt and creates the next round', () => {
    const created = new Date('2026-08-12T08:00:00.000Z')
    const plan = buildLearningPlan(snapshot, practiceSets, [], [], created)
    const practice = plan.items.find(({ kind }) => kind === 'practice')!
    const started = markPlanItemStarted(plan, practice.id, new Date('2026-08-12T08:05:00.000Z'))
    expect(started.items.find(({ id }) => id === practice.id)).toMatchObject({ status: 'started', startedAt: '2026-08-12T08:05:00.000Z' })

    const completedAttempt = { ...attempt('completed', '2026-08-12T09:00:00.000Z', 4), testId: practice.targetId! }
    const reconciled = reconcileLearningPlan(started, snapshot, practiceSets, [], [completedAttempt], new Date('2026-08-12T09:05:00.000Z'))
    expect(reconciled.items.find(({ id }) => id === practice.id)?.status).toBe('completed')
    expect(reconciled.items.some(({ kind, status, id }) => kind === 'practice' && status === 'pending' && id !== practice.id)).toBe(true)
    expect(reconciled.cycle).toBe(2)
  })

  it('summarizes the current week and compares it with the previous week', () => {
    const plan = buildLearningPlan(snapshot, practiceSets, [], [], new Date('2026-08-10T08:00:00.000Z'))
    const completed = togglePlanItem(plan, plan.items[0]!.id, new Date('2026-08-12T09:00:00.000Z'))
    const summary = buildWeeklyLearningSummary(completed, [
      attempt('previous', '2026-08-07T09:00:00.000Z', 2),
      attempt('current', '2026-08-12T09:00:00.000Z', 4),
    ], [], new Date('2026-08-12T12:00:00.000Z'))
    expect(summary).toMatchObject({ readingAttempts: 1, completedActions: 1, accuracyDelta: 40 })
    expect(summary.narrative).toContain('本周完成 1 次阅读练习')
  })
})
