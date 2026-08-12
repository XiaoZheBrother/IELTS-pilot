// @vitest-environment node
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'

const execute = promisify(execFile)

describe('publisher command line tools', () => {
  it('generates P-256 keys, signs a catalog and verifies signature plus package digest', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'ielts-pilot-publisher-'))
    await execute(process.execPath, ['tools/publisher-keys.mjs', '--out-dir', directory], { cwd: process.cwd() })
    const privatePath = join(directory, 'publisher-private.jwk')
    const publicPath = join(directory, 'publisher-public.jwk')
    const privateKey = JSON.parse(await readFile(privatePath, 'utf8'))
    const publicKey = JSON.parse(await readFile(publicPath, 'utf8'))
    expect(privateKey).toMatchObject({ kty: 'EC', crv: 'P-256', d: expect.any(String) })
    expect(publicKey).toMatchObject({ kty: 'EC', crv: 'P-256', x: expect.any(String), y: expect.any(String) })
    expect(publicKey.d).toBeUndefined()
    if (process.platform !== 'win32') expect((await stat(privatePath)).mode & 0o777).toBe(0o600)

    const packageText = JSON.stringify({ hello: 'verified bytes' })
    const packagePath = join(directory, 'package.json')
    await writeFile(packagePath, packageText)
    const unsigned = {
      schemaVersion: 1, catalogId: 'test-catalog', name: 'Test Catalog', description: 'CLI test.', updatedAt: '2026-08-12T08:00:00.000Z',
      publisher: { publisherId: 'test-publisher', name: 'Test Publisher', publicKey },
      packages: [{ packageId: 'test-package', name: 'Test package', version: '1.0.0', description: 'CLI fixture.', license: 'CC0', url: 'https://cdn.example.test/package.json', sha256: createHash('sha256').update(packageText).digest('hex'), size: Buffer.byteLength(packageText), updatedAt: '2026-08-12T08:00:00.000Z' }],
    }
    const unsignedPath = join(directory, 'unsigned.json')
    const signedPath = join(directory, 'catalog.json')
    await writeFile(unsignedPath, JSON.stringify(unsigned, null, 2))
    await execute(process.execPath, ['tools/sign-catalog.mjs', '--catalog', unsignedPath, '--private-key', privatePath, '--out', signedPath], { cwd: process.cwd() })
    const signed = JSON.parse(await readFile(signedPath, 'utf8'))
    expect(signed.signature).toMatchObject({ algorithm: 'ECDSA-P256-SHA256', value: expect.any(String) })
    await expect(execute(process.execPath, ['tools/verify-catalog.mjs', '--catalog', signedPath, '--package-root', directory], { cwd: process.cwd() })).resolves.toMatchObject({ stdout: expect.stringContaining('verified') })

    await writeFile(packagePath, `${packageText} `)
    await expect(execute(process.execPath, ['tools/verify-catalog.mjs', '--catalog', signedPath, '--package-root', directory], { cwd: process.cwd() })).rejects.toMatchObject({ stderr: expect.stringContaining('digest') })
  }, 20_000)

  it('keeps publisher private keys ignored by default', async () => {
    const ignore = await readFile(resolve('.gitignore'), 'utf8')
    expect(ignore).toContain('publisher-private.jwk')
    expect(ignore).toContain('*.publisher-private.jwk')
  })
})
