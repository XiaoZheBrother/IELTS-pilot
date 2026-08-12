import { decryptPracticeVault, encryptPracticeVault, parseEncryptedVault, VAULT_KDF_ITERATIONS } from '../../src/domain/encryptedVault'

const plaintext = JSON.stringify({ version: 4, drafts: { sample: { currentIndex: 2 } } })
const options = { profileId: 'student-main', iterations: 1_000, now: () => new Date('2026-08-12T04:00:00.000Z') }

describe('encrypted practice vault protocol', () => {
  it('uses production PBKDF2 and AES-GCM parameters by default', async () => {
    const envelope = await encryptPracticeVault('hello', 'correct horse battery staple', { profileId: 'production' })
    expect(envelope.protocol).toBe('ielts-pilot-vault')
    expect(envelope.version).toBe(1)
    expect(envelope.kdf).toMatchObject({ name: 'PBKDF2', hash: 'SHA-256', iterations: VAULT_KDF_ITERATIONS })
    expect(envelope.cipher).toMatchObject({ name: 'AES-GCM', tagLength: 128 })
    expect(envelope.ciphertext).not.toContain('hello')
  })

  it('round-trips UTF-8 backup data with injected fast test parameters', async () => {
    const envelope = await encryptPracticeVault(`${plaintext} 中文`, 'a-secure-passphrase', options)
    expect(await decryptPracticeVault(envelope, 'a-secure-passphrase')).toBe(`${plaintext} 中文`)
    expect(envelope.createdAt).toBe('2026-08-12T04:00:00.000Z')
  })

  it('rejects a wrong passphrase without exposing crypto details', async () => {
    const envelope = await encryptPracticeVault(plaintext, 'a-secure-passphrase', options)
    await expect(decryptPracticeVault(envelope, 'another-passphrase')).rejects.toThrow('口令错误或保险库已被篡改')
  })

  it.each(['ciphertext', 'iv', 'profile'])('rejects %s tampering', async (field) => {
    const envelope = await encryptPracticeVault(plaintext, 'a-secure-passphrase', options)
    const tampered = structuredClone(envelope)
    if (field === 'ciphertext') tampered.ciphertext = `${tampered.ciphertext[0] === 'A' ? 'B' : 'A'}${tampered.ciphertext.slice(1)}`
    if (field === 'iv') tampered.cipher.iv = `${tampered.cipher.iv.slice(0, -1)}A`
    if (field === 'profile') tampered.profileId = 'other-profile'
    await expect(decryptPracticeVault(tampered, 'a-secure-passphrase')).rejects.toThrow('口令错误或保险库已被篡改')
  })

  it('enforces the passphrase floor before running the KDF', async () => {
    await expect(encryptPracticeVault(plaintext, 'short', options)).rejects.toThrow('至少 12 个字符')
  })

  it('strictly validates envelope fields before decryption', () => {
    expect(() => parseEncryptedVault('{broken')).toThrow('不是有效 JSON')
    expect(() => parseEncryptedVault({ protocol: 'unknown', version: 1 })).toThrow('格式无效')
  })
})
