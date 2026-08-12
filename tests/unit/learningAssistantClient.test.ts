import {
  LearningAssistantClientError,
  createLearningAssistantClient,
  type AssistantChatRequest,
} from '../../src/platform/learningAssistantClient'

const request: AssistantChatRequest = {
  messages: [
    { role: 'system', content: 'Use only the supplied facts.' },
    { role: 'user', content: '{"question":"分析状态"}' },
  ],
}
const settings = { endpoint: 'https://api.example.com/v1/chat/completions', model: 'coach-model' }

describe('learning assistant client', () => {
  it('uses the same-origin gateway on web without browser credentials', async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = []
    const client = createLearningAssistantClient({
      desktop: false,
      fetcher: async (input, init) => {
        calls.push({ input: String(input), ...(init ? { init } : {}) })
        if (String(input).endsWith('/health')) return new Response(JSON.stringify({ available: true, mode: 'gateway', model: 'gateway-model' }), { status: 200 })
        return new Response(JSON.stringify({ content: '先巩固标题配对。', model: 'gateway-model', requestId: 'assistant-1' }), { status: 200 })
      },
    })

    await expect(client.checkAvailability(settings)).resolves.toMatchObject({ available: true, mode: 'gateway', model: 'gateway-model' })
    await expect(client.chat(request, settings)).resolves.toMatchObject({ content: '先巩固标题配对。', requestId: 'assistant-1' })
    expect(calls.map(({ input }) => input)).toEqual(['/api/v1/assistant/health', '/api/v1/assistant/chat'])
    expect(JSON.stringify(calls)).not.toMatch(/apiKey|authorization|bearer|secret/i)
  })

  it('keeps the saved credential behind the desktop invoke boundary', async () => {
    const invoked: Array<{ command: string; args?: Record<string, unknown> }> = []
    const client = createLearningAssistantClient({
      desktop: true,
      invoke: async (command, args) => {
        invoked.push({ command, ...(args ? { args } : {}) })
        if (command === 'get_ai_settings_status') return { hasKey: true }
        if (command === 'chat_assistant') return { content: '桌面回复', model: 'coach-model', requestId: 'desktop-1' }
        if (command === 'test_ai_connection') return { ok: true, model: 'coach-model', latencyMs: 120 }
        return null
      },
    })

    await expect(client.checkAvailability(settings)).resolves.toMatchObject({ available: true, mode: 'desktop' })
    await expect(client.chat(request, settings)).resolves.toMatchObject({ content: '桌面回复' })
    await expect(client.testConnection(settings)).resolves.toMatchObject({ ok: true, latencyMs: 120 })
    expect(invoked.find(({ command }) => command === 'chat_assistant')?.args).toMatchObject({ payload: { endpoint: settings.endpoint, model: settings.model } })
    expect(JSON.stringify(invoked)).not.toMatch(/apiKey|authorization|bearer|secret/i)
  })

  it('sends a new credential only to the desktop credential command', async () => {
    const invoked: Array<{ command: string; args?: Record<string, unknown> }> = []
    const client = createLearningAssistantClient({ desktop: true, invoke: async (command, args) => { invoked.push({ command, ...(args ? { args } : {}) }); return null } })
    await client.saveCredential('temporary-secret')
    await client.clearCredential()

    expect(invoked).toEqual([
      { command: 'save_ai_credential', args: { apiKey: 'temporary-secret' } },
      { command: 'clear_ai_credential' },
    ])
  })

  it('maps provider failures to typed recoverable errors', async () => {
    const client = createLearningAssistantClient({ desktop: false, fetcher: async () => new Response(JSON.stringify({ code: 'UPSTREAM_RATE_LIMIT', message: '稍后重试' }), { status: 429 }) })
    const failure = await client.chat(request, settings).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(LearningAssistantClientError)
    expect(failure).toMatchObject({ code: 'UPSTREAM_RATE_LIMIT', recoverable: true })
  })

  it('passes an abort signal to web fetch and maps cancellation', async () => {
    let observedSignal: AbortSignal | undefined
    const client = createLearningAssistantClient({ desktop: false, fetcher: async (_input, init) => {
      observedSignal = init?.signal ?? undefined
      return await new Promise<Response>((_resolve, reject) => observedSignal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true }))
    } })
    const controller = new AbortController()
    const pending = client.chat(request, settings, { signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ code: 'ABORTED' })
    expect(observedSignal).toBe(controller.signal)
  })
})
