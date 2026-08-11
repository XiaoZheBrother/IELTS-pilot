import { matchAnswer, normalizeAnswer } from '../../src/domain/answerMatcher'
import type { ReadingQuestion } from '../../src/domain/models'

const shortAnswerQuestion: ReadingQuestion = {
  id: 'q-short',
  type: 'short-answer',
  prompt: 'Who funded the first survey?',
  acceptedAnswers: ['the city council', 'city council'],
  wordLimit: 3,
  explanation: 'The second paragraph names the city council as the funder.',
}

describe('answer matcher', () => {
  it('normalizes case, spacing and harmless punctuation', () => {
    expect(normalizeAnswer('  The   CITY Council. ')).toBe('the city council')
    expect(matchAnswer(shortAnswerQuestion, '  The   CITY Council. ')).toBe(true)
  })

  it('recognizes common true/false/not given aliases', () => {
    const question: ReadingQuestion = {
      id: 'q-tfng',
      type: 'true-false-not-given',
      prompt: 'The pilot began in 2022.',
      acceptedAnswers: ['not given'],
      explanation: 'The passage does not state a start year.',
    }

    expect(matchAnswer(question, 'NG')).toBe(true)
    expect(matchAnswer(question, 'not-given')).toBe(true)
    expect(matchAnswer({ ...question, acceptedAnswers: ['true'] }, 'YES')).toBe(true)
    expect(matchAnswer({ ...question, acceptedAnswers: ['false'] }, 'No')).toBe(true)
  })

  it('enforces the stated short-answer word limit', () => {
    expect(matchAnswer(shortAnswerQuestion, 'the city council department')).toBe(false)
  })
})
