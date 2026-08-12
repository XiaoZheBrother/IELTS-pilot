import type { NormalizedContentPackage } from '../../src/domain/contentPackage'
import type { PracticeSet } from '../../src/domain/models'
import { installPackageBatch, previewPackageBatch } from '../../src/domain/packageBatch'

function contentPackage(packageId: string, setId: string): NormalizedContentPackage {
  const set = {
    id: setId,
    title: `${packageId} set`,
    questions: [{ id: `${packageId}-q1` }],
  } as PracticeSet
  return {
    schemaVersion: 2,
    packageId,
    version: '1.0.0',
    name: `${packageId} package`,
    description: 'Authorized test content.',
    owner: 'Test Author',
    license: 'CC-BY-4.0',
    note: 'Authorized for automated testing.',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-12T00:00:00.000Z',
    minimumAppVersion: '0.5.0',
    changelog: 'Initial package.',
    sets: [set],
  }
}

describe('package batch lifecycle', () => {
  it('detects conflicts against packages staged earlier in the same batch', async () => {
    const previewed = await previewPackageBatch([
      { fileName: 'one.json', content: contentPackage('one', 'shared-set') },
      { fileName: 'two.json', content: contentPackage('two', 'second-set') },
      { fileName: 'conflict.json', content: contentPackage('conflict', 'shared-set') },
    ], [], [])

    expect(previewed.map(({ status }) => status)).toEqual(['ready', 'ready', 'blocked'])
    expect(previewed[2]).toMatchObject({ fileName: 'conflict.json', error: expect.stringContaining('shared-set') })
  })

  it('installs every ready entry into one final package collection', async () => {
    const previewed = await previewPackageBatch([
      { fileName: 'one.json', content: contentPackage('one', 'one-set') },
      { fileName: 'two.json', content: contentPackage('two', 'two-set') },
    ], [], [])

    const result = await installPackageBatch(previewed, [], [])

    expect(result.packages.map(({ packageId }) => packageId)).toEqual(['one', 'two'])
    expect(result.installedCount).toBe(2)
    expect(result.failures).toEqual([])
  })
})
