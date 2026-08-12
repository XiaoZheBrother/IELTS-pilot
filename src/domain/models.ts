export type QuestionType =
  | 'multiple-choice'
  | 'multiple-select'
  | 'true-false-not-given'
  | 'yes-no-not-given'
  | 'matching-headings'
  | 'matching-information'
  | 'matching-features'
  | 'matching-sentence-endings'
  | 'short-answer'
  | 'sentence-completion'
  | 'summary-word-bank'
  | 'diagram-label'

export type Difficulty = 'foundation' | 'medium' | 'advanced'
export type AcceptedAnswer = string | string[]

export interface SourceReference {
  sectionIndex: number
  paragraphIndex: number
  quote?: string
}

export interface QuestionOption {
  key: string
  label: string
}

interface BaseQuestion {
  id: string
  type: QuestionType
  prompt: string
  acceptedAnswers: AcceptedAnswer[]
  explanation: string
  sourceRef: SourceReference
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  type: 'multiple-choice'
  options: QuestionOption[]
}

export interface MultipleSelectQuestion extends BaseQuestion {
  type: 'multiple-select'
  options: QuestionOption[]
  selectLimit: number
}

export interface TrueFalseNotGivenQuestion extends BaseQuestion {
  type: 'true-false-not-given'
}

export interface YesNoNotGivenQuestion extends BaseQuestion {
  type: 'yes-no-not-given'
}

export interface MatchingQuestion extends BaseQuestion {
  type:
    | 'matching-headings'
    | 'matching-information'
    | 'matching-features'
    | 'matching-sentence-endings'
  options: QuestionOption[]
}

export interface ShortAnswerQuestion extends BaseQuestion {
  type: 'short-answer'
  wordLimit: number
}

export interface SentenceCompletionQuestion extends BaseQuestion {
  type: 'sentence-completion'
  wordLimit: number
  beforeBlank: string
  afterBlank?: string
}

export interface SummaryWordBankQuestion extends BaseQuestion {
  type: 'summary-word-bank'
  options: QuestionOption[]
}

export interface DiagramLabelQuestion extends BaseQuestion {
  type: 'diagram-label'
  wordLimit: number
  diagramDescription: string
}

export type ReadingQuestion =
  | MultipleChoiceQuestion
  | MultipleSelectQuestion
  | TrueFalseNotGivenQuestion
  | YesNoNotGivenQuestion
  | MatchingQuestion
  | ShortAnswerQuestion
  | SentenceCompletionQuestion
  | SummaryWordBankQuestion
  | DiagramLabelQuestion

export interface PassageSection {
  heading: string
  paragraphs: string[]
}

export interface ContentProvenance {
  kind: 'original' | 'public-domain' | 'licensed'
  author: string
  note: string
  license: string
  sourceUrl?: string
}

export interface PracticeSet {
  id: string
  sequence: string
  eyebrow: string
  title: string
  summary: string
  level: string
  durationMinutes: number
  topics: string[]
  difficulty: Difficulty
  estimatedBand: number
  passage: {
    title: string
    deck: string
    sections: PassageSection[]
  }
  provenance: ContentProvenance
  questions: ReadingQuestion[]
}

export interface MockTest {
  id: string
  title: string
  description: string
  durationMinutes: number
  practiceSetIds: [string, string, string]
}

export type ReadingAnswers = Record<string, string[]>

export interface ReadingItemResult {
  questionId: string
  questionType: QuestionType
  isCorrect: boolean
  givenAnswer: string[]
  acceptedAnswers: AcceptedAnswer[]
  explanation: string
  sourceRef: SourceReference
}

export interface ReadingScore {
  correct: number
  total: number
  percentage: number
  normalizedRaw40: number
  approximateBand: number
  scoringVersion: 'reading-v2'
  items: ReadingItemResult[]
}

export interface PracticeDraft {
  testId: string
  answers: ReadingAnswers
  currentIndex: number
  remainingSeconds: number
  updatedAt: string
  flags?: string[]
}

export interface Attempt {
  id: string
  testId: string
  mode?: 'practice' | 'mock'
  mockId?: string
  answers: ReadingAnswers
  score: ReadingScore
  submittedAt: string
  durationSeconds: number
  submissionReason: 'manual' | 'time-expired'
}

