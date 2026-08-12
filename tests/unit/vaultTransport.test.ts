import { createVaultTransport, validateVaultEndpoint, VaultTransportError } from '../../src/platform/vaultTransport'
import type { EncryptedVaultEnvelope } from '../../src/domain/encryptedVault'

const envelope = {
  protocol: 'ielts-pilot-vault', version: 1, profileId: 'main', createdAt: '2026-08-12T04:00:00.000Z',
  kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 310_000, salt: 'AAAAAAAAAAAAAAAAAAAAAA' },
  cipher: { name: 'AES-GCM', tagLength: 128, iv: 'AAAAAAAAAAAAAAAA' }, ciphertext: 'AAAAAAAAAAAAAAAAAAAAAA',
} as EncryptedVaultEnvelope

describe('vault transport', () => {
  it('accepts HTTPS and loopback HTTP but rejects insecure remote endpoints', () => {
    expect(validateVaultEndpoint('https://sync.example.test/root').href).toBe('https://sync.example.test/root')
    expect(validateVaultEndpoint('http://127.0.0.1:8787').href).toBe('http://127.0.0.1:8787/')
    expect(validateVaultEndpoint('http://localhost:8787').href).toBe('http://localhost:8787/')
    expect(() => validateVaultEndpoint('http://sync.example.test')).toThrow('HTTPS')
    expect(() => validateVaultEndpoint('https://user:pass@example.test')).toThrow('凭据')
  })

  it('pulls an encrypted envelope with bearer auth and ETag', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(envelope), { status: 200, headers: { ETag: '"vault-1"' } }))
    const transport = createVaultTransport({ endpoint: 'https://sync.example.test', profileId: 'main', token: 'session-token', fetch: fetchMock })
    const result = await transport.pull()
    expect(result).toEqual({ kind: 'found', envelope, etag: '"vault-1"' })
    expect(fetchMock).toHaveBeenCalledWith('https://sync.example.test/v1/vaults/main', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer session-token' }) }))
  })

  it('maps 404 to a missing remote vault', async () => {
    const transport = createVaultTransport({ endpoint: 'https://sync.example.test', profileId: 'main', fetch: async () => new Response(null, { status: 404 }) })
    await expect(transport.pull()).resolves.toEqual({ kind: 'missing' })
  })

  it('uses optimistic concurrency for create and update', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204, headers: { ETag: '"vault-2"' } }))
    const transport = createVaultTransport({ endpoint: 'https://sync.example.test', profileId: 'main', fetch: fetchMock })
    await transport.push(envelope)
    await transport.push(envelope, '"vault-1"')
    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>
    expect(calls[0][1]?.headers).toMatchObject({ 'If-None-Match': '*' })
    expect(calls[1][1]?.headers).toMatchObject({ 'If-Match': '"vault-1"' })
  })

  it.each([
    [401, 'unauthorized'],
    [412, 'conflict'],
    [500, 'server'],
  ] as const)('maps HTTP %s to %s', async (status, code) => {
    const transport = createVaultTransport({ endpoint: 'https://sync.example.test', profileId: 'main', fetch: async () => new Response(null, { status }) })
    const promise = status === 412 ? transport.push(envelope, '"old"') : transport.pull()
    await expect(promise).rejects.toMatchObject({ code })
    await expect(promise).rejects.toBeInstanceOf(VaultTransportError)
  })

  it('rejects a successful response without a strong ETag', async () => {
    const transport = createVaultTransport({ endpoint: 'https://sync.example.test', profileId: 'main', fetch: async () => new Response(JSON.stringify(envelope), { status: 200 }) })
    await expect(transport.pull()).rejects.toMatchObject({ code: 'invalid-response' })
  })
})
