// @vitest-environment node
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function startServer(dataDir: string): Promise<{ process: ChildProcessWithoutNullStreams; url: string }> {
  const child = spawn(process.execPath, ['tools/secure-sync-server.mjs', '--port', '0', '--data-dir', dataDir, '--token', 'integration-secret'], {
    cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'],
  }) as ChildProcessWithoutNullStreams
  const url = await new Promise<string>((resolve, reject) => {
    let output = ''
    const timeout = setTimeout(() => reject(new Error(`server readiness timeout: ${output}`)), 8_000)
    child.stdout.on('data', (chunk) => {
      output += String(chunk)
      const line = output.split(/\r?\n/u).find((item) => item.includes('"event":"ready"'))
      if (line) {
        clearTimeout(timeout)
        resolve((JSON.parse(line) as { url: string }).url)
      }
    })
    child.stderr.on('data', (chunk) => { output += String(chunk) })
    child.once('exit', (code) => reject(new Error(`server exited with ${code}: ${output}`)))
  })
  return { process: child, url }
}

describe('secure sync reference server', () => {
  let directory = ''
  let server: ChildProcessWithoutNullStreams
  let baseUrl = ''

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'ielts-pilot-sync-'))
    const started = await startServer(directory)
    server = started.process
    baseUrl = started.url
  })

  afterAll(async () => {
    server?.kill()
    await rm(directory, { recursive: true, force: true })
  })

  it('stores only encrypted envelopes and enforces authentication plus ETags', async () => {
    const endpoint = `${baseUrl}/v1/vaults/student`
    expect((await fetch(endpoint)).status).toBe(401)
    const body = JSON.stringify({
      protocol: 'ielts-pilot-vault', version: 1, profileId: 'student', createdAt: '2026-08-12T04:00:00.000Z',
      kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 310000, salt: 'AAAAAAAAAAAAAAAAAAAAAA' },
      cipher: { name: 'AES-GCM', tagLength: 128, iv: 'AAAAAAAAAAAAAAAA' }, ciphertext: 'AAAAAAAAAAAAAAAAAAAAAA',
    })
    const create = await fetch(endpoint, { method: 'PUT', headers: { Authorization: 'Bearer integration-secret', 'Content-Type': 'application/json', 'If-None-Match': '*' }, body })
    expect(create.status).toBe(204)
    const etag = create.headers.get('etag')
    expect(etag).toMatch(/^"[a-f0-9]{64}"$/u)

    const pull = await fetch(endpoint, { headers: { Authorization: 'Bearer integration-secret' } })
    expect(pull.status).toBe(200)
    expect(await pull.text()).toBe(body)
    expect(pull.headers.get('etag')).toBe(etag)

    const stale = await fetch(endpoint, { method: 'PUT', headers: { Authorization: 'Bearer integration-secret', 'Content-Type': 'application/json', 'If-Match': '"stale"' }, body })
    expect(stale.status).toBe(412)
  })

  it('rejects plaintext and path traversal payloads', async () => {
    const headers = { Authorization: 'Bearer integration-secret', 'Content-Type': 'application/json', 'If-None-Match': '*' }
    expect((await fetch(`${baseUrl}/v1/vaults/plain`, { method: 'PUT', headers, body: JSON.stringify({ drafts: { secret: true } }) })).status).toBe(400)
    expect((await fetch(`${baseUrl}/v1/vaults/%2e%2e%2fescape`, { headers })).status).toBe(400)
  })
})
