import { practiceSets } from '../../src/data/practiceSets'

describe('bundled practice content', () => {
  it('ships two complete, explicitly original reading sets', () => {
    expect(practiceSets).toHaveLength(2)

    for (const practiceSet of practiceSets) {
      expect(practiceSet.provenance.kind).toBe('original')
      expect(practiceSet.questions).toHaveLength(8)
      expect(practiceSet.passage.sections.length).toBeGreaterThanOrEqual(4)
      expect(new Set(practiceSet.questions.map(({ id }) => id)).size).toBe(8)
      expect(practiceSet.questions.some(({ type }) => type === 'multiple-choice')).toBe(true)
      expect(practiceSet.questions.some(({ type }) => type === 'true-false-not-given')).toBe(true)
      expect(practiceSet.questions.some(({ type }) => type === 'short-answer')).toBe(true)
    }
  })

  it('uses unique test and question identifiers across the catalog', () => {
    const testIds = practiceSets.map(({ id }) => id)
    const questionIds = practiceSets.flatMap(({ questions }) => questions.map(({ id }) => id))

    expect(new Set(testIds).size).toBe(testIds.length)
    expect(new Set(questionIds).size).toBe(questionIds.length)
  })
})
