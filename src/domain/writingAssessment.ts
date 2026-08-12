export const WRITING_PROMPT_VERSION = 'writing-v1' as const

export type WritingTaskType = 'task-1' | 'task-2'
export type WritingCriterionId =
  | 'task-response'
  | 'coherence-cohesion'
  | 'lexical-resource'
  | 'grammatical-range-accuracy'

export interface WritingVisualSeries {
  name: string
  values: number[]
}

export interface WritingVisualData {
  title: string
  unit: string
  categories: string[]
  series: WritingVisualSeries[]
}

export interface WritingTask {
  id: string
  type: WritingTaskType
  sequence: string
  eyebrow: string
  title: string
  prompt: string
  instructions: string
  recommendedMinutes: number
  minimumWords: number
  focus: string[]
  demoEssay: string
  visualData?: WritingVisualData
  provenance: {
    kind: 'original'
    author: 'IELTS Pilot'
    license: string
    note: string
  }
}

export interface WritingMessage {
  role: 'system' | 'user'
  content: string
}

export interface WritingCriterion {
  criterion: WritingCriterionId
  band: number
  rationale: string
}

export interface WritingEvidence {
  criterion: WritingCriterionId
  quote: string
  observation: string
  revision: string
}

export interface ParsedWritingAssessment {
  overallBand: number
  summary: string
  criteria: WritingCriterion[]
  strengths: string[]
  priorities: string[]
  evidence: WritingEvidence[]
}

export interface WritingAssessmentReport extends ParsedWritingAssessment {
  id: string
  taskId: string
  taskType: WritingTaskType
  essay: string
  wordCount: number
  model: string
  promptVersion: typeof WRITING_PROMPT_VERSION
  generatedAt: string
  requestId?: string
}

export interface WritingDraft {
  taskId: string
  essay: string
  elapsedSeconds: number
  updatedAt: string
}

export const WRITING_CRITERIA: ReadonlyArray<{ id: WritingCriterionId; label: string }> = [
  { id: 'task-response', label: '任务回应' },
  { id: 'coherence-cohesion', label: '连贯与衔接' },
  { id: 'lexical-resource', label: '词汇资源' },
  { id: 'grammatical-range-accuracy', label: '语法多样性与准确性' },
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredText(value: unknown, field: string, maximum = 1_200): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Writing assessment ${field} must be a non-empty string.`)
  return value.trim().slice(0, maximum)
}

function boundedTextList(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new Error(`Writing assessment ${field} must be an array.`)
  return value.slice(0, 5).map((item) => requiredText(item, field, 360))
}

function criterionId(value: unknown): WritingCriterionId {
  const match = WRITING_CRITERIA.find(({ id }) => id === value)
  if (!match) throw new Error('Writing assessment criterion is unknown.')
  return match.id
}

function band(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 9 || value * 2 !== Math.round(value * 2)) {
    throw new Error('Writing assessment band must be between 0 and 9 in half-band steps.')
  }
  return value
}

export function countWritingWords(value: string): number {
  return value.match(/\p{N}+(?:[,.]\p{N}+)*|\p{L}+(?:['’\-]\p{L}+)*/gu)?.length ?? 0
}

export function calculateOverallBand(values: number[]): number {
  if (values.length !== 4) throw new Error('Writing assessment requires exactly four criterion bands.')
  values.forEach(band)
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  return Math.round(average * 2) / 2
}

export function buildWritingMessages(task: WritingTask, essay: string): WritingMessage[] {
  const taskLabel = task.type === 'task-1' ? 'Task Achievement' : 'Task Response'
  const system = `You are an IELTS writing practice assistant. Your output is learning feedback, not an official IELTS score. Evaluate only the submitted text and task. Use these four public-descriptor dimensions: ${taskLabel}, Coherence and Cohesion, Lexical Resource, and Grammatical Range and Accuracy. Return JSON only, with no markdown commentary. The exact schema is {"summary":"...","criteria":[{"criterion":"task-response|coherence-cohesion|lexical-resource|grammatical-range-accuracy","band":0,"rationale":"..."}],"strengths":["..."],"priorities":["..."],"evidence":[{"criterion":"...","quote":"exact substring from essay","observation":"...","revision":"..."}]}. Include each criterion exactly once, use only 0.5 band increments from 0 to 9, provide three strengths and three priorities, and use only exact essay substrings as evidence quotes.`
  const chart = task.visualData ? `\nStructured visual data: ${JSON.stringify(task.visualData)}` : ''
  const user = `Prompt version: ${WRITING_PROMPT_VERSION}\nTask type: ${task.type}\nTask prompt: ${task.prompt}\nInstructions: ${task.instructions}${chart}\nSubmitted word count: ${countWritingWords(essay)}\n\nEssay:\n${essay}`
  return [{ role: 'system', content: system }, { role: 'user', content: user }]
}

function extractJson(value: string): unknown {
  const trimmed = value.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1]
  const candidate = fenced ?? trimmed
  try { return JSON.parse(candidate) as unknown } catch {
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start < 0 || end <= start) throw new Error('Writing assessment response does not contain JSON.')
    try { return JSON.parse(candidate.slice(start, end + 1)) as unknown } catch { throw new Error('Writing assessment response contains invalid JSON.') }
  }
}

export function parseWritingAssessment(content: string, essay: string): ParsedWritingAssessment {
  const raw = extractJson(content)
  if (!isRecord(raw) || !Array.isArray(raw.criteria)) throw new Error('Writing assessment response is missing criteria.')
  const criteria = raw.criteria.map((item): WritingCriterion => {
    if (!isRecord(item)) throw new Error('Writing assessment criterion must be an object.')
    return {
      criterion: criterionId(item.criterion),
      band: band(item.band),
      rationale: requiredText(item.rationale, 'criterion rationale', 600),
    }
  })
  const expected = WRITING_CRITERIA.map(({ id }) => id)
  const actual = new Set(criteria.map(({ criterion }) => criterion))
  if (criteria.length !== expected.length || expected.some((id) => !actual.has(id))) {
    throw new Error('Writing assessment must include each criterion exactly once.')
  }
  const evidenceRaw = Array.isArray(raw.evidence) ? raw.evidence : []
  const evidence = evidenceRaw.slice(0, 8).flatMap((item): WritingEvidence[] => {
    if (!isRecord(item)) return []
    const quote = typeof item.quote === 'string' ? item.quote.trim() : ''
    if (!quote || !essay.includes(quote)) return []
    try {
      return [{
        criterion: criterionId(item.criterion), quote: quote.slice(0, 500),
        observation: requiredText(item.observation, 'evidence observation', 600),
        revision: requiredText(item.revision, 'evidence revision', 600),
      }]
    } catch { return [] }
  })
  return {
    overallBand: calculateOverallBand(criteria.map(({ band: score }) => score)),
    summary: requiredText(raw.summary, 'summary', 1_000),
    criteria,
    strengths: boundedTextList(raw.strengths, 'strengths'),
    priorities: boundedTextList(raw.priorities, 'priorities'),
    evidence,
  }
}
