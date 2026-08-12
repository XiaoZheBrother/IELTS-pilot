#!/usr/bin/env node
import { createHash, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const MAX_BYTES = 10 * 1024 * 1024
const args = new Map()
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1])
const host = args.get('--host') ?? '127.0.0.1'
const port = Number(args.get('--port') ?? '8787')
const dataDir = resolve(args.get('--data-dir') ?? './.ielts-pilot-sync')
const token = args.get('--token') ?? process.env.IELTS_PILOT_SYNC_TOKEN
if (!token || token.length < 12) {
  process.stderr.write('Provide --token with at least 12 characters or IELTS_PILOT_SYNC_TOKEN.\n')
  process.exit(1)
}

function send(response, status, body = '') {
  response.writeHead(status, {
    ...(body ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, If-Match, If-None-Match',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Cache-Control': 'no-store',
  })
  response.end(body)
}

function authorized(request) {
  const supplied = request.headers.authorization?.replace(/^Bearer /u, '') ?? ''
  const expectedBytes = Buffer.from(token)
  const suppliedBytes = Buffer.from(supplied)
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes)
}

function validEnvelope(value, profileId) {
  return value && value.protocol === 'ielts-pilot-vault' && value.version === 1 && value.profileId === profileId
    && value.kdf?.name === 'PBKDF2' && value.kdf?.hash === 'SHA-256' && Number.isInteger(value.kdf?.iterations)
    && value.cipher?.name === 'AES-GCM' && value.cipher?.tagLength === 128
    && typeof value.kdf?.salt === 'string' && typeof value.cipher?.iv === 'string' && typeof value.ciphertext === 'string'
    && !('drafts' in value) && !('attempts' in value)
}

async function bodyOf(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_BYTES) throw Object.assign(new Error('too-large'), { status: 413 })
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function etagOf(body) {
  return `"${createHash('sha256').update(body).digest('hex')}"`
}

await mkdir(dataDir, { recursive: true })
const server = createServer(async (request, response) => {
  try {
    if (request.method === 'OPTIONS') return send(response, 204)
    if (!authorized(request)) return send(response, 401, JSON.stringify({ error: 'unauthorized' }))
    const url = new URL(request.url ?? '/', 'http://localhost')
    const match = /^\/v1\/vaults\/([A-Za-z0-9._-]{1,128})$/u.exec(url.pathname)
    if (!match) return send(response, 400, JSON.stringify({ error: 'invalid-path' }))
    const profileId = match[1]
    const file = resolve(dataDir, `${profileId}.vault.json`)
    if (dirname(file) !== dataDir) return send(response, 400, JSON.stringify({ error: 'invalid-path' }))
    let current = null
    try { current = await readFile(file, 'utf8') } catch (error) { if (error.code !== 'ENOENT') throw error }
    if (request.method === 'GET') {
      if (current === null) return send(response, 404, JSON.stringify({ error: 'missing' }))
      response.setHeader('ETag', etagOf(current))
      return send(response, 200, current)
    }
    if (request.method !== 'PUT') return send(response, 405, JSON.stringify({ error: 'method-not-allowed' }))
    if (request.headers['if-none-match'] === '*' && current !== null) return send(response, 412, JSON.stringify({ error: 'conflict' }))
    if (request.headers['if-match'] && (current === null || request.headers['if-match'] !== etagOf(current))) return send(response, 412, JSON.stringify({ error: 'conflict' }))
    const body = await bodyOf(request)
    let envelope
    try { envelope = JSON.parse(body) } catch { return send(response, 400, JSON.stringify({ error: 'invalid-json' })) }
    if (!validEnvelope(envelope, profileId)) return send(response, 400, JSON.stringify({ error: 'invalid-envelope' }))
    const temporary = `${file}.${process.pid}.${Date.now()}.tmp`
    await writeFile(temporary, body, { encoding: 'utf8', flag: 'wx' })
    await rename(temporary, file)
    response.setHeader('ETag', etagOf(body))
    return send(response, 204)
  } catch (error) {
    return send(response, error.status ?? 500, JSON.stringify({ error: error.status === 413 ? 'too-large' : 'internal' }))
  }
})

server.listen(port, host, () => {
  const address = server.address()
  const actualPort = typeof address === 'object' && address ? address.port : port
  process.stdout.write(`${JSON.stringify({ event: 'ready', url: `http://${host}:${actualPort}` })}\n`)
})
