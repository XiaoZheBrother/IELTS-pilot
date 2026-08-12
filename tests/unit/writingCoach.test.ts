import { writingTasks } from '../../src/data/writingTasks'
import { buildRewriteExercise, recommendNextWritingTask } from '../../src/domain/writingCoach'
import type { WritingAssessmentReport } from '../../src/domain/writingAssessment'

const report: WritingAssessmentReport = {
  id: 'report-1', taskId: 'academic-task-2-library-balance', taskType: 'task-2', essay: 'Libraries support learners.', wordCount: 4,
  overallBand: 6, summary: '立场清晰，但例证展开不足。',
  criteria: [
    { criterion: 'task-response', band: 5.5, rationale: 'Examples need development.' },
    { criterion: 'coherence-cohesion', band: 6, rationale: 'Logical.' },
    { criterion: 'lexical-resource', band: 6.5, rationale: 'Suitable.' },
    { criterion: 'grammatical-range-accuracy', band: 6, rationale: 'Mostly accurate.' },
  ], strengths: ['Clear position'], priorities: ['Develop examples'],
  evidence: [{ criterion: 'task-response', quote: 'Libraries support learners.', observation: 'The claim lacks a concrete example.', revision: 'Libraries support learners by providing quiet study space and free research databases.' }],
  model: 'fixture', promptVersion: 'writing-v1', generatedAt: '2026-08-12T08:00:00.000Z',
}

describe('writing coach', () => {
  it('recommends a concrete next task from the weakest writing criterion', () => {
    const recommendation = recommendNextWritingTask([report], writingTasks)
    expect(recommendation).toMatchObject({ taskId: 'academic-task-2-library-balance', criterion: 'task-response' })
    expect(recommendation?.to).toBe('/writing?task=academic-task-2-library-balance')
    expect(recommendation?.reason).toContain('任务回应')
  })

  it('builds a local rewrite exercise with a deep link to exact report evidence', () => {
    const exercise = buildRewriteExercise(report)
    expect(exercise).toMatchObject({ reportId: 'report-1', sourceQuote: 'Libraries support learners.' })
    expect(exercise?.evidenceHref).toBe('/writing/report/report-1#evidence-1')
    expect(exercise?.suggestedRevision).toContain('quiet study space')
  })
})
