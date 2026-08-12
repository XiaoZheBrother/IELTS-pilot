import {
  WRITING_PROMPT_VERSION,
  buildWritingMessages,
  calculateOverallBand,
  countWritingWords,
  parseWritingAssessment,
} from '../../src/domain/writingAssessment'
import { writingTasks } from '../../src/data/writingTasks'

const essay = `Public libraries remain useful because they offer both digital access and quiet study space. Digital catalogues help readers find information quickly, while physical rooms give students a place to concentrate. A balanced library should therefore invest in both services.`

const validPayload = {
  summary: 'A clear position with relevant support, though development remains limited.',
  criteria: [
    { criterion: 'task-response', band: 6.5, rationale: 'The position is clear and relevant ideas are present.' },
    { criterion: 'coherence-cohesion', band: 6, rationale: 'The progression is logical but brief.' },
    { criterion: 'lexical-resource', band: 6.5, rationale: 'Vocabulary is appropriate with some flexibility.' },
    { criterion: 'grammatical-range-accuracy', band: 7, rationale: 'Sentences are accurate and easy to follow.' },
  ],
  strengths: ['Clear position', 'Relevant comparison', 'Accurate sentences'],
  priorities: ['Develop examples', 'Use more varied linking', 'Add a fuller conclusion'],
  evidence: [
    {
      criterion: 'task-response',
      quote: 'A balanced library should therefore invest in both services.',
      observation: 'This states a direct position.',
      revision: 'Keep this thesis and preview the two supporting reasons.',
    },
    {
      criterion: 'lexical-resource',
      quote: 'This sentence is not in the essay.',
      observation: 'This must be removed.',
      revision: 'No revision.',
    },
  ],
}

describe('writing assessment domain', () => {
  it('counts English words without treating punctuation or repeated whitespace as words', () => {
    expect(countWritingWords("Libraries' quiet rooms—when available—help 1,200 students." )).toBe(8)
    expect(countWritingWords('  one\n\n two\tthree  ')).toBe(3)
  })

  it('calculates a nearest-half overall band from the four program-validated criteria', () => {
    expect(calculateOverallBand([6, 6.5, 7, 7])).toBe(6.5)
    expect(calculateOverallBand([6.5, 6.5, 7, 7])).toBe(7)
    expect(() => calculateOverallBand([6, 7, 8])).toThrow(/four/i)
  })

  it('extracts fenced JSON, recalculates the overall band and removes unverifiable evidence', () => {
    const report = parseWritingAssessment(`\n\`\`\`json\n${JSON.stringify({ ...validPayload, overallBand: 9 })}\n\`\`\``, essay)
    expect(report.overallBand).toBe(6.5)
    expect(report.criteria).toHaveLength(4)
    expect(report.evidence).toHaveLength(1)
    expect(essay).toContain(report.evidence[0]?.quote)
  })

  it('rejects incomplete rubrics and illegal band increments', () => {
    expect(() => parseWritingAssessment(JSON.stringify({ ...validPayload, criteria: validPayload.criteria.slice(0, 3) }), essay)).toThrow(/criterion/i)
    expect(() => parseWritingAssessment(JSON.stringify({ ...validPayload, criteria: validPayload.criteria.map((item, index) => index === 0 ? { ...item, band: 6.3 } : item) }), essay)).toThrow(/band/i)
  })

  it('builds a versioned rubric prompt that requires evidence and JSON only', () => {
    const messages = buildWritingMessages(writingTasks[1]!, essay)
    expect(WRITING_PROMPT_VERSION).toBe('writing-v1')
    expect(messages).toHaveLength(2)
    expect(messages[0]?.content).toContain('JSON')
    expect(messages[0]?.content).toContain('not an official IELTS score')
    expect(messages[1]?.content).toContain(essay)
    expect(messages[1]?.content).toContain(writingTasks[1]!.prompt)
  })
})
