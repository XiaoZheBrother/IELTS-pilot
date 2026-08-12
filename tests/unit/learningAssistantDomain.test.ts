import { buildAssistantMessages, buildCoachOverview, buildLearningSnapshot } from '../../src/domain/learningAssistant'
import type { Attempt } from '../../src/domain/models'
import type { WritingAssessmentReport } from '../../src/domain/writingAssessment'

function attempt(id: string, submittedAt: string, band: number, correct: number): Attempt {
  const items = Array.from({ length: 5 }, (_, index) => ({
    questionId: `${id}-q${index + 1}`,
    questionType: 'matching-headings' as const,
    isCorrect: index < correct,
    givenAnswer: [index < correct ? 'A' : 'B'],
    acceptedAnswers: ['A'],
    explanation: 'Local evidence.',
    sourceRef: { sectionIndex: 0, paragraphIndex: 0 },
  }))
  return {
    id, testId: 'fixture-set', mode: 'practice', answers: {}, submittedAt, durationSeconds: 1_200, submissionReason: 'manual',
    score: {
      correct, total: 5, percentage: correct * 20, normalizedRaw40: correct * 8, approximateBand: band,
      scoringVersion: 'reading-v2', items,
    },
  }
}

const writingReport: WritingAssessmentReport = {
  id: 'writing-1', taskId: 'task-1', taskType: 'task-2', essay: 'PRIVATE ESSAY CONTENT MUST NOT LEAVE THE DEVICE.',
  wordCount: 8, overallBand: 6.5, summary: 'A focused response.',
  criteria: [
    { criterion: 'task-response', band: 6.5, rationale: 'Clear.' },
    { criterion: 'coherence-cohesion', band: 6.5, rationale: 'Clear.' },
    { criterion: 'lexical-resource', band: 6.5, rationale: 'Clear.' },
    { criterion: 'grammatical-range-accuracy', band: 6.5, rationale: 'Clear.' },
  ],
  strengths: ['Clear position'], priorities: ['Improve paragraph links'], evidence: [],
  model: 'fixture', promptVersion: 'writing-v1', generatedAt: '2026-08-12T04:00:00.000Z',
}

describe('learning assistant domain', () => {
  it('is honest when there is no evidence', () => {
    const overview = buildCoachOverview(buildLearningSnapshot([], [], []))
    expect(overview.map(({ confidence }) => confidence)).toContain('insufficient')
    expect(overview.map(({ body }) => body).join('')).toContain('不能判断')
  })

  it('identifies a reliable weak type and exposes the evidence threshold', () => {
    const attempts = [
      attempt('a1', '2026-08-10T01:00:00.000Z', 5.5, 1),
      attempt('a2', '2026-08-11T01:00:00.000Z', 6, 2),
      attempt('a3', '2026-08-12T01:00:00.000Z', 6.5, 3),
    ]
    const overview = buildCoachOverview(buildLearningSnapshot(attempts, ['a1:a1-q2'], []))
    const problem = overview.find(({ id }) => id === 'problem')!
    expect(problem.confidence).toBe('high')
    expect(problem.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: '题型正确率', value: '40%' }),
      expect.objectContaining({ label: '样本', value: '15 题' }),
    ]))
  })

  it('builds a bounded provider prompt without sending raw essays', () => {
    const snapshot = buildLearningSnapshot([attempt('a1', '2026-08-12T01:00:00.000Z', 6.5, 3)], [], [writingReport])
    const messages = buildAssistantMessages(
      snapshot,
      '请分析下一步。'.repeat(300),
      Array.from({ length: 10 }, (_, index) => ({ role: index % 2 ? 'assistant' as const : 'user' as const, content: `history-${index}` })),
    )
    const serialized = JSON.stringify(messages)
    expect(messages).toHaveLength(2)
    expect(messages[1]!.content.length).toBeLessThan(12_000)
    expect(serialized).toContain('Improve paragraph links')
    expect(serialized).not.toContain(writingReport.essay)
    expect(serialized.match(/history-/g)).toHaveLength(6)
  })
})
