import { buildLearningPlan } from '../../src/domain/learningPlan'
import type { LearningSnapshot } from '../../src/domain/learningAssistant'
import { createLearningPlanRepository } from '../../src/storage/learningPlanRepository'

const snapshot: LearningSnapshot = {
  reading: { attemptCount: 0, averageBand: 0, bestBand: 0, focusMinutes: 0, trend: 'insufficient', recent: [], weakestType: null, openErrorCount: 0 },
  writing: { reportCount: 0, latestBand: null, latestPriority: null, latestReportId: null, trend: 'insufficient', criterionAverages: [], criterionDeltas: [], repeatedPriorities: [], evidenceCount: 0 },
}

describe('learning plan repository', () => {
  beforeEach(() => localStorage.clear())

  it('persists plans and tolerates corrupt storage', () => {
    const repository = createLearningPlanRepository(localStorage)
    const plan = buildLearningPlan(snapshot, [], [], [], new Date('2026-08-12T00:00:00.000Z'))
    repository.save(plan)
    expect(repository.get()).toEqual(plan)
    localStorage.setItem('ielts-pilot:learning-plan:v1', '{broken')
    expect(repository.get()).toBeNull()
  })
})
