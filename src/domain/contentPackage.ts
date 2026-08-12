import type { PracticeSet, QuestionType } from './models'

export interface ContentPackage {
  schemaVersion: 1
  packageId: string
  name: string
  owner: string
  license: string
  sourceUrl?: string
  note: string
  sets: PracticeSet[]
}

export type ContentPackageResult =
  | { ok: true; value: ContentPackage }
  | { ok: false; errors: string[] }

const supportedTypes = new Set<QuestionType>([
  'multiple-choice', 'multiple-select', 'true-false-not-given', 'yes-no-not-given',
  'matching-headings', 'matching-information', 'matching-features',
  'matching-sentence-endings', 'short-answer', 'sentence-completion',
  'summary-word-bank', 'diagram-label',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasUnsafeString(value: unknown): boolean {
  if (typeof value === 'string') return /<\s*script\b/i.test(value)
  if (Array.isArray(value)) return value.some(hasUnsafeString)
  if (isRecord(value)) return Object.values(value).some(hasUnsafeString)
  return false
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function validateContentPackage(input: unknown): ContentPackageResult {
  const errors: string[] = []
  if (!isRecord(input)) return { ok: false, errors: ['package must be an object'] }
  if (input.schemaVersion !== 1) errors.push('schemaVersion must be 1')
  for (const key of ['packageId', 'name', 'owner', 'license', 'note'] as const) {
    if (!nonEmptyString(input[key])) errors.push(`${key} is required`)
  }
  if (hasUnsafeString(input)) errors.push('unsafe script content is not allowed')
  if (!Array.isArray(input.sets) || input.sets.length === 0) errors.push('sets must contain at least one practice set')

  const seenSetIds = new Set<string>()
  const seenQuestionIds = new Set<string>()
  if (Array.isArray(input.sets)) input.sets.forEach((candidate, setIndex) => {
    if (!isRecord(candidate)) {
      errors.push(`sets[${setIndex}] must be an object`)
      return
    }
    const id = candidate.id
    if (!nonEmptyString(id)) errors.push(`sets[${setIndex}].id is required`)
    else if (seenSetIds.has(id)) errors.push(`duplicate set id: ${id}`)
    else seenSetIds.add(id)

    if (!isRecord(candidate.provenance) || !nonEmptyString(candidate.provenance.license)) {
      errors.push(`sets[${setIndex}].provenance.license is required`)
    }
    if (!isRecord(candidate.passage) || !Array.isArray(candidate.passage.sections)) {
      errors.push(`sets[${setIndex}].passage.sections is required`)
      return
    }
    const sections = candidate.passage.sections
    if (!Array.isArray(candidate.questions) || candidate.questions.length === 0) {
      errors.push(`sets[${setIndex}].questions is required`)
      return
    }

    candidate.questions.forEach((question, questionIndex) => {
      if (!isRecord(question)) {
        errors.push(`sets[${setIndex}].questions[${questionIndex}] must be an object`)
        return
      }
      if (!nonEmptyString(question.id)) errors.push(`question id is required at ${setIndex}:${questionIndex}`)
      else if (seenQuestionIds.has(question.id)) errors.push(`duplicate question id: ${question.id}`)
      else seenQuestionIds.add(question.id)
      if (!supportedTypes.has(question.type as QuestionType)) errors.push(`unsupported question type at ${setIndex}:${questionIndex}`)
      if (!Array.isArray(question.acceptedAnswers) || question.acceptedAnswers.length === 0) errors.push(`acceptedAnswers are required at ${setIndex}:${questionIndex}`)
      if (!isRecord(question.sourceRef)) {
        errors.push(`sourceRef is required at ${setIndex}:${questionIndex}`)
        return
      }
      const sectionIndex = question.sourceRef.sectionIndex
      const paragraphIndex = question.sourceRef.paragraphIndex
      const section = typeof sectionIndex === 'number' ? sections[sectionIndex] : undefined
      const paragraphs = isRecord(section) && Array.isArray(section.paragraphs) ? section.paragraphs : []
      if (!Number.isInteger(sectionIndex) || !Number.isInteger(paragraphIndex) || (paragraphIndex as number) < 0 || !paragraphs[paragraphIndex as number]) {
        errors.push(`sourceRef is outside the passage at ${setIndex}:${questionIndex}`)
      }
    })
  })

  if (errors.length) return { ok: false, errors }
  return { ok: true, value: JSON.parse(JSON.stringify(input)) as ContentPackage }
}
