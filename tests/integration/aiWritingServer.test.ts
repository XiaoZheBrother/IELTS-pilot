// @vitest-environment node
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Fixture server did not bind.')
  return `http://127.0.0.1:${address.port}`
}

async function startGateway(configPath: string, dist: string): Promise<{ process: ChildProcessWithoutNullStreams; url: string; output: () => string }> {
  const child = spawn(process.execPath, ['tools/ai-writing-server.mjs', '--port', '0', '--config', configPath, '--dist', dist], {
    cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'],
  }) as ChildProcessWithoutNullStreams
  let combined = ''
  child.stdout.on('data', (chunk) => { combined += String(chunk) })
  child.stderr.on('data', (chunk) => { combined += String(chunk) })
  const url = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`gateway readiness timeout: ${combined}`)), 8_000)
    const inspect = () => {
      const line = combined.split(/\r?\n/u).find((item) => item.includes('"event":"ready"'))
      if (line) { clearTimeout(timeout); resolve((JSON.parse(line) as { url: string }).url) }
    }
    child.stdout.on('data', inspect)
    child.once('exit', (code) => reject(new Error(`gateway exited with ${code}: ${combined}`)))
  })
  return { process: child, url, output: () => combined }
}

describe('AI writing production gateway', () => {
  let directory = ''
  let upstream: Server
  let gateway: ChildProcessWithoutNullStreams
  let baseUrl = ''
  let output = () => ''
  let observedAuthorization = ''
  let observedBody: Record<string, unknown> = {}

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'ielts-pilot-ai-'))
    const dist = join(directory, 'dist')
    await import('node:fs/promises').then(({ mkdir }) => mkdir(dist))
    await writeFile(join(dist, 'index.html'), '<!doctype html><title>IELTS Pilot Production</title><main>app</main>', 'utf8')
    upstream = createServer(async (request, response) => {
      observedAuthorization = String(request.headers.authorization ?? '')
      const chunks: Buffer[] = []
      for await (const chunk of request) chunks.push(Buffer.from(chunk))
      observedBody = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ model: 'fixture-model', id: 'upstream-1', choices: [{ message: { content: '{"summary":"fixture"}' } }], usage: { total_tokens: 42 } }))
    })
    const upstreamUrl = await listen(upstream)
    const configPath = join(directory, 'config.json')
    await writeFile(configPath, JSON.stringify({ endpoint: `${upstreamUrl}/chat/completions`, apiKey: 'integration-secret-value', model: 'fixture-model' }), 'utf8')
    const started = await startGateway(configPath, dist)
    gateway = started.process
    baseUrl = started.url
    output = started.output
  })

  afterAll(async () => {
    gateway?.kill()
    await new Promise<void>((resolve) => upstream?.close(() => resolve()))
    await rm(directory, { recursive: true, force: true })
  })

  it('serves health, static files and SPA fallback without disclosing configuration', async () => {
    const health = await fetch(`${baseUrl}/api/v1/writing/health`)
    expect(health.status).toBe(200)
    expect(await health.json()).toMatchObject({ available: true, mode: 'gateway', model: 'fixture-model' })
    expect(await (await fetch(`${baseUrl}/writing`)).text()).toContain('IELTS Pilot Production')
    expect(await (await fetch(`${baseUrl}/examples/signed-catalog/catalog.json`)).json()).toMatchObject({ schemaVersion: 1 })
    expect(output()).not.toContain('integration-secret-value')
  })

  it('validates methods and body size, then injects the upstream credential server-side', async () => {
    expect((await fetch(`${baseUrl}/api/v1/writing/evaluate`)).status).toBe(405)
    const tooLarge = await fetch(`${baseUrl}/api/v1/writing/evaluate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ essay: 'x'.repeat(40_000) }) })
    expect(tooLarge.status).toBe(413)

    const payload = {
      taskId: 'task', taskType: 'task-2', promptVersion: 'writing-v1', prompt: 'A valid prompt',
      essay: 'word '.repeat(80), wordCount: 80,
      messages: [{ role: 'system', content: 'Return JSON.' }, { role: 'user', content: 'Evaluate the essay.' }],
    }
    const response = await fetch(`${baseUrl}/api/v1/writing/evaluate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ content: '{"summary":"fixture"}', model: 'fixture-model', usage: { totalTokens: 42 } })
    expect(observedAuthorization).toBe('Bearer integration-secret-value')
    expect(observedBody).toMatchObject({ thinking: { type: 'disabled' } })
    expect(output()).not.toContain(observedAuthorization)
  })
})
