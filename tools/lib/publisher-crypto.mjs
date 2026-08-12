import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto'

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([key, item]) => [key, normalize(item)]))
}

export function canonicalJson(value, spacing) {
  return JSON.stringify(normalize(value), null, spacing)
}

export function signingPayload(catalog) {
  const { signature: _signature, ...unsigned } = catalog
  return canonicalJson(unsigned)
}

export function publicJwkFrom(value) {
  const publicKey = createPublicKey(createPrivateKey({ key: value, format: 'jwk' })).export({ format: 'jwk' })
  return { ...publicKey, alg: 'ES256', use: 'sig' }
}

export function fingerprint(value) {
  const payload = canonicalJson({ crv: value.crv, kty: value.kty, x: value.x, y: value.y })
  return createHash('sha256').update(payload).digest('hex').toUpperCase().match(/.{1,4}/g).join(':')
}

export function signCatalog(catalog, privateJwk) {
  const key = createPrivateKey({ key: privateJwk, format: 'jwk' })
  return sign('sha256', Buffer.from(signingPayload(catalog)), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')
}

export function verifyCatalog(catalog) {
  if (catalog?.signature?.algorithm !== 'ECDSA-P256-SHA256' || typeof catalog?.signature?.value !== 'string') return false
  const key = createPublicKey({ key: catalog.publisher.publicKey, format: 'jwk' })
  return verify('sha256', Buffer.from(signingPayload(catalog)), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(catalog.signature.value, 'base64url'))
}

export function parseArgs(argv) {
  const result = new Map()
  for (let index = 2; index < argv.length; index += 2) result.set(argv[index], argv[index + 1])
  return result
}
