import type { Attempt, PracticeSet, QuestionType, ReadingItemResult, ReadingQuestion } from './models'

export interface ErrorBookEntry {
  key: string
  attemptId: string
  submittedAt: string
  practiceSet: PracticeSet
  question: ReadingQuestion
  result: ReadingItemResult
  mastered: boolean
}

export interface ErrorBookFilters {
  type: QuestionType | 'all'
  setId: string | 'all'
  state: 'learning' | 'mastered' | 'all'
  query: string
}

export function deriveErrorBook(attempts: Attempt[], sets: PracticeSet[], masteredKeys: string[]): ErrorBookEntry[] {
  const setMap = new Map(sets.map((set) => [set.id, set]))
  const questionMap = new Map(sets.flatMap((set) => set.questions.map((question) => [question.id, { question, practiceSet: set }] as const)))
  return attempts.flatMap((attempt) => attempt.score.items.flatMap((result) => {
    if (result.isCorrect) return []
    const directSet = setMap.get(attempt.testId)
    const match = directSet?.questions.find(({ id }) => id === result.questionId)
      ? { practiceSet: directSet, question: directSet.questions.find(({ id }) => id === result.questionId)! }
      : questionMap.get(result.questionId)
    if (!match) return []
    const key = `${attempt.id}:${result.questionId}`
    return [{ key, attemptId: attempt.id, submittedAt: attempt.submittedAt, practiceSet: match.practiceSet, question: match.question, result, mastered: masteredKeys.includes(key) }]
  }))
}

export function filterErrorBook(entries: ErrorBookEntry[], filters: ErrorBookFilters): ErrorBookEntry[] {
  const query = filters.query.trim().toLocaleLowerCase()
  return entries.filter((entry) => {
    const searchable = `${entry.question.prompt} ${entry.practiceSet.title} ${entry.question.explanation}`.toLocaleLowerCase()
    return (filters.type === 'all' || entry.question.type === filters.type)
      && (filters.setId === 'all' || entry.practiceSet.id === filters.setId)
      && (filters.state === 'all' || (filters.state === 'mastered' ? entry.mastered : !entry.mastered))
      && (!query || searchable.includes(query))
  })
}

function timestampId(date: Date): string {
  const compact = date.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  return `${compact.slice(0, 8)}-${compact.slice(8)}`
}

export function createRetryPracticeSet(entries: ErrorBookEntry[], now = () => new Date()): PracticeSet {
  const unique = [...new Map(entries.map((entry) => [entry.question.id, entry])).values()]
  if (!unique.length) throw new Error('没有可重练的错题。')
  const sets = [...new Map(unique.map((entry) => [entry.practiceSet.id, entry.practiceSet])).values()]
  const sectionOffset = new Map<string, number>()
  const sections = sets.flatMap((set) => {
    sectionOffset.set(set.id, [...sectionOffset.values()].length ? sectionsLength(sets.slice(0, sets.indexOf(set))) : 0)
    return set.passage.sections.map((section) => ({ ...section, heading: sets.length > 1 ? `${set.title} · ${section.heading}` : section.heading }))
  })
  const questions = unique.map(({ question, practiceSet }) => ({
    ...question,
    sourceRef: { ...question.sourceRef, sectionIndex: (sectionOffset.get(practiceSet.id) ?? 0) + question.sourceRef.sectionIndex },
  }))
  const created = now()
  return {
    id: `retry-errors-${timestampId(created)}`, sequence: 'RE', eyebrow: 'Error retry', title: '错题强化练习',
    summary: `根据错题本生成的 ${questions.length} 题本地强化练习。`, level: 'Personal',
    durationMinutes: Math.max(5, questions.length * 2), topics: ['错题强化', ...new Set(sets.flatMap(({ topics }) => topics))],
    difficulty: 'medium', estimatedBand: 6, passage: { title: '错题原文合集', deck: '按原文定位重新完成尚未掌握的题目。', sections },
    provenance: { kind: 'original', author: 'IELTS Pilot local drill', note: 'Generated locally from content already available to this user.', license: 'Same as source packages' },
    questions,
  }
}

function sectionsLength(sets: PracticeSet[]): number {
  return sets.reduce((sum, set) => sum + set.passage.sections.length, 0)
}
