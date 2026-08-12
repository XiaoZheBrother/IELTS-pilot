import { practiceSets } from '../../src/data/practiceSets'
import type { CoachAnswer } from '../../src/domain/coachAnswer'
import { buildActionBaseline, buildLearningPlan, measureActionOutcome, resolveCoachActions, togglePlanItem } from '../../src/domain/learningPlan'
import type { LearningSnapshot } from '../../src/domain/learningAssistant'
import type { Attempt } from '../../src/domain/models'

const snapshot: LearningSnapshot = {
  reading: { attemptCount: 3, averageBand: 6, bestBand: 6.5, focusMinutes: 60, trend: 'improving', recent: [], weakestType: { type: 'multiple-choice', correct: 2, total: 6, percentage: 33 }, openErrorCount: 4 },
  writing: { reportCount: 0, latestBand: null, latestPriority: null, latestReportId: null, trend: 'insufficient', criterionAverages: [], criterionDeltas: [], repeatedPriorities: [], evidenceCount: 0 },
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
  })
})
