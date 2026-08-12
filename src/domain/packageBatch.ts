import type { NormalizedContentPackage } from './contentPackage'
import { createPackagePreview, installPackage, type PackagePreview } from './packageLifecycle'
import type { InstalledContentPackage } from './models'

export interface PackageBatchCandidate {
  fileName: string
  content: NormalizedContentPackage
}

export type PackageBatchEntry =
  | { fileName: string; status: 'ready'; content: NormalizedContentPackage; preview: PackagePreview }
  | { fileName: string; status: 'blocked'; content: NormalizedContentPackage; preview: PackagePreview; error: string }

export interface PackageBatchInstallResult {
  packages: InstalledContentPackage[]
  installedCount: number
  failures: Array<{ fileName: string; error: string }>
}

export async function previewPackageBatch(
  candidates: PackageBatchCandidate[],
  installed: InstalledContentPackage[],
  bundledSetIds: string[],
): Promise<PackageBatchEntry[]> {
  let staged = installed
  const entries: PackageBatchEntry[] = []

  for (const candidate of candidates) {
    const preview = await createPackagePreview(candidate.content, staged, bundledSetIds)
    const simulation = await installPackage(candidate.content, staged, bundledSetIds)
    if (!simulation.ok) {
      entries.push({ ...candidate, preview, status: 'blocked', error: simulation.error })
      continue
    }
    staged = simulation.packages
    entries.push({ ...candidate, preview, status: 'ready' })
  }

  return entries
}

export async function installPackageBatch(
  entries: PackageBatchEntry[],
  installed: InstalledContentPackage[],
  bundledSetIds: string[],
): Promise<PackageBatchInstallResult> {
  let packages = installed
  let installedCount = 0
  const failures: PackageBatchInstallResult['failures'] = []

  for (const entry of entries) {
    if (entry.status !== 'ready') continue
    const result = await installPackage(entry.content, packages, bundledSetIds)
    if (!result.ok) {
      failures.push({ fileName: entry.fileName, error: result.error })
      continue
    }
    packages = result.packages
    installedCount += 1
  }

  return { packages, installedCount, failures }
}
