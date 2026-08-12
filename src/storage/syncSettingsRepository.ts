const STORAGE_KEY = 'ielts-pilot:sync-settings:v1'

export interface SyncSettings {
  profileId: string
  endpoint: string
  lastSyncedAt?: string
}

export interface SyncSettingsRepository {
  load: () => SyncSettings
  save: (settings: SyncSettings) => SyncSettings
}

function normalize(value: unknown): SyncSettings {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return { profileId: 'main', endpoint: '' }
  const raw = value as Record<string, unknown>
  const settings: SyncSettings = {
    profileId: typeof raw.profileId === 'string' && /^[A-Za-z0-9._-]{1,128}$/u.test(raw.profileId) ? raw.profileId : 'main',
    endpoint: typeof raw.endpoint === 'string' ? raw.endpoint.trim() : '',
  }
  if (typeof raw.lastSyncedAt === 'string' && Number.isFinite(Date.parse(raw.lastSyncedAt))) settings.lastSyncedAt = new Date(raw.lastSyncedAt).toISOString()
  return settings
}

export function createSyncSettingsRepository(storage: Storage): SyncSettingsRepository {
  return {
    load() {
      try { return normalize(JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null') as unknown) } catch { return normalize(null) }
    },
    save(value) {
      const settings = normalize(value)
      storage.setItem(STORAGE_KEY, JSON.stringify(settings))
      return settings
    },
  }
}

export function createBrowserSyncSettingsRepository(): SyncSettingsRepository {
  return createSyncSettingsRepository(window.localStorage)
}
