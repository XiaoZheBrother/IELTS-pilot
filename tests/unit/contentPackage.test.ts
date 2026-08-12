import { validateContentPackage } from '../../src/domain/contentPackage'
import type { ContentPackage } from '../../src/domain/contentPackage'
import type { PracticeSet } from '../../src/domain/models'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

const validPackageV2 = {
  ...validPackage,
  schemaVersion: 2,
  version: '1.2.0',
  description: 'A complete authorized practice package.',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-12T00:00:00.000Z',
  minimumAppVersion: '0.5.0',
  changelog: 'Adds a source-linked practice set.',
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
    [{ ...validPackage, schemaVersion: 3 }, 'schemaVersion'],
    [{ ...validPackage, license: '' }, 'license'],
    [{ ...validPackage, sets: [{ ...set, questions: [{ ...set.questions[0], sourceRef: { sectionIndex: 4, paragraphIndex: 0 } }] }] }, 'sourceRef'],
    [{ ...validPackage, sets: [{ ...set, passage: { ...set.passage, deck: '<script>alert(1)</script>' } }] }, 'unsafe'],
    [{ ...validPackage, sets: [set, { ...set }] }, 'duplicate'],
  ])('rejects invalid or unsafe content', (candidate, errorFragment) => {
    const result = validateContentPackage(candidate)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(' ')).toContain(errorFragment)
  })

  it('normalizes schema version one and accepts a complete schema version two package', () => {
    const legacy = validateContentPackage(validPackage)
    const current = validateContentPackage(validPackageV2)
    expect(legacy.ok && legacy.value.schemaVersion).toBe(2)
    expect(legacy.ok && legacy.value.version).toBe('1.0.0')
    expect(current.ok).toBe(true)
    if (current.ok) expect(current.value.version).toBe('1.2.0')
  })

  it.each([
    [{ ...validPackageV2, version: 'latest' }, 'version'],
    [{ ...validPackageV2, updatedAt: 'yesterday' }, 'updatedAt'],
    [{ ...validPackageV2, description: '' }, 'description'],
  ])('rejects incomplete version two metadata', (candidate, errorFragment) => {
    const result = validateContentPackage(candidate)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(' ')).toContain(errorFragment)
  })

  it('ships a valid schema version two example package', () => {
    const example = JSON.parse(readFileSync(resolve('examples/sample-content-package-v2.json'), 'utf8')) as unknown
    const result = validateContentPackage(example)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.sets[0]?.questions.length).toBeGreaterThanOrEqual(3)
  })

  it.each([
    [{ ...set.questions[0], type: 'multiple-choice', options: [] }, 'options'],
    [{ ...set.questions[0], type: 'multiple-select', options: [{ key: 'A', label: 'One' }], selectLimit: 2 }, 'selectLimit'],
    [{ ...set.questions[0], type: 'short-answer', wordLimit: 0 }, 'wordLimit'],
  ])('rejects incomplete type-specific question fields', (question, errorFragment) => {
    const result = validateContentPackage({ ...validPackageV2, sets: [{ ...set, questions: [question] }] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(' ')).toContain(errorFragment)
  })
})

