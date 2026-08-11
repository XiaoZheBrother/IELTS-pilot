import { matchAnswer } from './answerMatcher'
import type { PracticeSet, ReadingAnswers, ReadingScore } from './models'

const academicReadingBands: Array<{ minimum: number; band: number }> = [
  { minimum: 39, band: 9 },
  { minimum: 37, band: 8.5 },
  { minimum: 35, band: 8 },
  { minimum: 33, band: 7.5 },
  { minimum: 30, band: 7 },
  { minimum: 27, band: 6.5 },
  { minimum: 23, band: 6 },
  { minimum: 19, band: 5.5 },
  { minimum: 15, band: 5 },
  { minimum: 13, band: 4.5 },
  { minimum: 10, band: 4 },
  { minimum: 8, band: 3.5 },
  { minimum: 6, band: 3 },
  { minimum: 4, band: 2.5 },
  { minimum: 0, band: 2 },
]

export function approximateAcademicBand(raw40: number): number {
  return academicReadingBands.find(({ minimum }) => raw40 >= minimum)?.band ?? 2
}

export function scoreReadingTest(test: PracticeSet, answers: ReadingAnswers): ReadingScore {
  const items = test.questions.map((question) => {
    const givenAnswer = answers[question.id] ?? ''
    return {
      questionId: question.id,
      isCorrect: matchAnswer(question, givenAnswer),
      givenAnswer,
      acceptedAnswers: [...question.acceptedAnswers],
      explanation: question.explanation,
    }
  })
  const correct = items.filter((item) => item.isCorrect).length
  const total = items.length
  const percentage = total === 0 ? 0 : Math.round((correct / total) * 100)
  const normalizedRaw40 = total === 0 ? 0 : Math.round((correct / total) * 40)

  return {
    correct,
    total,
    percentage,
    normalizedRaw40,
    approximateBand: approximateAcademicBand(normalizedRaw40),
    scoringVersion: 'reading-v1',
    items,
  }
}
