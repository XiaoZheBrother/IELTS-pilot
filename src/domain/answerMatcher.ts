import type { ReadingQuestion } from './models'

const boundaryPunctuation = /^[\s"'“”‘’.,!?;:()[\]{}]+|[\s"'“”‘’.,!?;:()[\]{}]+$/gu

export function normalizeAnswer(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[‐‑‒–—―]/g, '-')
    .toLocaleLowerCase('en')
    .replace(/\s+/g, ' ')
    .replace(boundaryPunctuation, '')
    .trim()
}

function canonicalTfng(value: string): string {
  const compact = normalizeAnswer(value).replace(/[\s-]+/g, '')
  const aliases: Record<string, string> = {
    true: 'true',
    t: 'true',
    yes: 'true',
    y: 'true',
    false: 'false',
    f: 'false',
    no: 'false',
    n: 'false',
    notgiven: 'not given',
    ng: 'not given',
  }

  return aliases[compact] ?? normalizeAnswer(value)
}

export function matchAnswer(question: ReadingQuestion, answer: string | undefined): boolean {
  if (!answer?.trim()) return false

  if (question.type === 'short-answer') {
    const normalized = normalizeAnswer(answer)
    const wordCount = normalized ? normalized.split(/\s+/).length : 0
    if (wordCount > question.wordLimit) return false

    return question.acceptedAnswers.some((accepted) => normalizeAnswer(accepted) === normalized)
  }

  if (question.type === 'true-false-not-given') {
    const normalized = canonicalTfng(answer)
    return question.acceptedAnswers.some((accepted) => canonicalTfng(accepted) === normalized)
  }

  const normalized = normalizeAnswer(answer)
  return question.acceptedAnswers.some((accepted) => normalizeAnswer(accepted) === normalized)
}
