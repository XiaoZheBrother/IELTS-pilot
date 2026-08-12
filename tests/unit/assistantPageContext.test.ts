import { practiceSets } from '../../src/data/practiceSets'
import { writingTasks } from '../../src/data/writingTasks'
import { buildAssistantPageContext } from '../../src/domain/assistantPageContext'
import type { Attempt } from '../../src/domain/models'
import type { WritingAssessmentReport } from '../../src/domain/writingAssessment'

const set = practiceSets[0]!
const attempt: Attempt = {
  id: 'attempt-context', testId: set.id, mode: 'practice', answers: { [set.questions[0]!.id]: ['A'] },
  submittedAt: '2026-08-12T02:00:00.000Z', durationSeconds: 900, submissionReason: 'manual',
  score: {
    correct: 0, total: 1, percentage: 0, normalizedRaw40: 0, approximateBand: 2.5, scoringVersion: 'reading-v2',
    items: [{
      questionId: set.questions[0]!.id, questionType: set.questions[0]!.type, isCorrect: false,
      givenAnswer: ['A'], acceptedAnswers: set.questions[0]!.acceptedAnswers,
      explanation: set.questions[0]!.explanation, sourceRef: set.questions[0]!.sourceRef,
    }],
  },
}

const report: WritingAssessmentReport = {
  id: 'report-context', taskId: writingTasks[1]!.id, taskType: writingTasks[1]!.type,
  essay: 'Libraries should combine digital access with quiet study space.', wordCount: 9, overallBand: 6.5,
  summary: '立场明确，但论证仍可更具体。',
  criteria: [
    { criterion: 'task-response', band: 6.5, rationale: 'Position is clear.' },
    { criterion: 'coherence-cohesion', band: 6.5, rationale: 'Progression is logical.' },
    { criterion: 'lexical-resource', band: 6.5, rationale: 'Vocabulary is suitable.' },
    { criterion: 'grammatical-range-accuracy', band: 6.5, rationale: 'Grammar is controlled.' },
  ],
  strengths: ['Clear position'], priorities: ['Add a concrete example'],
  evidence: [{ criterion: 'task-response', quote: 'Libraries should combine digital access', observation: 'The position is explicit.', revision: 'Public libraries should preserve both forms of access.' }],
  model: 'fixture', promptVersion: 'writing-v1', generatedAt: '2026-08-12T03:00:00.000Z',
}

function dependencies() {
  return {
    sets: practiceSets,
    tasks: writingTasks,
    mockSets: (mockId: string) => mockId === 'reading-mock-01' ? practiceSets.slice(0, 3) : [],
    practice: {
      getDraft: (testId: string) => testId === set.id ? {
        testId, answers: { [set.questions[4]!.id]: ['temperature sensors'] }, currentIndex: 4,
        remainingSeconds: 900, updatedAt: '2026-08-12T01:00:00.000Z',
      } : null,
      getAttempt: (attemptId: string) => attemptId === attempt.id ? attempt : null,
    },
    writing: {
      getDraft: (taskId: string) => taskId === writingTasks[1]!.id ? {
        taskId, essay: 'A local draft about public libraries.', elapsedSeconds: 120,
        updatedAt: '2026-08-12T01:30:00.000Z',
      } : null,
      getReport: (reportId: string) => reportId === report.id ? report : null,
    },
  }
}

describe('assistant page context', () => {
  it('loads the complete built-in passage, every question prompt and the active practice answer', () => {
    const context = buildAssistantPageContext({ name: 'practice', params: { testId: set.id }, query: {} }, dependencies())!
    const serialized = JSON.stringify(context.data)

    expect(context).toMatchObject({ kind: 'reading-practice', title: set.title, questionCount: set.questions.length, activeItem: 'Question 5' })
    expect(serialized).toContain(set.passage.sections[0]!.paragraphs[0]!)
    expect(serialized).toContain(set.passage.sections.at(-1)!.paragraphs.at(-1)!)
    set.questions.forEach(({ prompt }) => expect(serialized).toContain(prompt))
    expect(serialized).toContain('temperature sensors')
    expect(serialized).toContain('thermal sensors')
    expect(serialized).toContain(set.questions[4]!.explanation)
    expect(context.evidence.map(({ id }) => id)).toEqual(expect.arrayContaining([
      'context.reading.passage', 'context.reading.questions', 'context.reading.active_question',
      'context.reading.user_answer', 'context.reading.answer_key',
    ]))
  })

  it('loads the active passage and question from a complete reading mock', () => {
    const mockSets = practiceSets.slice(0, 3)
    const activeGlobalIndex = mockSets[0]!.questions.length + 1
    const activeQuestion = mockSets[1]!.questions[1]!
    const deps = dependencies()
    deps.practice.getDraft = (testId: string) => testId === 'mock:reading-mock-01' ? {
      testId, answers: { [activeQuestion.id]: ['TRUE'] }, currentIndex: activeGlobalIndex,
      remainingSeconds: 2_400, updatedAt: '2026-08-12T01:00:00.000Z',
    } : null

    const context = buildAssistantPageContext({ name: 'mock', params: { mockId: 'reading-mock-01' }, query: {} }, deps)!
    const serialized = JSON.stringify(context.data)
    expect(context).toMatchObject({ kind: 'reading-mock', activeItem: `Question ${activeGlobalIndex + 1}` })
    expect(serialized).toContain(mockSets[1]!.passage.title)
    expect(serialized).toContain(activeQuestion.prompt)
    expect(serialized).toContain('TRUE')
  })

  it('loads a result with the submitted answer, accepted answer and local explanation', () => {
    const context = buildAssistantPageContext({ name: 'result', params: { attemptId: attempt.id }, query: {} }, dependencies())!
    const serialized = JSON.stringify(context.data)
    expect(context.kind).toBe('reading-result')
    expect(serialized).toContain('"givenAnswer":["A"]')
    expect(serialized).toContain(JSON.stringify(set.questions[0]!.acceptedAnswers).slice(1, -1))
    expect(serialized).toContain(set.questions[0]!.explanation)
  })

  it('loads the selected writing task and the local draft without putting it into history', () => {
    const task = writingTasks[1]!
    const context = buildAssistantPageContext({ name: 'writing', params: {}, query: { task: task.id } }, dependencies())!
    const serialized = JSON.stringify(context.data)
    expect(context).toMatchObject({ kind: 'writing-draft', title: task.title })
    expect(serialized).toContain(task.prompt)
    expect(serialized).toContain('A local draft about public libraries.')
    expect(context.evidence.map(({ id }) => id)).toEqual(expect.arrayContaining(['context.writing.task', 'context.writing.draft']))
  })

  it('loads a writing report with the submitted manuscript and source-backed feedback', () => {
    const context = buildAssistantPageContext({ name: 'writing-report', params: { reportId: report.id }, query: {} }, dependencies())!
    const serialized = JSON.stringify(context.data)
    expect(context.kind).toBe('writing-report')
    expect(serialized).toContain(report.essay)
    expect(serialized).toContain(report.evidence[0]!.observation)
    expect(serialized).toContain(report.priorities[0]!)
  })

  it('returns no material context on unrelated pages', () => {
    expect(buildAssistantPageContext({ name: 'settings', params: {}, query: {} }, dependencies())).toBeNull()
  })
})
