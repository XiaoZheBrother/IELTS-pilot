import { canonicalJson } from './canonicalJson'

export const VAULT_KDF_ITERATIONS = 310_000
const MIN_PASSPHRASE_LENGTH = 12

export interface EncryptedVaultEnvelope {
  protocol: 'ielts-pilot-vault'
  version: 1
  profileId: string
  createdAt: string
  kdf: {
    name: 'PBKDF2'
    hash: 'SHA-256'
    iterations: number
    salt: string
  }
  cipher: {
    name: 'AES-GCM'
    tagLength: 128
    iv: string
  }
  ciphertext: string
}

export interface VaultCryptoOptions {
  profileId: string
  iterations?: number
  now?: () => Date
  crypto?: Crypto
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '')
}

function fromBase64Url(value: string, field: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error(`加密保险库格式无效：${field} 不是 base64url。`)
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    if (toBase64Url(bytes) !== value) throw new Error('non-canonical')
    return bytes
  } catch {
    throw new Error(`加密保险库格式无效：${field} 不是 base64url。`)
  }
}

function cryptoApi(override?: Crypto): Crypto {
  const api = override ?? globalThis.crypto
  if (!api?.subtle || !api.getRandomValues) throw new Error('当前运行环境不支持 Web Crypto，无法使用加密同步。')
  return api
}

function validatePassphrase(passphrase: string): void {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) throw new Error(`同步口令至少 ${MIN_PASSPHRASE_LENGTH} 个字符。`)
}

function aadFor(envelope: EncryptedVaultEnvelope): Uint8Array {
  return new TextEncoder().encode(canonicalJson({
    protocol: envelope.protocol,
    version: envelope.version,
    profileId: envelope.profileId,
    createdAt: envelope.createdAt,
    kdf: envelope.kdf,
    cipher: envelope.cipher,
  }))
}

async function deriveKey(api: Crypto, passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await api.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return api.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', iterations, salt },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export function parseEncryptedVault(value: string | unknown): EncryptedVaultEnvelope {
  let raw: unknown = value
  if (typeof value === 'string') {
    try { raw = JSON.parse(value) as unknown } catch { throw new Error('加密保险库不是有效 JSON。') }
  }
  if (!isRecord(raw) || raw.protocol !== 'ielts-pilot-vault' || raw.version !== 1
    || typeof raw.profileId !== 'string' || !/^[A-Za-z0-9._-]{1,128}$/u.test(raw.profileId)
    || typeof raw.createdAt !== 'string' || !Number.isFinite(Date.parse(raw.createdAt))
    || !isRecord(raw.kdf) || raw.kdf.name !== 'PBKDF2' || raw.kdf.hash !== 'SHA-256'
    || !Number.isInteger(raw.kdf.iterations) || Number(raw.kdf.iterations) < 1_000 || Number(raw.kdf.iterations) > 10_000_000
    || typeof raw.kdf.salt !== 'string'
    || !isRecord(raw.cipher) || raw.cipher.name !== 'AES-GCM' || raw.cipher.tagLength !== 128
    || typeof raw.cipher.iv !== 'string' || typeof raw.ciphertext !== 'string') {
    throw new Error('加密保险库格式无效或协议版本不受支持。')
  }
  const salt = fromBase64Url(raw.kdf.salt, 'salt')
  const iv = fromBase64Url(raw.cipher.iv, 'iv')
  const ciphertext = fromBase64Url(raw.ciphertext, 'ciphertext')
  if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 16) throw new Error('加密保险库格式无效：加密参数长度错误。')
  return {
    protocol: 'ielts-pilot-vault', version: 1, profileId: raw.profileId,
    createdAt: new Date(raw.createdAt).toISOString(),
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: Number(raw.kdf.iterations), salt: raw.kdf.salt },
    cipher: { name: 'AES-GCM', tagLength: 128, iv: raw.cipher.iv }, ciphertext: raw.ciphertext,
  }
}

export async function encryptPracticeVault(plaintext: string, passphrase: string, options: VaultCryptoOptions): Promise<EncryptedVaultEnvelope> {
  validatePassphrase(passphrase)
  if (!/^[A-Za-z0-9._-]{1,128}$/u.test(options.profileId)) throw new Error('同步档案 ID 仅可包含字母、数字、点、下划线或连字符。')
  const iterations = options.iterations ?? VAULT_KDF_ITERATIONS
  if (!Number.isInteger(iterations) || iterations < 1_000 || iterations > 10_000_000) throw new Error('PBKDF2 迭代次数无效。')
  const api = cryptoApi(options.crypto)
  const salt = api.getRandomValues(new Uint8Array(16))
  const iv = api.getRandomValues(new Uint8Array(12))
  const envelope: EncryptedVaultEnvelope = {
    protocol: 'ielts-pilot-vault', version: 1, profileId: options.profileId,
    createdAt: (options.now ?? (() => new Date()))().toISOString(),
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toBase64Url(salt) },
    cipher: { name: 'AES-GCM', tagLength: 128, iv: toBase64Url(iv) }, ciphertext: '',
  }
  const key = await deriveKey(api, passphrase, salt, iterations)
  const ciphertext = await api.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128, additionalData: aadFor(envelope) },
    key,
    new TextEncoder().encode(plaintext),
  )
  envelope.ciphertext = toBase64Url(new Uint8Array(ciphertext))
  return envelope
}

export async function decryptPracticeVault(value: EncryptedVaultEnvelope | string | unknown, passphrase: string, override?: Crypto): Promise<string> {
  validatePassphrase(passphrase)
  const envelope = parseEncryptedVault(value)
  const api = cryptoApi(override)
  try {
    const salt = fromBase64Url(envelope.kdf.salt, 'salt')
    const iv = fromBase64Url(envelope.cipher.iv, 'iv')
    const ciphertext = fromBase64Url(envelope.ciphertext, 'ciphertext')
    const key = await deriveKey(api, passphrase, salt, envelope.kdf.iterations)
    const plaintext = await api.subtle.decrypt(
      { name: 'AES-GCM', iv, tagLength: 128, additionalData: aadFor(envelope) },
      key,
      ciphertext,
    )
    return new TextDecoder('utf-8', { fatal: true }).decode(plaintext)
  } catch {
    throw new Error('口令错误或保险库已被篡改。')
  }
}
