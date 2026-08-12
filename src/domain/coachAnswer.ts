export type CoachConfidence = 'insufficient' | 'medium' | 'high'
export type CoachActionKind = 'practice' | 'errors' | 'writing' | 'plan'

export interface CoachEvidenceEntry {
  id: string
  label: string
  value: string
  sampleSize: number
  confidence: CoachConfidence
}

export interface CoachAnswerClaim {
  text: string
  evidenceIds: string[]
}

export interface CoachAnswerInference extends CoachAnswerClaim {
  confidence: CoachConfidence
}

export interface CoachAnswerAction {
  id: string
  title: string
  reason: string
  kind: CoachActionKind
  targetId?: string
}

export interface CoachAnswer {
  schemaVersion: 1
  conclusion: CoachAnswerInference
  facts: CoachAnswerClaim[]
  inferences: CoachAnswerInference[]
  actions: CoachAnswerAction[]
}

const CERTAINTY_PATTERN = /(?:已经稳定|成绩稳定|一定|保证|必然|肯定|绝对|稳上|必定)/u
const CAUTIOUS_OUTCOME_CONTEXT = /(?:不足以|无法|不能|尚不能|不代表|判断是否|验证是否|检查是否)[^。；]{0,24}(?:稳定(?:到|在)?|提分)/gu
const UNSUPPORTED_OUTCOME_PATTERN = /(?:成绩(?:已|已经)稳定|稳定(?:到|在)\s*(?:Band|[0-9])|(?:一定|保证|必然|肯定|绝对|必定)[^。；]{0,12}(?:提分|提升|达到)|有望[^。；]{0,16}(?:提分|提升|达到|稳定到)|稳上|最容易[^。；]{0,8}提分|提分效果)/u
const CONFIDENCES = new Set<CoachConfidence>(['insufficient', 'medium', 'high'])
const ACTION_KINDS = new Set<CoachActionKind>(['practice', 'errors', 'writing', 'plan'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, expected: string[]): void {
  if (Object.keys(value).some((key) => !expected.includes(key))) throw new Error('AI 回答包含不支持的字段。')
}

function text(value: unknown, field: string, maximum = 600): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`AI 回答的${field}不能为空。`)
  return value.trim().slice(0, maximum)
}

function confidence(value: unknown): CoachConfidence {
  if (!CONFIDENCES.has(value as CoachConfidence)) throw new Error('AI 回答可信度无效。')
  return value as CoachConfidence
}

export function containsUnsupportedOutcomePrediction(value: string): boolean {
  const withoutCautiousContext = value.replace(CAUTIOUS_OUTCOME_CONTEXT, '')
  return UNSUPPORTED_OUTCOME_PATTERN.test(withoutCautiousContext)
}

function rejectUnsupportedOutcome(value: string): void {
  if (containsUnsupportedOutcomePrediction(value)) {
    throw new Error('AI 回答包含没有本地证据支持的结果预测。')
  }
}

function evidenceIds(value: unknown, known: Map<string, CoachEvidenceEntry>): string[] {
  if (!Array.isArray(value) || value.length > 6) throw new Error('AI 回答证据列表无效。')
  return value.map((id) => {
    if (typeof id !== 'string' || !known.has(id)) throw new Error('AI 回答引用了未知证据。')
    return id
  })
}

function claim(value: unknown, known: Map<string, CoachEvidenceEntry>): CoachAnswerClaim {
  if (!isRecord(value)) throw new Error('AI 回答事实格式无效。')
  exactKeys(value, ['text', 'evidenceIds'])
  return { text: text(value.text, '事实'), evidenceIds: evidenceIds(value.evidenceIds, known) }
}

function inference(value: unknown, known: Map<string, CoachEvidenceEntry>): CoachAnswerInference {
  if (!isRecord(value)) throw new Error('AI 回答判断格式无效。')
  exactKeys(value, ['text', 'confidence', 'evidenceIds'])
  const parsed: CoachAnswerInference = { ...claim({ text: value.text, evidenceIds: value.evidenceIds }, known), confidence: confidence(value.confidence) }
  if (parsed.confidence === 'high' && !parsed.evidenceIds.some((id) => known.get(id)?.confidence === 'high')) {
    throw new Error('高可信判断缺少高可信证据。')
  }
  if (CERTAINTY_PATTERN.test(parsed.text) && parsed.evidenceIds.some((id) => known.get(id)?.confidence === 'insufficient')) {
    throw new Error('样本不足时不能使用确定性表述。')
  }
  rejectUnsupportedOutcome(parsed.text)
  return parsed
}

function action(value: unknown): CoachAnswerAction | null {
  if (!isRecord(value)) throw new Error('AI 回答行动格式无效。')
  exactKeys(value, ['id', 'title', 'reason', 'kind', 'targetId'])
  if (!ACTION_KINDS.has(value.kind as CoachActionKind)) return null
  const title = text(value.title, '行动标题', 100)
  const reason = text(value.reason, '行动原因', 240)
  rejectUnsupportedOutcome(`${title}。${reason}`)
  return {
    id: text(value.id, '行动编号', 100), title,
    reason, kind: value.kind as CoachActionKind,
    ...(typeof value.targetId === 'string' && value.targetId.trim() ? { targetId: value.targetId.trim().slice(0, 180) } : {}),
  }
}

function extractJson(content: string): unknown {
  const trimmed = content.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/iu)?.[1]
  const candidate = fenced ?? trimmed
  try { return JSON.parse(candidate) as unknown } catch { throw new Error('AI 回答不是有效 JSON。') }
}

export function parseCoachAnswer(content: string, catalog: CoachEvidenceEntry[]): CoachAnswer {
  const raw = extractJson(content)
  if (!isRecord(raw)) throw new Error('AI 回答结构无效。')
  exactKeys(raw, ['schemaVersion', 'conclusion', 'facts', 'inferences', 'actions'])
  if ((raw.schemaVersion !== 1 && raw.schemaVersion !== '1') || !Array.isArray(raw.facts) || !Array.isArray(raw.inferences) || !Array.isArray(raw.actions)) {
    throw new Error('AI 回答协议版本或列表无效。')
  }
  const known = new Map(catalog.map((entry) => [entry.id, entry]))
  return {
    schemaVersion: 1,
    conclusion: inference(raw.conclusion, known),
    facts: raw.facts.slice(0, 5).map((item) => claim(item, known)),
    inferences: raw.inferences.slice(0, 4).map((item) => inference(item, known)),
    actions: raw.actions.slice(0, 3).map(action).filter((item): item is CoachAnswerAction => Boolean(item)),
  }
}

export function formatCoachAnswer(answer: CoachAnswer): string {
  const facts = answer.facts.map(({ text: value }) => value).join('；')
  const actions = answer.actions.map(({ title, reason }, index) => `${index + 1}. ${title}：${reason}`).join('\n')
  return [`结论：${answer.conclusion.text}`, facts ? `依据：${facts}` : '', actions ? `建议：\n${actions}` : ''].filter(Boolean).join('\n\n')
}

export function buildCoachStreamPreview(content: string): string {
  const values: string[] = []
  const pattern = /"(?:text|title|reason)"\s*:\s*"((?:\\.|[^"\\])*)(?:"|$)/gu
  for (const match of content.slice(0, 20_000).matchAll(pattern)) {
    const raw = match[1] ?? ''
    let value = raw
    try { value = JSON.parse(`"${raw}"`) as string } catch { value = raw.replace(/\\n/gu, '\n').replace(/\\"/gu, '"') }
    const bounded = value.trim().slice(0, 600)
    if (bounded && !values.includes(bounded)) values.push(bounded)
  }
  return values.slice(0, 8).join('\n\n')
}

export function buildLocalCoachAnswer(catalog: CoachEvidenceEntry[]): CoachAnswer {
  const byId = new Map(catalog.map((entry) => [entry.id, entry]))
  const weak = byId.get('reading.weakest_type')
  const count = byId.get('reading.attempt_count')
  const primary = weak ?? count ?? catalog[0]
  if (!primary) return {
    schemaVersion: 1,
    conclusion: { text: '当前没有足够数据形成可靠判断。', confidence: 'insufficient', evidenceIds: [] },
    facts: [], inferences: [], actions: [{ id: 'practice-baseline', title: '完成一次计时练习', reason: '建立第一份可比较的学习基线', kind: 'practice' }],
  }
  return {
    schemaVersion: 1,
    conclusion: {
      text: weak ? `${weak.label}是当前最值得优先处理的方向。` : '先继续积累练习样本，再判断稳定趋势。',
      confidence: primary.confidence,
      evidenceIds: [primary.id],
    },
    facts: catalog.slice(0, 3).map((entry) => ({ text: `${entry.label}为${entry.value}。`, evidenceIds: [entry.id] })),
    inferences: [],
    actions: weak
      ? [{ id: 'practice-weak-type', title: '开始薄弱题型专项', reason: `围绕${weak.value}建立新的可比较样本`, kind: 'practice' }]
      : [{ id: 'practice-baseline', title: '继续计时练习', reason: '积累至少三次可比较成绩', kind: 'practice' }],
  }
}
