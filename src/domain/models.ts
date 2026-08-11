export type QuestionType = 'multiple-choice' | 'true-false-not-given' | 'short-answer'

interface BaseQuestion {
  id: string
  type: QuestionType
  prompt: string
  acceptedAnswers: string[]
  explanation: string
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  type: 'multiple-choice'
  options: Array<{ key: string; label: string }>
}

export interface TrueFalseNotGivenQuestion extends BaseQuestion {
  type: 'true-false-not-given'
}

export interface ShortAnswerQuestion extends BaseQuestion {
  type: 'short-answer'
  wordLimit: number
}

export type ReadingQuestion =
  | MultipleChoiceQuestion
  | TrueFalseNotGivenQuestion
  | ShortAnswerQuestion

export interface PassageSection {
  heading: string
  paragraphs: string[]
}

export interface PracticeSet {
  id: string
  sequence: string
  eyebrow: string
  title: string
  summary: string
  level: string
  durationMinutes: number
  passage: {
    title: string
    deck: string
    sections: PassageSection[]
  }
  provenance: {
    kind: 'original'
    author: string
    note: string
  }
  questions: ReadingQuestion[]
}

export type ReadingAnswers = Record<string, string>

export interface ReadingItemResult {
  questionId: string
  isCorrect: boolean
  givenAnswer: string
  acceptedAnswers: string[]
  explanation: string
}

export interface ReadingScore {
  correct: number
  total: number
  percentage: number
  normalizedRaw40: number
  approximateBand: number
  scoringVersion: 'reading-v1'
  items: ReadingItemResult[]
}

export interface PracticeDraft {
  testId: string
  answers: ReadingAnswers
  currentIndex: number
  remainingSeconds: number
  updatedAt: string
}

export interface Attempt {
  id: string
  testId: string
  answers: ReadingAnswers
  score: ReadingScore
  submittedAt: string
  durationSeconds: number
  submissionReason: 'manual' | 'time-expired'
}
