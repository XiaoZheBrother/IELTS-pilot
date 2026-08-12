import { validateContentPackage } from '../../src/domain/contentPackage'
import type { ContentPackage } from '../../src/domain/contentPackage'
import type { PracticeSet } from '../../src/domain/models'

const set: PracticeSet = {
  id: 'imported-one', sequence: 'X1', eyebrow: 'Imported', title: 'Authorized sample',
  summary: 'A licensed sample.', level: 'B2', durationMinutes: 20,
  topics: ['environment'], difficulty: 'medium', estimatedBand: 6,
  passage: { title: 'Authorized sample', deck: 'A licensed sample.', sections: [{ heading: 'One', paragraphs: ['Safe passage text.'] }] },
  provenance: { kind: 'licensed', author: 'Example Author', note: 'Used with permission.', license: 'CC-BY-4.0', sourceUrl: 'https://example.com/source' },
  questions: [{ id: 'import_q1', type: 'short-answer', prompt: 'What kind of text is this?', acceptedAnswers: ['safe passage'], wordLimit: 2, explanation: 'The passage says so.', sourceRef: { sectionIndex: 0, paragraphIndex: 0 } }],
}

const validPackage: ContentPackage = {
  schemaVersion: 1, packageId: 'authorized-pack', name: 'Authorized Pack',
  owner: 'Example Author', license: 'CC-BY-4.0', sourceUrl: 'https://example.com/source',
  note: 'Prepared for IELTS Pilot.', sets: [set],
}

describe('content package validation', () => {
  it('accepts a declarative, licensed package and returns an isolated copy', () => {
    const result = validateContentPackage(validPackage)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.sets[0]?.id).toBe('imported-one')
      expect(result.value).not.toBe(validPackage)
    }
  })

  it.each([
    [{ ...validPackage, schemaVersion: 2 }, 'schemaVersion'],
    [{ ...validPackage, license: '' }, 'license'],
    [{ ...validPackage, sets: [{ ...set, questions: [{ ...set.questions[0], sourceRef: { sectionIndex: 4, paragraphIndex: 0 } }] }] }, 'sourceRef'],
    [{ ...validPackage, sets: [{ ...set, passage: { ...set.passage, deck: '<script>alert(1)</script>' } }] }, 'unsafe'],
    [{ ...validPackage, sets: [set, { ...set }] }, 'duplicate'],
  ])('rejects invalid or unsafe content', (candidate, errorFragment) => {
    const result = validateContentPackage(candidate)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(' ')).toContain(errorFragment)
  })
})

