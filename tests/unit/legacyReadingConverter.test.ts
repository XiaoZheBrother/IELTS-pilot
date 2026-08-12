import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { validateContentPackage } from '../../src/domain/contentPackage'
// @ts-expect-error The production converter is an ESM JavaScript command with exported pure helpers.
import * as converter from '../../tools/convert-ielts-practice-reading.mjs'

const { buildContentPackage, buildExplanationIndex, convertExam, extractPassage, loadRegisteredPayload } = converter

const fixture = (name: string) => resolve('tests', 'fixtures', 'legacy-reading', name)

describe('legacy reading converter', () => {
  test('captures generated registry payloads in an isolated sandbox', async () => {
    const exam = await loadRegisteredPayload(fixture('exam.js'), '__READING_EXAM_DATA__')
    const explanation = await loadRegisteredPayload(fixture('explanation.js'), '__READING_EXPLANATION_DATA__')

    expect(exam.id).toBe('p1-high-demo')
    expect(exam.data.answerKey.q4).toEqual(['A', 'C'])
    expect(explanation.data.schemaVersion).toBe('ReadingExplanationV1')
  })

  test('converts passage HTML to plain article paragraphs and anchor metadata', async () => {
    const { data: exam } = await loadRegisteredPayload(fixture('exam.js'), '__READING_EXAM_DATA__')
    const passage = extractPassage(exam)

    expect(passage.title).toBe('A Demonstration Passage')
    expect(passage.sections[0].paragraphs).toHaveLength(2)
    expect(passage.sections[0].paragraphs[0]).toContain('Urban gardens can lower summer temperatures')
    expect(JSON.stringify(passage.sections)).not.toContain('<p')
    expect(passage.questionParagraphs.q1).toEqual({ sectionIndex: 0, paragraphIndex: 0 })
    expect(passage.questionParagraphs.q2).toEqual({ sectionIndex: 0, paragraphIndex: 0 })
  })

  test('maps source controls, answers and explanations to supported question types', async () => {
    const { data: exam } = await loadRegisteredPayload(fixture('exam.js'), '__READING_EXAM_DATA__')
    const { data: explanation } = await loadRegisteredPayload(fixture('explanation.js'), '__READING_EXPLANATION_DATA__')
    const explanations = buildExplanationIndex(explanation)
    const result = convertExam(exam, explanations, 'exam.js')
    const [tfng, headings, completion, multiple] = result.set.questions

    expect(tfng).toMatchObject({ type: 'true-false-not-given', acceptedAnswers: ['true'] })
    expect(tfng.explanation).toContain('lower summer temperatures')
    expect(headings.type).toBe('matching-headings')
    expect(headings.options).toEqual([
      { key: 'i', label: 'Community maintenance' },
      { key: 'ii', label: 'Environmental benefits' },
    ])
    expect(completion).toMatchObject({
      type: 'sentence-completion',
      acceptedAnswers: ['Friday', 'each Friday'],
      wordLimit: 2,
    })
    expect(completion.prompt).toContain('____')
    expect(multiple).toMatchObject({
      type: 'multiple-select',
      acceptedAnswers: [['A', 'C']],
      selectLimit: 2,
    })
    expect(result.stats.dedicatedExplanations).toBe(1)
    expect(result.stats.fallbackExplanations).toBe(6)
  })

  test('extracts shared option pools from legacy grouped controls', async () => {
    const { data: exam } = await loadRegisteredPayload(fixture('exam.js'), '__READING_EXAM_DATA__')
    const result = convertExam(exam, new Map(), 'exam.js')
    const [wordPool, groupedFirst, groupedSecond] = result.set.questions.slice(4)

    expect(wordPool).toMatchObject({
      type: 'matching-features',
      acceptedAnswers: ['B'],
      options: [
        { key: 'A', label: 'America' },
        { key: 'B', label: 'Bahrain' },
        { key: 'C', label: 'China' },
      ],
    })
    expect(groupedFirst).toMatchObject({
      type: 'multiple-choice',
      acceptedAnswers: ['A'],
      options: [
        { key: 'A', label: 'Cooler streets' },
        { key: 'B', label: 'More parking' },
        { key: 'C', label: 'Quiet places' },
      ],
    })
    expect(groupedSecond).toMatchObject({ type: 'multiple-choice', acceptedAnswers: ['C'] })
    expect(result.stats.downgradedOptionQuestions).toBe(0)
  })

  test('builds a package accepted by the application validator', async () => {
    const { data: exam } = await loadRegisteredPayload(fixture('exam.js'), '__READING_EXAM_DATA__')
    const converted = convertExam(exam, new Map(), 'exam.js')
    const content = buildContentPackage([converted.set], {
      packageId: 'private-atlas-p1-001',
      name: 'Private Atlas P1 001',
      category: 'P1',
      sourceUrl: 'https://github.com/sallowayma-git/IELTS-practice',
      timestamp: '2026-08-12T00:00:00.000Z',
    })

    const validation = validateContentPackage(content)
    expect(validation).toEqual({ ok: true, value: content })
  })
})
