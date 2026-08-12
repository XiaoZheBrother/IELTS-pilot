import {
  buildLocalCoachAnswer,
  buildCoachStreamPreview,
  formatCoachAnswer,
  parseCoachAnswer,
  type CoachEvidenceEntry,
} from '../../src/domain/coachAnswer'
import regressionCases from '../fixtures/assistant/coach-regressions.json'

const catalog: CoachEvidenceEntry[] = [
  { id: 'reading.attempt_count', label: '练习记录', value: '3 次', sampleSize: 3, confidence: 'high' },
  { id: 'reading.average_band', label: '平均估算', value: 'Band 6.8', sampleSize: 3, confidence: 'high' },
  { id: 'reading.weakest_type', label: '薄弱题型', value: '单项选择 57%（7 题）', sampleSize: 7, confidence: 'high' },
]

function response(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schemaVersion: 1,
    conclusion: { text: '当前优先提升单项选择。', confidence: 'high', evidenceIds: ['reading.weakest_type'] },
    facts: [{ text: '已完成 3 次练习。', evidenceIds: ['reading.attempt_count'] }],
    inferences: [{ text: '单项选择是当前最清晰的突破点。', confidence: 'high', evidenceIds: ['reading.weakest_type'] }],
    actions: [{ id: 'practice-weak-type', title: '开始选择题专项', reason: '针对最低正确率题型', kind: 'practice' }],
    ...overrides,
  })
}

describe('coach answer protocol', () => {
  it('parses a structured answer and formats the validated content', () => {
    const answer = parseCoachAnswer(response(), catalog)
    expect(answer.conclusion.confidence).toBe('high')
    expect(answer.actions).toHaveLength(1)
    expect(formatCoachAnswer(answer)).toContain('依据：已完成 3 次练习。')
  })

  it('rejects unknown evidence, provider URLs and unsupported confidence', () => {
    expect(() => parseCoachAnswer(response({ facts: [{ text: '未知事实', evidenceIds: ['unknown.fact'] }] }), catalog)).toThrow('未知证据')
    expect(() => parseCoachAnswer(response({ actions: [{ id: 'bad', title: '访问', reason: '任意地址', kind: 'practice', url: 'https://evil.test' }] }), catalog)).toThrow('不支持的字段')
    const insufficient = catalog.map((entry) => ({ ...entry, confidence: 'insufficient' as const }))
    expect(() => parseCoachAnswer(response(), insufficient)).toThrow('高可信')
  })

  it('rejects certainty language when cited samples are insufficient', () => {
    const sparse: CoachEvidenceEntry[] = [{ id: 'reading.attempt_count', label: '练习记录', value: '1 次', sampleSize: 1, confidence: 'insufficient' }]
    expect(() => parseCoachAnswer(response({
      conclusion: { text: '你的成绩已经稳定在 Band 7，一定可以提分。', confidence: 'insufficient', evidenceIds: ['reading.attempt_count'] },
      facts: [], inferences: [], actions: [],
    }), sparse)).toThrow('确定性表述')
  })

  it('allows cautious language that asks for more data before judging stability', () => {
    const answer = parseCoachAnswer(response({
      conclusion: { text: '增加一次练习后再判断是否已稳定在当前水平。', confidence: 'high', evidenceIds: ['reading.attempt_count'] },
    }), catalog)
    expect(answer.conclusion.text).toContain('判断是否')
  })

  it('builds a deterministic local fallback from the catalog', () => {
    const answer = buildLocalCoachAnswer(catalog)
    expect(answer.schemaVersion).toBe(1)
    expect(answer.conclusion.evidenceIds.length).toBeGreaterThan(0)
    expect(answer.actions.map(({ kind }) => kind)).toContain('practice')
  })

  it('normalizes a string protocol version and drops unsupported action kinds', () => {
    const answer = parseCoachAnswer(response({
      schemaVersion: '1',
      actions: [{ id: 'provider-label', title: '无效动作', reason: '不是本地类型', kind: 'reading.attempt_count' }],
    }), catalog)
    expect(answer.schemaVersion).toBe(1)
    expect(answer.actions).toEqual([])
  })

  it('extracts only readable text fields from an incomplete streamed JSON answer', () => {
    const preview = buildCoachStreamPreview('{"conclusion":{"text":"先处理标题配对"},"facts":[{"text":"当前正确率 40%')
    expect(preview).toContain('先处理标题配对')
    expect(preview).toContain('当前正确率 40%')
    expect(preview).not.toContain('conclusion')
  })

  it.each(regressionCases)('keeps regression case $name inside the evidence boundary', (fixture) => {
    const run = () => parseCoachAnswer(JSON.stringify(fixture.response), fixture.catalog as CoachEvidenceEntry[])
    if (fixture.valid) expect(run()).toMatchObject({ schemaVersion: 1 })
    else expect(run).toThrow(fixture.errorIncludes)
  })
})
