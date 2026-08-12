import { createPackagePreview, installPackage, uninstallPackage } from '../../src/domain/packageLifecycle'
import type { NormalizedContentPackage } from '../../src/domain/contentPackage'
import type { InstalledContentPackage, PracticeSet } from '../../src/domain/models'

const set = { id: 'pack-set', title: 'Pack set', questions: [{ id: 'pack-q1' }] } as PracticeSet
const incoming: NormalizedContentPackage = {
  schemaVersion: 2, packageId: 'pack', version: '1.1.0', name: 'Practice Pack', description: 'Authorized practice.',
  owner: 'Author', license: 'CC-BY-4.0', note: 'With permission.', createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-12T00:00:00.000Z', minimumAppVersion: '0.5.0', changelog: 'New set.', sets: [set],
}

const installed: InstalledContentPackage = {
  packageId: 'pack', version: '1.0.0', name: 'Practice Pack', owner: 'Author', license: 'CC-BY-4.0',
  note: 'With permission.', installedAt: '2026-08-10T00:00:00.000Z', digest: 'sha256:old', sets: [],
}

describe('content package lifecycle', () => {
  it('previews counts, provenance and an available upgrade', async () => {
    const preview = await createPackagePreview(incoming, [installed], [])
    expect(preview).toMatchObject({ packageId: 'pack', version: '1.1.0', setCount: 1, questionCount: 1, action: 'upgrade' })
    expect(preview.digest).toMatch(/^sha256:/)
  })

  it('installs atomically and rejects same or older versions', async () => {
    const upgraded = await installPackage(incoming, [installed], [], () => new Date('2026-08-12T01:00:00.000Z'))
    expect(upgraded.ok).toBe(true)
    if (upgraded.ok) expect(upgraded.packages[0]).toMatchObject({ version: '1.1.0', installedAt: '2026-08-12T01:00:00.000Z' })

    const repeated = await installPackage({ ...incoming, version: '1.0.0' }, [installed], [])
    expect(repeated).toMatchObject({ ok: false, error: expect.stringContaining('更新') })
  })

  it('rejects set conflicts owned by another package and removes only the requested package', async () => {
    const conflictOwner = { ...installed, packageId: 'other', sets: [set] }
    const conflict = await installPackage(incoming, [conflictOwner], [])
    expect(conflict).toMatchObject({ ok: false, error: expect.stringContaining('pack-set') })
    expect(uninstallPackage('pack', [installed, conflictOwner])).toEqual([conflictOwner])
  })

  it('blocks packages that require a newer application version', async () => {
    const future = { ...incoming, minimumAppVersion: '9.0.0' }
    const preview = await createPackagePreview(future, [], [])
    expect(preview).toMatchObject({ action: 'blocked', compatibilityError: expect.stringContaining('9.0.0') })
    expect(await installPackage(future, [], [])).toMatchObject({ ok: false, error: expect.stringContaining('9.0.0') })
  })
})
