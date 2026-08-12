import type { AcceptedAnswer, ReadingQuestion } from './models'

const boundaryPunctuation = /^[\s"'“”‘’.,!?;:()[\]{}]+|[\s"'“”‘’.,!?;:()[\]{}]+$/gu
const completionTypes = new Set(['short-answer', 'sentence-completion', 'diagram-label'])

export function normalizeAnswer(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[‐‑‒–—―]/g, '-')
    .toLocaleLowerCase('en')
    .replace(/\s+/g, ' ')
    .replace(boundaryPunctuation, '')
    .trim()
}

function canonicalJudgment(value: string): string {
  const compact = normalizeAnswer(value).replace(/[\s-]+/g, '')
  const aliases: Record<string, string> = {
    true: 'yes', t: 'yes', yes: 'yes', y: 'yes',
    false: 'no', f: 'no', no: 'no', n: 'no',
    notgiven: 'not given', ng: 'not given',
  }
  return aliases[compact] ?? normalizeAnswer(value)
}

function normalizeValues(values: string[], judgment: boolean): string[] {
  const normalize = judgment ? canonicalJudgment : normalizeAnswer
  return values.map(normalize).filter(Boolean).sort()
}

function acceptedToValues(accepted: AcceptedAnswer): string[] {
  return Array.isArray(accepted) ? accepted : [accepted]
}

export function matchAnswer(question: ReadingQuestion, answer: string[] | undefined): boolean {
  if (!answer?.some((value) => value.trim())) return false

  const first = answer[0] ?? ''
  if (completionTypes.has(question.type) && 'wordLimit' in question) {
    const normalized = normalizeAnswer(first)
    const wordCount = normalized ? normalized.split(/\s+/).length : 0
    if (wordCount > question.wordLimit) return false
  }

  const judgment = question.type === 'true-false-not-given' || question.type === 'yes-no-not-given'
  const normalizedAnswer = normalizeValues(answer, judgment)

  return question.acceptedAnswers.some((accepted) => {
    const normalizedAccepted = normalizeValues(acceptedToValues(accepted), judgment)
    return normalizedAccepted.length === normalizedAnswer.length
      && normalizedAccepted.every((value, index) => value === normalizedAnswer[index])
  })
}

