import {
  WritingAssessmentClientError,
  createWritingAssessmentClient,
  type WritingEvaluationRequest,
} from '../../src/platform/writingAssessmentClient'

const request: WritingEvaluationRequest = {
  taskId: 'academic-task-2-library-balance', taskType: 'task-2', promptVersion: 'writing-v1',
  prompt: 'Discuss both views and give your opinion.', essay: 'A sufficiently long demonstration essay for the transport contract.', wordCount: 80,
  messages: [{ role: 'system', content: 'Return JSON only.' }, { role: 'user', content: 'Evaluate this essay.' }],
}

describe('writing assessment client', () => {
  it('checks the same-origin web gateway and evaluates without accepting a browser credential', async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = []
    const fetcher: typeof fetch = async (input, init) => {
      calls.push({ input: String(input), ...(init ? { init } : {}) })
      if (String(input).endsWith('/health')) return new Response(JSON.stringify({ available: true, mode: 'gateway', model: 'demo' }), { status: 200 })
      return new Response(JSON.stringify({ content: '{"ok":true}', model: 'demo', requestId: 'req-1' }), { status: 200 })
    }
    const client = createWritingAssessmentClient({ fetcher, desktop: false })
    await expect(client.checkAvailability()).resolves.toMatchObject({ available: true, model: 'demo' })
    await expect(client.evaluate(request)).resolves.toMatchObject({ model: 'demo', requestId: 'req-1' })
    expect(calls.map(({ input }) => input)).toEqual(['/api/v1/writing/health', '/api/v1/writing/evaluate'])
    expect(JSON.stringify(calls)).not.toMatch(/apiKey|authorization|bearer/i)
  })

  it('passes ephemeral configuration only to the desktop invoke adapter', async () => {
    const invoked: unknown[][] = []
    const client = createWritingAssessmentClient({
      desktop: true,
      invoke: async (_command, args) => { invoked.push([_command, args]); return { content: '{}', model: 'desktop-model', requestId: 'desktop-1' } },
    })
    await expect(client.checkAvailability()).resolves.toMatchObject({ available: false, reason: 'configuration-required' })
    await client.evaluate(request, { endpoint: 'https://example.com/chat/completions', apiKey: 'temporary-secret', model: 'desktop-model' })
    expect(invoked[0]?.[0]).toBe('evaluate_writing')
    expect(invoked[0]?.[1]).toMatchObject({ apiKey: 'temporary-secret', model: 'desktop-model' })
  })

  it('maps gateway error codes to typed recoverable failures', async () => {
    const client = createWritingAssessmentClient({
      desktop: false,
      fetcher: async () => new Response(JSON.stringify({ code: 'UPSTREAM_RATE_LIMIT', message: 'Please retry later.' }), { status: 429 }),
    })
    const failure = await client.evaluate(request).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(WritingAssessmentClientError)
    expect(failure).toMatchObject({ code: 'UPSTREAM_RATE_LIMIT', recoverable: true })
  })
})
