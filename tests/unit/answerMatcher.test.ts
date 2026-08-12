import { matchAnswer, normalizeAnswer } from '../../src/domain/answerMatcher'
import type { ReadingQuestion } from '../../src/domain/models'

const sourceRef = { sectionIndex: 0, paragraphIndex: 0, quote: 'The city council funded the survey.' }

const shortAnswerQuestion: ReadingQuestion = {
  id: 'q-short',
  type: 'short-answer',
  prompt: 'Who funded the first survey?',
  acceptedAnswers: ['the city council', 'city council'],
  wordLimit: 3,
  explanation: 'The second paragraph names the city council as the funder.',
  sourceRef,
}

describe('answer matcher', () => {
  it('normalizes case, spacing and harmless punctuation', () => {
    expect(normalizeAnswer('  The   CITY Council. ')).toBe('the city council')
    expect(matchAnswer(shortAnswerQuestion, ['  The   CITY Council. '])).toBe(true)
  })

  it('recognizes common judgment aliases for TFNG and YNNG', () => {
    const tfng: ReadingQuestion = {
      id: 'q-tfng',
      type: 'true-false-not-given',
      prompt: 'The pilot began in 2022.',
      acceptedAnswers: ['not given'],
      explanation: 'The passage does not state a start year.',
      sourceRef,
    }
    const ynng: ReadingQuestion = {
      ...tfng,
      id: 'q-ynng',
      type: 'yes-no-not-given',
      acceptedAnswers: ['yes'],
    }

    expect(matchAnswer(tfng, ['NG'])).toBe(true)
    expect(matchAnswer(tfng, ['not-given'])).toBe(true)
    expect(matchAnswer(ynng, ['TRUE'])).toBe(true)
    expect(matchAnswer({ ...ynng, acceptedAnswers: ['no'] }, ['false'])).toBe(true)
  })

  it('enforces completion word limits', () => {
    expect(matchAnswer(shortAnswerQuestion, ['the city council department'])).toBe(false)
    const sentence: ReadingQuestion = {
      ...shortAnswerQuestion,
      id: 'q-sentence',
      type: 'sentence-completion',
      beforeBlank: 'The survey was funded by',
      afterBlank: '.',
    }
    expect(matchAnswer(sentence, ['city council'])).toBe(true)
  })

  it('matches multi-select answers without depending on order', () => {
    const question: ReadingQuestion = {
      id: 'q-multi',
      type: 'multiple-select',
      prompt: 'Choose two answers.',
      options: [
        { key: 'A', label: 'Trees' },
        { key: 'B', label: 'Awnings' },
        { key: 'C', label: 'Fountains' },
      ],
      selectLimit: 2,
      acceptedAnswers: [['A', 'B']],
      explanation: 'Trees and awnings are named.',
      sourceRef,
    }

    expect(matchAnswer(question, ['B', 'A'])).toBe(true)
    expect(matchAnswer(question, ['A'])).toBe(false)
    expect(matchAnswer(question, ['A', 'C'])).toBe(false)
  })
})

