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

  it.each([
    ['Could not connect to the AI provider.', 'NETWORK_ERROR', '无法连接'],
    ['AI provider request timed out.', 'UPSTREAM_TIMEOUT', '超时'],
    ['AI provider rate limit reached. Please retry later.', 'UPSTREAM_RATE_LIMIT', '请求过于频繁'],
    ['AI provider returned HTTP 401.', 'INVALID_CREDENTIAL', '密钥'],
  ])('maps desktop failure %s to %s', async (message, code, readable) => {
    const client = createLearningAssistantClient({ desktop: true, invoke: async () => { throw message } })
    const failure = await client.chat(request, settings).catch((error: unknown) => error)
    expect(failure).toMatchObject({ code })
    expect((failure as Error).message).toContain(readable)
  })

  it('preserves a readable desktop connection-test error returned as a Tauri string', async () => {
    const client = createLearningAssistantClient({ desktop: true, invoke: async () => { throw 'AI provider returned HTTP 401.' } })
    await expect(client.testConnection(settings)).resolves.toEqual({ ok: false, error: 'AI provider returned HTTP 401.' })
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

  it('streams provider deltas and returns verified completion metadata on web', async () => {
    const encoder = new TextEncoder()
    const fetcher = vi.fn(async () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('{"type":"delta","delta":"{\\"schema"}\n'))
        controller.enqueue(encoder.encode('{"type":"delta","delta":"Version\\":1}"}\n'))
        controller.enqueue(encoder.encode('{"type":"done","response":{"content":"{\\"schemaVersion\\":1}","model":"fixture","requestId":"stream-1","usage":{"promptTokens":8,"completionTokens":4,"totalTokens":12}}}\n'))
        controller.close()
      },
    }), { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } }))
    const deltas: string[] = []
    const client = createLearningAssistantClient({ desktop: false, fetcher })
    const response = await client.chatStream(request, settings, { onDelta: (delta) => deltas.push(delta) })
    expect(deltas.join('')).toBe('{"schemaVersion":1}')
    expect(response).toMatchObject({ requestId: 'stream-1', usage: { totalTokens: 12 } })
    expect(fetcher).toHaveBeenCalledWith('/api/v1/assistant/chat/stream', expect.objectContaining({ method: 'POST' }))
  })

  it('uses a Tauri channel for desktop streaming without exposing credentials', async () => {
    let channel: { onmessage?: (event: unknown) => void } | undefined
    const invoked: Array<{ command: string; args?: Record<string, unknown> }> = []
    const client = createLearningAssistantClient({
      desktop: true,
      createChannel: () => (channel = {}),
      invoke: async (command, args) => {
        invoked.push({ command, args })
        channel?.onmessage?.({ type: 'delta', delta: '桌面增量' })
        return { content: '桌面增量', model: 'fixture', requestId: 'desktop-stream', usage: { totalTokens: 5 } }
      },
    })
    const deltas: string[] = []
    await expect(client.chatStream(request, settings, { onDelta: (delta) => deltas.push(delta) })).resolves.toMatchObject({ requestId: 'desktop-stream' })
    expect(deltas).toEqual(['桌面增量'])
    expect(invoked[0]?.command).toBe('chat_assistant_stream')
    expect(JSON.stringify(invoked)).not.toMatch(/apiKey|authorization|bearer|secret/i)
  })

  it('cancels the active Tauri stream when the user stops generation', async () => {
    const commands: Array<{ command: string; args?: Record<string, unknown> }> = []
    const client = createLearningAssistantClient({
      desktop: true, createChannel: () => ({}),
      invoke: async (command, args) => {
        commands.push({ command, args })
        if (command === 'chat_assistant_stream') return await new Promise<never>(() => undefined)
        return true
      },
    })
    const controller = new AbortController()
    const pending = client.chatStream(request, settings, { signal: controller.signal, onDelta: () => undefined })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ code: 'ABORTED' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    const start = commands.find(({ command }) => command === 'chat_assistant_stream')!
    const cancel = commands.find(({ command }) => command === 'cancel_assistant_stream')!
    expect(cancel.args?.requestId).toBe((start.args?.payload as Record<string, unknown>).requestId)
  })
})
