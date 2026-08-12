import { fullReadingMock, getMockPracticeSets } from '../../src/data/fullMock'
import { getPracticeSet, practiceSets } from '../../src/data/practiceSets'

describe('practice set catalog', () => {
  it('ships three original, source-linked passage sets', () => {
    expect(practiceSets).toHaveLength(3)
    expect(getPracticeSet('shade-networks')?.title).toBe('The Shade Between Buildings')
    for (const set of practiceSets) {
      expect(set.provenance.kind).toBe('original')
      expect(set.provenance.license).toBeTruthy()
      expect(set.questions.every((question) => question.sourceRef.sectionIndex < set.passage.sections.length)).toBe(true)
    }
  })

  it('builds a complete three-passage, forty-question mock', () => {
    const sets = getMockPracticeSets(fullReadingMock.id)
    expect(sets).toHaveLength(3)
    expect(sets.flatMap((set) => set.questions)).toHaveLength(40)
    expect(fullReadingMock.durationMinutes).toBe(60)
    expect(new Set(sets.flatMap((set) => set.questions.map((question) => question.type))).size).toBeGreaterThanOrEqual(8)
  })
})

