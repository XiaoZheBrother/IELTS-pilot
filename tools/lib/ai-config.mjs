import { readFile } from 'node:fs/promises'

function requireHttpsOrLoopback(value) {
  let endpoint
  try { endpoint = new URL(value) } catch { throw new Error('AI endpoint must be a valid absolute URL.') }
  const loopback = endpoint.hostname === '127.0.0.1' || endpoint.hostname === 'localhost' || endpoint.hostname === '::1'
  if (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && loopback)) {
    throw new Error('AI endpoint must use HTTPS; loopback HTTP is allowed only for local testing.')
  }
  return endpoint.toString()
}

function normalize(raw) {
  const endpoint = String(raw.endpoint ?? raw.url ?? '').trim()
  const apiKey = String(raw.apiKey ?? raw.api_key ?? '').trim()
  const model = String(raw.model ?? '').trim()
  if (!endpoint) throw new Error('AI endpoint is missing.')
  if (!apiKey) throw new Error('AI API key is missing.')
  if (!model) throw new Error('AI model is missing.')
  return { endpoint: requireHttpsOrLoopback(endpoint), apiKey, model: model.slice(0, 180) }
}

export async function loadAiConfig({ configPath, env = process.env } = {}) {
  if (env.IELTS_PILOT_AI_ENDPOINT || env.IELTS_PILOT_AI_KEY || env.IELTS_PILOT_AI_MODEL) {
    return normalize({ endpoint: env.IELTS_PILOT_AI_ENDPOINT, apiKey: env.IELTS_PILOT_AI_KEY, model: env.IELTS_PILOT_AI_MODEL })
  }
  if (!configPath) throw new Error('AI configuration is missing. Use --config or IELTS_PILOT_AI_* environment variables.')
  const text = await readFile(configPath, 'utf8')
  try { return normalize(JSON.parse(text)) } catch (error) {
    if (error instanceof SyntaxError) {
      const lines = text.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean)
      if (lines.length < 3) throw new Error('AI configuration file must contain endpoint, key and model values.')
      const endpointHint = lines[3] || lines[0]
      const endpoint = /^https?:\/\//iu.test(endpointHint) ? endpointHint : `https://${endpointHint}`
      return normalize({ endpoint, apiKey: lines[1], model: lines[2] })
    }
    throw error
  }
}

export function parseServerArgs(argv) {
  const options = { host: '127.0.0.1', port: 4390, dist: 'dist', configPath: undefined }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index + 1]
    if (argv[index] === '--host' && value) options.host = value
    if (argv[index] === '--port' && value) options.port = Number.parseInt(value, 10)
    if (argv[index] === '--dist' && value) options.dist = value
    if (argv[index] === '--config' && value) options.configPath = value
  }
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65_535) throw new Error('Server port is invalid.')
  return options
}
