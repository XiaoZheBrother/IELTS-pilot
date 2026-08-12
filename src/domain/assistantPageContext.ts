import type { CoachEvidenceEntry } from './coachAnswer'
import type { AcceptedAnswer, PracticeSet, ReadingQuestion } from './models'
import type { WritingTask } from './writingAssessment'
import type { PracticeRepository } from '../storage/practiceRepository'
import type { WritingRepository } from '../storage/writingRepository'

export type AssistantPageContextKind = 'reading-practice' | 'reading-mock' | 'reading-result' | 'writing-draft' | 'writing-report'

export interface AssistantRouteSnapshot {
  name?: string | null
  params: Record<string, unknown>
  query: Record<string, unknown>
}

export interface AssistantPageContext {
  kind: AssistantPageContextKind
  label: string
  title: string
  activeItem?: string
  questionCount?: number
  characterCount: number
  truncated: boolean
  data: Record<string, unknown>
  evidence: CoachEvidenceEntry[]
  suggestedQuestions: string[]
}

export interface AssistantActionContext {
  kind: AssistantPageContextKind
  targetId?: string
  questionType?: ReadingQuestion['type']
}

export interface AssistantPageContextDependencies {
  sets: PracticeSet[]
  tasks: WritingTask[]
  mockSets: (mockId: string) => PracticeSet[]
  practice: Pick<PracticeRepository, 'getDraft' | 'getAttempt'>
  writing: Pick<WritingRepository, 'getDraft' | 'getReport'>
}

export const MAX_CONTEXT_DATA_CHARS = 12_000

function markTruncatedEvidence(evidence: CoachEvidenceEntry[]): CoachEvidenceEntry[] {
  return evidence.map((entry) => entry.id === 'context.reading.passage' || entry.id === 'context.reading.questions'
    ? { ...entry, value: '材料已按上下文字符上限截断；当前题与前部原文优先保留', confidence: 'medium' }
    : entry)
}

function routeValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function questionOptions(question: ReadingQuestion): Array<{ key: string; label: string }> | undefined {
  return 'options' in question ? question.options.map(({ key, label }) => ({ key, label })) : undefined
}

function questionSummary(question: ReadingQuestion, index: number): Record<string, unknown> {
  const options = questionOptions(question)
  return {
    index: index + 1, id: question.id, type: question.type, prompt: question.prompt,
    ...(options ? { options } : {}),
    ...('beforeBlank' in question ? { beforeBlank: question.beforeBlank, afterBlank: question.afterBlank ?? '' } : {}),
    ...('diagramDescription' in question ? { diagramDescription: question.diagramDescription } : {}),
    ...('wordLimit' in question ? { wordLimit: question.wordLimit } : {}),
  }
}

function sourceParagraph(set: PracticeSet, question: ReadingQuestion): string {
  return set.passage.sections[question.sourceRef.sectionIndex]?.paragraphs[question.sourceRef.paragraphIndex] ?? ''
}

function activeQuestionData(
  set: PracticeSet,
  question: ReadingQuestion,
  index: number,
  userAnswer: string[] = [],
  acceptedAnswers: AcceptedAnswer[] = question.acceptedAnswers,
  explanation = question.explanation,
): Record<string, unknown> {
  return {
    ...questionSummary(question, index), setId: set.id, userAnswer, acceptedAnswers, explanation,
    sourceRef: question.sourceRef, sourceParagraph: sourceParagraph(set, question),
  }
}

function passageData(set: PracticeSet): Record<string, unknown> {
  return {
    setId: set.id, title: set.passage.title, deck: set.passage.deck,
    sections: set.passage.sections.map(({ heading, paragraphs }) => ({ heading, paragraphs })),
  }
}

function boundedContext(context: Omit<AssistantPageContext, 'characterCount' | 'truncated'>): AssistantPageContext {
  const serialized = JSON.stringify(context.data)
  if (serialized.length <= MAX_CONTEXT_DATA_CHARS) {
    return { ...context, data: context.data, characterCount: serialized.length, truncated: false }
  }
  const excerpt = serialized.slice(0, MAX_CONTEXT_DATA_CHARS - 120)
  return {
    ...context,
    data: { excerpt, truncationNotice: '超长导入材料已按消息上限截断；当前题与材料开头优先保留。' },
    evidence: markTruncatedEvidence(context.evidence),
    characterCount: excerpt.length,
    truncated: true,
  }
}

function readingEvidence(questionCount: number, activeQuestion: ReadingQuestion, userAnswer: string[]): CoachEvidenceEntry[] {
  return [
    { id: 'context.reading.passage', label: '当前阅读原文', value: '当前页面全文已加载', sampleSize: 1, confidence: 'high' },
    { id: 'context.reading.questions', label: '当前题目', value: `${questionCount} 道题干与选项已加载`, sampleSize: questionCount, confidence: 'high' },
    { id: 'context.reading.active_question', label: '当前题', value: activeQuestion.prompt.slice(0, 360), sampleSize: 1, confidence: 'high' },
    { id: 'context.reading.user_answer', label: '你的答案', value: userAnswer.join(', ').slice(0, 600) || '尚未作答', sampleSize: userAnswer.length ? 1 : 0, confidence: 'high' },
    { id: 'context.reading.answer_key', label: '本地答案与解析', value: '标准答案、解析和原文定位已加载', sampleSize: 1, confidence: 'high' },
  ]
}

function readingPracticeContext(testId: string, dependencies: AssistantPageContextDependencies): AssistantPageContext | null {
  const set = dependencies.sets.find(({ id }) => id === testId)
  if (!set) return null
  const draft = dependencies.practice.getDraft(testId)
  const currentIndex = Math.min(Math.max(draft?.currentIndex ?? 0, 0), set.questions.length - 1)
  const question = set.questions[currentIndex]
  if (!question) return null
  const userAnswer = draft?.answers[question.id] ?? []
  const data = {
    activeQuestion: activeQuestionData(set, question, currentIndex, userAnswer),
    passage: passageData(set),
    questions: set.questions.map(questionSummary),
    practiceState: { currentQuestion: currentIndex + 1, questionCount: set.questions.length, userAnswer },
  }
  return boundedContext({
    kind: 'reading-practice', label: '阅读练习', title: set.title, activeItem: `Question ${currentIndex + 1}`,
    questionCount: set.questions.length, data, evidence: readingEvidence(set.questions.length, question, userAnswer),
    suggestedQuestions: ['为什么这道题应该是这个答案？', '原文哪一句直接支持这个判断？', '这个干扰项为什么不成立？'],
  })
}

function readingMockContext(mockId: string, dependencies: AssistantPageContextDependencies): AssistantPageContext | null {
  const draft = dependencies.practice.getDraft(`mock:${mockId}`)
  const mockSets = dependencies.mockSets(mockId)
  const entries = mockSets.flatMap((set) => set.questions.map((question, setQuestionIndex) => ({
    set, question, setQuestionIndex,
  })))
  const currentIndex = Math.min(Math.max(draft?.currentIndex ?? 0, 0), entries.length - 1)
  const entry = entries[currentIndex]
  if (!entry) return null
  const userAnswer = draft?.answers[entry.question.id] ?? []
  const data = {
    activeQuestion: activeQuestionData(entry.set, entry.question, entry.setQuestionIndex, userAnswer),
    passage: passageData(entry.set),
    questions: entry.set.questions.map(questionSummary),
    mockState: {
      mockId, currentQuestion: currentIndex + 1, totalQuestions: entries.length,
      currentPassage: mockSets.indexOf(entry.set) + 1, userAnswer,
    },
  }
  return boundedContext({
    kind: 'reading-mock', label: '阅读模考', title: entry.set.title, activeItem: `Question ${currentIndex + 1}`,
    questionCount: entry.set.questions.length, data,
    evidence: readingEvidence(entry.set.questions.length, entry.question, userAnswer),
    suggestedQuestions: ['为什么这道题应该是这个答案？', '原文哪一句直接支持这个判断？', '这个干扰项为什么不成立？'],
  })
}

function readingResultContext(attemptId: string, dependencies: AssistantPageContextDependencies): AssistantPageContext | null {
  const attempt = dependencies.practice.getAttempt(attemptId)
  if (!attempt) return null
  const relatedSets = dependencies.sets.filter((set) => set.id === attempt.testId
    || set.questions.some(({ id }) => attempt.score.items.some(({ questionId }) => questionId === id)))
  if (!relatedSets.length) return null
  const result = attempt.score.items.find(({ isCorrect }) => !isCorrect) ?? attempt.score.items[0]
  if (!result) return null
  const set = relatedSets.find((candidate) => candidate.questions.some(({ id }) => id === result.questionId)) ?? relatedSets[0]!
  const currentIndex = set.questions.findIndex(({ id }) => id === result.questionId)
  const question = set.questions[currentIndex]
  if (!question) return null
  const questionCount = relatedSets.reduce((sum, candidate) => sum + candidate.questions.length, 0)
  const data = {
    activeQuestion: {
      ...activeQuestionData(set, question, currentIndex, result.givenAnswer, result.acceptedAnswers, result.explanation),
      givenAnswer: result.givenAnswer,
    },
    attempt: {
      id: attempt.id, mode: attempt.mode ?? 'practice', score: attempt.score.correct, total: attempt.score.total,
      approximateBand: attempt.score.approximateBand, submittedAt: attempt.submittedAt,
    },
    passages: relatedSets.map(passageData),
    questions: relatedSets.flatMap((candidate) => candidate.questions.map(questionSummary)),
  }
  return boundedContext({
    kind: 'reading-result', label: '阅读复盘', title: relatedSets.length === 1 ? set.title : '完整阅读模考',
    activeItem: `Question ${attempt.score.items.findIndex(({ questionId }) => questionId === question.id) + 1}`,
    questionCount, data, evidence: readingEvidence(questionCount, question, result.givenAnswer),
    suggestedQuestions: ['为什么我的答案不成立？', '标准答案对应原文哪一处？', '怎样避免再次选中这个干扰项？'],
  })
}

function writingTaskData(task: WritingTask): Record<string, unknown> {
  return {
    id: task.id, type: task.type, title: task.title, prompt: task.prompt, instructions: task.instructions,
    minimumWords: task.minimumWords, focus: task.focus, ...(task.visualData ? { visualData: task.visualData } : {}),
  }
}

function writingDraftContext(taskId: string, dependencies: AssistantPageContextDependencies): AssistantPageContext | null {
  const task = dependencies.tasks.find(({ id }) => id === taskId) ?? dependencies.tasks[0]
  if (!task) return null
  const draft = dependencies.writing.getDraft(task.id)
  const data = { task: writingTaskData(task), draft: draft ? { essay: draft.essay, elapsedSeconds: draft.elapsedSeconds, updatedAt: draft.updatedAt } : null }
  const draftLength = draft?.essay.length ?? 0
  return boundedContext({
    kind: 'writing-draft', label: '写作草稿', title: task.title, activeItem: draft ? `${draftLength} 字符草稿` : '尚未开始',
    data,
    evidence: [
      { id: 'context.writing.task', label: '当前写作题目', value: task.prompt.slice(0, 360), sampleSize: 1, confidence: 'high' },
      { id: 'context.writing.draft', label: '当前作文草稿', value: draft ? `${draftLength} 字符已加载` : '尚无草稿', sampleSize: draft ? 1 : 0, confidence: 'high' },
    ],
    suggestedQuestions: ['这段为什么这样写更自然？', '当前表达有哪些语法或搭配问题？', '请给我一个保留原意的改写方向。'],
  })
}

function writingReportContext(reportId: string, dependencies: AssistantPageContextDependencies): AssistantPageContext | null {
  const report = dependencies.writing.getReport(reportId)
  if (!report) return null
  const task = dependencies.tasks.find(({ id }) => id === report.taskId)
  const data = {
    ...(task ? { task: writingTaskData(task) } : {}), manuscript: report.essay,
    report: {
      summary: report.summary, overallBand: report.overallBand, criteria: report.criteria,
      strengths: report.strengths, priorities: report.priorities, evidence: report.evidence,
      promptVersion: report.promptVersion,
    },
  }
  return boundedContext({
    kind: 'writing-report', label: '写作报告', title: task?.title ?? '写作辅助评估报告', activeItem: `辅助 Band ${report.overallBand.toFixed(1)}`,
    data,
    evidence: [
      { id: 'context.writing.task', label: '写作任务', value: task?.prompt.slice(0, 360) ?? report.taskId, sampleSize: 1, confidence: 'high' },
      { id: 'context.writing.manuscript', label: '提交作文', value: `${report.wordCount} 词原文已加载`, sampleSize: 1, confidence: 'high' },
      { id: 'context.writing.report', label: '辅助评估报告', value: `${report.criteria.length} 项维度、${report.evidence.length} 条原文证据`, sampleSize: report.evidence.length, confidence: 'high' },
    ],
    suggestedQuestions: ['为什么报告把这句话列为问题？', '这个改写比原句好在哪里？', '我应该怎样练习这个重复问题？'],
  })
}

export function buildAssistantPageContext(
  route: AssistantRouteSnapshot,
  dependencies: AssistantPageContextDependencies,
): AssistantPageContext | null {
  if (route.name === 'practice') return readingPracticeContext(routeValue(route.params.testId), dependencies)
  if (route.name === 'mock') return readingMockContext(routeValue(route.params.mockId), dependencies)
  if (route.name === 'result') return readingResultContext(routeValue(route.params.attemptId), dependencies)
  if (route.name === 'writing') return writingDraftContext(routeValue(route.query.task), dependencies)
  if (route.name === 'writing-report') return writingReportContext(routeValue(route.params.reportId), dependencies)
  return null
}

export function buildAssistantActionContext(context: AssistantPageContext | null): AssistantActionContext | undefined {
  if (!context) return undefined
  const activeQuestion = context.data.activeQuestion
  if (context.kind.startsWith('reading-') && activeQuestion && typeof activeQuestion === 'object' && !Array.isArray(activeQuestion)) {
    const values = activeQuestion as Record<string, unknown>
    if (typeof values.setId === 'string' && typeof values.type === 'string') {
      return { kind: context.kind, targetId: values.setId, questionType: values.type as ReadingQuestion['type'] }
    }
  }
  const task = context.data.task
  if (context.kind.startsWith('writing-') && task && typeof task === 'object' && !Array.isArray(task)) {
    const taskId = (task as Record<string, unknown>).id
    return { kind: context.kind, ...(typeof taskId === 'string' ? { targetId: taskId } : {}) }
  }
  return { kind: context.kind }
}
