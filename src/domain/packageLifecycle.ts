import type { NormalizedContentPackage } from './contentPackage'
import type { InstalledContentPackage } from './models'

export interface PackagePreview {
  packageId: string
  name: string
  version: string
  owner: string
  license: string
  setCount: number
  questionCount: number
  topics: string[]
  digest: string
  action: 'install' | 'upgrade' | 'blocked'
  conflicts: string[]
}

export type PackageInstallResult = { ok: true; packages: InstalledContentPackage[] } | { ok: false; error: string }

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).filter(([key]) => key !== 'integrity').sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export async function digestPackage(value: NormalizedContentPackage): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalize(value))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

function compareVersions(left: string, right: string): number {
  const a = left.split('-')[0]!.split('.').map(Number)
  const b = right.split('-')[0]!.split('.').map(Number)
  for (let index = 0; index < 3; index += 1) if (a[index] !== b[index]) return (a[index] ?? 0) - (b[index] ?? 0)
  return left.localeCompare(right)
}

function conflictsFor(incoming: NormalizedContentPackage, installed: InstalledContentPackage[], bundledSetIds: string[]): string[] {
  const occupied = new Set([
    ...bundledSetIds,
    ...installed.filter(({ packageId }) => packageId !== incoming.packageId).flatMap(({ sets }) => sets.map(({ id }) => id)),
  ])
  return incoming.sets.map(({ id }) => id).filter((id) => occupied.has(id))
}

export async function createPackagePreview(incoming: NormalizedContentPackage, installed: InstalledContentPackage[], bundledSetIds: string[]): Promise<PackagePreview> {
  const current = installed.find(({ packageId }) => packageId === incoming.packageId)
  const conflicts = conflictsFor(incoming, installed, bundledSetIds)
  const newer = current ? compareVersions(incoming.version, current.version) > 0 : true
  return {
    packageId: incoming.packageId, name: incoming.name, version: incoming.version, owner: incoming.owner,
    license: incoming.license, setCount: incoming.sets.length,
    questionCount: incoming.sets.reduce((sum, set) => sum + set.questions.length, 0),
    topics: [...new Set(incoming.sets.flatMap(({ topics }) => topics))], digest: await digestPackage(incoming),
    action: conflicts.length || !newer ? 'blocked' : current ? 'upgrade' : 'install', conflicts,
  }
}

export async function installPackage(incoming: NormalizedContentPackage, installed: InstalledContentPackage[], bundledSetIds: string[], now = () => new Date()): Promise<PackageInstallResult> {
  const preview = await createPackagePreview(incoming, installed, bundledSetIds)
  if (preview.conflicts.length) return { ok: false, error: `题库 ID 冲突：${preview.conflicts.join('、')}` }
  if (preview.action === 'blocked') return { ok: false, error: '只能安装版本号更高的更新包。' }
  if (incoming.integrity && incoming.integrity !== preview.digest) return { ok: false, error: '内容包完整性校验失败。' }
  const next: InstalledContentPackage = {
    packageId: incoming.packageId, name: incoming.name, version: incoming.version, owner: incoming.owner,
    license: incoming.license, note: incoming.note, description: incoming.description, sourceUrl: incoming.sourceUrl,
    changelog: incoming.changelog, digest: preview.digest, installedAt: now().toISOString(),
    sets: JSON.parse(JSON.stringify(incoming.sets)) as InstalledContentPackage['sets'],
  }
  return { ok: true, packages: [...installed.filter(({ packageId }) => packageId !== incoming.packageId), next] }
}

export function uninstallPackage(packageId: string, installed: InstalledContentPackage[]): InstalledContentPackage[] {
  return installed.filter((item) => item.packageId !== packageId)
}
