import type { PracticeSet, QuestionType } from './models'

interface ContentPackageBase {
  packageId: string
  name: string
  owner: string
  license: string
  sourceUrl?: string
  note: string
  sets: PracticeSet[]
}

export interface ContentPackageV1 extends ContentPackageBase {
  schemaVersion: 1
}

export interface ContentPackageV2 extends ContentPackageBase {
  schemaVersion: 2
  version: string
  description: string
  createdAt: string
  updatedAt: string
  minimumAppVersion: string
  changelog: string
  integrity?: string
}

export type ContentPackage = ContentPackageV1 | ContentPackageV2
export type NormalizedContentPackage = ContentPackageV2

export type ContentPackageResult =
  | { ok: true; value: NormalizedContentPackage }
  | { ok: false; errors: string[] }

const supportedTypes = new Set<QuestionType>([
  'multiple-choice', 'multiple-select', 'true-false-not-given', 'yes-no-not-given',
  'matching-headings', 'matching-information', 'matching-features',
  'matching-sentence-endings', 'short-answer', 'sentence-completion',
  'summary-word-bank', 'diagram-label',
])
const optionTypes = new Set<QuestionType>(['multiple-choice', 'multiple-select', 'matching-headings', 'matching-information', 'matching-features', 'matching-sentence-endings', 'summary-word-bank'])
const wordLimitTypes = new Set<QuestionType>(['short-answer', 'sentence-completion', 'diagram-label'])

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

function validIsoDate(value: unknown): value is string {
  return nonEmptyString(value) && !Number.isNaN(Date.parse(value))
}

function validVersion(value: unknown): value is string {
  return nonEmptyString(value) && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value)
}

function normalize(input: Record<string, unknown>): NormalizedContentPackage {
  if (input.schemaVersion === 2) return JSON.parse(JSON.stringify(input)) as NormalizedContentPackage
  return {
    ...(JSON.parse(JSON.stringify(input)) as Omit<ContentPackageV1, 'schemaVersion'>),
    schemaVersion: 2,
    version: '1.0.0',
    description: nonEmptyString(input.note) ? input.note : 'Legacy content package.',
    createdAt: '1970-01-01T00:00:00.000Z',
    updatedAt: '1970-01-01T00:00:00.000Z',
    minimumAppVersion: '0.2.0',
    changelog: 'Imported from schema version 1.',
  }
}

export function validateContentPackage(input: unknown): ContentPackageResult {
  const errors: string[] = []
  if (!isRecord(input)) return { ok: false, errors: ['package must be an object'] }
  if (input.schemaVersion !== 1 && input.schemaVersion !== 2) errors.push('schemaVersion must be 1 or 2')
  for (const key of ['packageId', 'name', 'owner', 'license', 'note'] as const) {
    if (!nonEmptyString(input[key])) errors.push(`${key} is required`)
  }
  if (input.schemaVersion === 2) {
    if (!validVersion(input.version)) errors.push('version must use semantic versioning')
    if (!nonEmptyString(input.description)) errors.push('description is required')
    if (!validIsoDate(input.createdAt)) errors.push('createdAt must be an ISO date')
    if (!validIsoDate(input.updatedAt)) errors.push('updatedAt must be an ISO date')
    if (!validVersion(input.minimumAppVersion)) errors.push('minimumAppVersion must use semantic versioning')
    if (!nonEmptyString(input.changelog)) errors.push('changelog is required')
  }
  if (hasUnsafeString(input)) errors.push('unsafe script content is not allowed')
  if (!Array.isArray(input.sets) || input.sets.length === 0) errors.push('sets must contain at least one practice set')

  const seenSetIds = new Set<string>()
  const seenQuestionIds = new Set<string>()
  if (Array.isArray(input.sets)) input.sets.forEach((candidate, setIndex) => {
    if (!isRecord(candidate)) { errors.push(`sets[${setIndex}] must be an object`); return }
    const id = candidate.id
    if (!nonEmptyString(id)) errors.push(`sets[${setIndex}].id is required`)
    else if (seenSetIds.has(id)) errors.push(`duplicate set id: ${id}`)
    else seenSetIds.add(id)

    for (const key of ['sequence', 'eyebrow', 'title', 'summary', 'level'] as const) if (!nonEmptyString(candidate[key])) errors.push(`sets[${setIndex}].${key} is required`)
    if (!Number.isFinite(candidate.durationMinutes) || (candidate.durationMinutes as number) < 1) errors.push(`sets[${setIndex}].durationMinutes is invalid`)
    if (!Array.isArray(candidate.topics) || candidate.topics.length === 0 || candidate.topics.some((topic) => !nonEmptyString(topic))) errors.push(`sets[${setIndex}].topics is required`)
    if (!['foundation', 'medium', 'advanced'].includes(String(candidate.difficulty))) errors.push(`sets[${setIndex}].difficulty is invalid`)
    if (!Number.isFinite(candidate.estimatedBand) || (candidate.estimatedBand as number) < 0 || (candidate.estimatedBand as number) > 9) errors.push(`sets[${setIndex}].estimatedBand is invalid`)

    if (!isRecord(candidate.provenance)) errors.push(`sets[${setIndex}].provenance is required`)
    else {
      if (!['original', 'public-domain', 'licensed'].includes(String(candidate.provenance.kind))) errors.push(`sets[${setIndex}].provenance.kind is invalid`)
      for (const key of ['author', 'note', 'license'] as const) if (!nonEmptyString(candidate.provenance[key])) errors.push(`sets[${setIndex}].provenance.${key} is required`)
    }
    if (!isRecord(candidate.passage) || !Array.isArray(candidate.passage.sections)) { errors.push(`sets[${setIndex}].passage.sections is required`); return }
    if (!nonEmptyString(candidate.passage.title)) errors.push(`sets[${setIndex}].passage.title is required`)
    if (!nonEmptyString(candidate.passage.deck)) errors.push(`sets[${setIndex}].passage.deck is required`)
    const sections = candidate.passage.sections
    if (sections.length === 0) errors.push(`sets[${setIndex}].passage.sections is required`)
    sections.forEach((section, sectionIndex) => {
      if (!isRecord(section) || !nonEmptyString(section.heading) || !Array.isArray(section.paragraphs) || section.paragraphs.length === 0 || section.paragraphs.some((paragraph) => !nonEmptyString(paragraph))) errors.push(`sets[${setIndex}].passage.sections[${sectionIndex}] is invalid`)
    })
    if (!Array.isArray(candidate.questions) || candidate.questions.length === 0) { errors.push(`sets[${setIndex}].questions is required`); return }

    candidate.questions.forEach((question, questionIndex) => {
      if (!isRecord(question)) { errors.push(`sets[${setIndex}].questions[${questionIndex}] must be an object`); return }
      if (!nonEmptyString(question.id)) errors.push(`question id is required at ${setIndex}:${questionIndex}`)
      else if (seenQuestionIds.has(question.id)) errors.push(`duplicate question id: ${question.id}`)
      else seenQuestionIds.add(question.id)
      if (!supportedTypes.has(question.type as QuestionType)) errors.push(`unsupported question type at ${setIndex}:${questionIndex}`)
      const type = question.type as QuestionType
      if (optionTypes.has(type)) {
        if (!Array.isArray(question.options) || question.options.length < 2 || question.options.some((option) => !isRecord(option) || !nonEmptyString(option.key) || !nonEmptyString(option.label))) errors.push(`options are required at ${setIndex}:${questionIndex}`)
      }
      if (type === 'multiple-select' && (!Number.isInteger(question.selectLimit) || (question.selectLimit as number) < 2 || !Array.isArray(question.options) || (question.selectLimit as number) > question.options.length)) errors.push(`selectLimit is invalid at ${setIndex}:${questionIndex}`)
      if (wordLimitTypes.has(type) && (!Number.isInteger(question.wordLimit) || (question.wordLimit as number) < 1)) errors.push(`wordLimit is invalid at ${setIndex}:${questionIndex}`)
      if (type === 'sentence-completion' && !nonEmptyString(question.beforeBlank)) errors.push(`beforeBlank is required at ${setIndex}:${questionIndex}`)
      if (type === 'diagram-label' && !nonEmptyString(question.diagramDescription)) errors.push(`diagramDescription is required at ${setIndex}:${questionIndex}`)
      if (!Array.isArray(question.acceptedAnswers) || question.acceptedAnswers.length === 0 || question.acceptedAnswers.some((answer) => Array.isArray(answer) ? answer.length === 0 || answer.some((part) => !nonEmptyString(part)) : !nonEmptyString(answer))) errors.push(`acceptedAnswers are required at ${setIndex}:${questionIndex}`)
      if (!nonEmptyString(question.prompt)) errors.push(`question prompt is required at ${setIndex}:${questionIndex}`)
      if (!nonEmptyString(question.explanation)) errors.push(`question explanation is required at ${setIndex}:${questionIndex}`)
      if (!isRecord(question.sourceRef)) { errors.push(`sourceRef is required at ${setIndex}:${questionIndex}`); return }
      const sectionIndex = question.sourceRef.sectionIndex
      const paragraphIndex = question.sourceRef.paragraphIndex
      const section = typeof sectionIndex === 'number' ? sections[sectionIndex] : undefined
      const paragraphs = isRecord(section) && Array.isArray(section.paragraphs) ? section.paragraphs : []
      if (!Number.isInteger(sectionIndex) || !Number.isInteger(paragraphIndex) || (paragraphIndex as number) < 0 || !paragraphs[paragraphIndex as number]) errors.push(`sourceRef is outside the passage at ${setIndex}:${questionIndex}`)
    })
  })

  if (errors.length) return { ok: false, errors }
  return { ok: true, value: normalize(input) }
}
