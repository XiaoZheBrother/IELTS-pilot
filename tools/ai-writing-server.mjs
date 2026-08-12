import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadAiConfig, parseServerArgs } from './lib/ai-config.mjs'

const MAX_BODY_BYTES = 96 * 1024
const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'], ['.svg', 'image/svg+xml'], ['.png', 'image/png'], ['.ico', 'image/x-icon'],
])

function json(response, status, value, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers })
  response.end(JSON.stringify(value))
}

async function readBody(request) {
  const chunks = []
  let length = 0
  for await (const chunk of request) {
    length += chunk.length
    if (length > MAX_BODY_BYTES) {
      const error = new Error('Request body exceeds 96 KiB.')
      error.code = 'BODY_TOO_LARGE'
      throw error
    }
    chunks.push(chunk)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new Error('Request body must be valid JSON.') }
}

function validateEvaluation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Evaluation request must be an object.')
  if (value.taskType !== 'task-1' && value.taskType !== 'task-2') throw new Error('Writing task type is invalid.')
  if (value.promptVersion !== 'writing-v1') throw new Error('Writing prompt version is unsupported.')
  if (typeof value.essay !== 'string' || value.essay.length < 40 || value.essay.length > 20_000) throw new Error('Essay length is outside the supported range.')
  if (typeof value.prompt !== 'string' || value.prompt.length < 10 || value.prompt.length > 4_096) throw new Error('Task prompt length is outside the supported range.')
  if (!Array.isArray(value.messages) || value.messages.length !== 2) throw new Error('Evaluation messages are invalid.')
  const messages = value.messages.map((message) => {
    if (!message || typeof message !== 'object' || (message.role !== 'system' && message.role !== 'user') || typeof message.content !== 'string' || !message.content || message.content.length > 24_000) {
      throw new Error('Evaluation message is invalid.')
    }
    return { role: message.role, content: message.content }
  })
  return { messages }
}

async function evaluate(config, value, requestId) {
  const { messages } = validateEvaluation(value)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 90_000)
  try {
    const upstream = await fetch(config.endpoint, {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', 'X-Client-Request-Id': requestId },
      body: JSON.stringify({ model: config.model, messages, thinking: { type: 'disabled' }, temperature: 0.15, max_tokens: 2_800, response_format: { type: 'json_object' } }),
    })
    if (!upstream.ok) {
      const code = upstream.status === 429 ? 'UPSTREAM_RATE_LIMIT' : upstream.status >= 500 ? 'UPSTREAM_UNAVAILABLE' : 'UPSTREAM_REJECTED'
      const error = new Error(`AI provider returned HTTP ${upstream.status}.`)
      error.code = code
      error.status = upstream.status === 429 ? 429 : 502
      throw error
    }
    const raw = await upstream.json()
    const content = raw?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) {
      const error = new Error('AI provider returned no assessment content.')
      error.code = 'UPSTREAM_INVALID_RESPONSE'
      throw error
    }
    return {
      content, model: typeof raw.model === 'string' ? raw.model : config.model, requestId,
      usage: {
        promptTokens: Number(raw?.usage?.prompt_tokens) || 0,
        completionTokens: Number(raw?.usage?.completion_tokens) || 0,
        totalTokens: Number(raw?.usage?.total_tokens) || 0,
      },
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('AI provider request timed out.')
      timeoutError.code = 'UPSTREAM_TIMEOUT'
      throw timeoutError
    }
    throw error
  } finally { clearTimeout(timeout) }
}

function validateAssistantChat(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(value.messages)) throw new Error('Assistant request must include messages.')
  if (value.messages.length !== 2) throw new Error('Assistant request must include exactly two messages.')
  const messages = value.messages.map((message) => {
    if (!message || typeof message !== 'object' || (message.role !== 'system' && message.role !== 'user')
      || typeof message.content !== 'string' || !message.content.trim() || message.content.length > 24_000) {
      throw new Error('Assistant message is invalid.')
    }
    return { role: message.role, content: message.content }
  })
  return { messages }
}

async function chatAssistant(config, value, requestId) {
  const { messages } = validateAssistantChat(value)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 90_000)
  try {
    const upstream = await fetch(config.endpoint, {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', 'X-Client-Request-Id': requestId },
      body: JSON.stringify({ model: config.model, messages, thinking: { type: 'disabled' }, temperature: 0.25, max_tokens: 1_200, response_format: { type: 'json_object' } }),
    })
    if (!upstream.ok) {
      const code = upstream.status === 429 ? 'UPSTREAM_RATE_LIMIT' : upstream.status >= 500 ? 'UPSTREAM_UNAVAILABLE' : 'UPSTREAM_REJECTED'
      const error = new Error(`AI provider returned HTTP ${upstream.status}.`)
      error.code = code
      error.status = upstream.status === 429 ? 429 : 502
      throw error
    }
    const raw = await upstream.json()
    const content = raw?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) {
      const error = new Error('AI provider returned no assistant content.')
      error.code = 'UPSTREAM_INVALID_RESPONSE'
      throw error
    }
    return {
      content, model: typeof raw.model === 'string' ? raw.model : config.model, requestId: typeof raw.id === 'string' ? raw.id : requestId,
      usage: {
        promptTokens: Number(raw?.usage?.prompt_tokens) || 0,
        completionTokens: Number(raw?.usage?.completion_tokens) || 0,
        totalTokens: Number(raw?.usage?.total_tokens) || 0,
      },
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('AI provider request timed out.')
      timeoutError.code = 'UPSTREAM_TIMEOUT'
      throw timeoutError
    }
    throw error
  } finally { clearTimeout(timeout) }
}

function assistantResponse(raw, config, requestId, content) {
  return {
    content,
    model: typeof raw?.model === 'string' ? raw.model : config.model,
    requestId: typeof raw?.id === 'string' ? raw.id : requestId,
    usage: {
      promptTokens: Number(raw?.usage?.prompt_tokens) || 0,
      completionTokens: Number(raw?.usage?.completion_tokens) || 0,
      totalTokens: Number(raw?.usage?.total_tokens) || 0,
    },
  }
}

async function streamAssistant(config, value, requestId, response) {
  const { messages } = validateAssistantChat(value)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 90_000)
  const cancel = () => controller.abort()
  response.once('close', cancel)
  try {
    const upstream = await fetch(config.endpoint, {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', 'X-Client-Request-Id': requestId },
      body: JSON.stringify({
        model: config.model, messages, thinking: { type: 'disabled' }, temperature: 0.25, max_tokens: 1_200,
        response_format: { type: 'json_object' }, stream: true, stream_options: { include_usage: true },
      }),
    })
    if (!upstream.ok) {
      const error = new Error(`AI provider returned HTTP ${upstream.status}.`)
      error.code = upstream.status === 429 ? 'UPSTREAM_RATE_LIMIT' : upstream.status >= 500 ? 'UPSTREAM_UNAVAILABLE' : 'UPSTREAM_REJECTED'
      error.status = upstream.status === 429 ? 429 : 502
      throw error
    }
    response.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' })
    const emit = (event) => response.write(`${JSON.stringify(event)}\n`)
    const contentType = upstream.headers.get('content-type') ?? ''
    if (!contentType.includes('text/event-stream')) {
      const raw = await upstream.json()
      const content = raw?.choices?.[0]?.message?.content
      if (typeof content !== 'string' || !content.trim()) throw Object.assign(new Error('AI provider returned no assistant content.'), { code: 'UPSTREAM_INVALID_RESPONSE' })
      emit({ type: 'delta', delta: content })
      const result = assistantResponse(raw, config, requestId, content)
      emit({ type: 'done', response: result })
      response.end()
      return result
    }

    if (!upstream.body) throw Object.assign(new Error('AI provider returned no response stream.'), { code: 'UPSTREAM_INVALID_RESPONSE' })
    const decoder = new TextDecoder()
    let buffered = ''
    let content = ''
    let metadata = {}
    const consume = (line) => {
      const data = line.startsWith('data:') ? line.slice(5).trim() : ''
      if (!data || data === '[DONE]') return
      let raw
      try { raw = JSON.parse(data) } catch { throw Object.assign(new Error('AI provider returned invalid stream data.'), { code: 'UPSTREAM_INVALID_RESPONSE' }) }
      metadata = {
        ...metadata,
        ...(typeof raw.id === 'string' ? { id: raw.id } : {}),
        ...(typeof raw.model === 'string' ? { model: raw.model } : {}),
        ...(raw.usage && typeof raw.usage === 'object' ? { usage: raw.usage } : {}),
      }
      const delta = raw?.choices?.[0]?.delta?.content
      if (typeof delta === 'string' && delta) { content += delta; emit({ type: 'delta', delta }) }
    }
    for await (const chunk of upstream.body) {
      buffered += decoder.decode(chunk, { stream: true })
      const lines = buffered.split(/\r?\n/u)
      buffered = lines.pop() ?? ''
      lines.forEach(consume)
    }
    buffered += decoder.decode()
    if (buffered.trim()) consume(buffered)
    if (!content.trim()) throw Object.assign(new Error('AI provider returned no assistant content.'), { code: 'UPSTREAM_INVALID_RESPONSE' })
    const result = assistantResponse(metadata, config, requestId, content)
    emit({ type: 'done', response: result })
    response.end()
    return result
  } catch (error) {
    const failure = error?.name === 'AbortError'
      ? Object.assign(new Error('AI provider request timed out or was stopped.'), { code: 'UPSTREAM_TIMEOUT' })
      : error
    if (response.headersSent) {
      if (!response.writableEnded) response.end(`${JSON.stringify({ type: 'error', code: failure?.code || 'UPSTREAM_ERROR', message: failure instanceof Error ? failure.message : 'AI stream failed.' })}\n`)
      return null
    }
    throw failure
  } finally {
    clearTimeout(timeout)
    response.off('close', cancel)
  }
}

async function serveStatic(distRoot, pathname, response, spaFallback = true) {
  const decoded = decodeURIComponent(pathname)
  const requested = resolve(distRoot, `.${decoded}`)
  if (requested !== distRoot && !requested.startsWith(`${distRoot}${sep}`)) return false
  let target = requested
  try {
    const metadata = await stat(target)
    if (metadata.isDirectory()) target = resolve(target, 'index.html')
    else if (!metadata.isFile()) return false
  } catch {
    if (!spaFallback) return false
    target = resolve(distRoot, 'index.html')
  }
  try {
    const bytes = await readFile(target)
    const immutable = target.includes(`${sep}assets${sep}`)
    response.writeHead(200, { 'Content-Type': MIME.get(extname(target).toLowerCase()) ?? 'application/octet-stream', 'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache' })
    response.end(bytes)
    return true
  } catch { return false }
}

export function createAiWritingServer({ config, dist, samples = 'examples', logger = (value) => process.stdout.write(`${JSON.stringify(value)}\n`) }) {
  const distRoot = resolve(dist)
  const sampleRoot = resolve(samples)
  return createServer(async (request, response) => {
    const started = Date.now()
    const requestId = request.headers['x-request-id']?.toString().slice(0, 120) || crypto.randomUUID()
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    try {
      if (url.pathname === '/api/v1/writing/health') {
        if (request.method !== 'GET') return json(response, 405, { code: 'METHOD_NOT_ALLOWED', message: 'Use GET.' }, { Allow: 'GET' })
        return json(response, 200, { available: true, mode: 'gateway', model: config.model, promptVersion: 'writing-v1' })
      }
      if (url.pathname === '/api/v1/writing/evaluate') {
        if (request.method !== 'POST') return json(response, 405, { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, { Allow: 'POST' })
        const result = await evaluate(config, await readBody(request), requestId)
        logger({ event: 'evaluation', requestId, model: result.model, status: 'ok', durationMs: Date.now() - started })
        return json(response, 200, result)
      }
      if (url.pathname === '/api/v1/assistant/health') {
        if (request.method !== 'GET') return json(response, 405, { code: 'METHOD_NOT_ALLOWED', message: 'Use GET.' }, { Allow: 'GET' })
        return json(response, 200, { available: true, mode: 'gateway', model: config.model })
      }
      if (url.pathname === '/api/v1/assistant/chat') {
        if (request.method !== 'POST') return json(response, 405, { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, { Allow: 'POST' })
        const result = await chatAssistant(config, await readBody(request), requestId)
        logger({ event: 'assistant_chat', requestId, model: result.model, status: 'ok', durationMs: Date.now() - started })
        return json(response, 200, result)
      }
      if (url.pathname === '/api/v1/assistant/chat/stream') {
        if (request.method !== 'POST') return json(response, 405, { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, { Allow: 'POST' })
        const result = await streamAssistant(config, await readBody(request), requestId, response)
        logger({ event: 'assistant_chat_stream', requestId, model: result?.model ?? config.model, status: result ? 'ok' : 'error', durationMs: Date.now() - started })
        return
      }
      if (request.method === 'GET' || request.method === 'HEAD') {
        if (url.pathname.startsWith('/examples/') && await serveStatic(sampleRoot, url.pathname.slice('/examples'.length), response, false)) return
        if (await serveStatic(distRoot, url.pathname, response)) return
      }
      return json(response, 404, { code: 'NOT_FOUND', message: 'Resource not found.' })
    } catch (error) {
      const code = error?.code === 'BODY_TOO_LARGE' ? 'BODY_TOO_LARGE' : error?.code || 'INVALID_REQUEST'
      const status = error?.code === 'BODY_TOO_LARGE' ? 413 : error?.status || (String(code).startsWith('UPSTREAM_') ? 502 : 400)
      logger({ event: url.pathname.startsWith('/api/v1/assistant/') ? 'assistant_chat' : 'evaluation', requestId, status: 'error', code, durationMs: Date.now() - started })
      return json(response, status, { code, message: error instanceof Error ? error.message : 'Evaluation failed.', requestId })
    }
  })
}

async function main() {
  const options = parseServerArgs(process.argv.slice(2))
  const config = await loadAiConfig({ configPath: options.configPath })
  const server = createAiWritingServer({ config, dist: options.dist, samples: options.samples })
  server.listen(options.port, options.host, () => {
    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : options.port
    process.stdout.write(`${JSON.stringify({ event: 'ready', url: `http://${options.host}:${port}`, mode: 'gateway', model: config.model })}\n`)
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ event: 'fatal', message: error instanceof Error ? error.message : 'Server failed.' })}\n`)
    process.exitCode = 1
  })
}
