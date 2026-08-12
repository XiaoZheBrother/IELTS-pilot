export interface UpdaterEvent {
  event: 'Started' | 'Progress' | 'Finished'
  data?: { contentLength?: number; chunkLength?: number }
}

export interface PluginUpdate {
  version: string
  date?: string
  body?: string
  downloadAndInstall: (listener: (event: UpdaterEvent) => void) => Promise<void>
}

export interface UpdaterBindings {
  check: () => Promise<PluginUpdate | null>
  relaunch: () => Promise<void>
}

export interface AvailableUpdate {
  version: string
  date?: string
  notes: string
  downloadAndInstall: PluginUpdate['downloadAndInstall']
}

export type UpdateCheckResult =
  | { status: 'unsupported' }
  | { status: 'current' }
  | { status: 'available'; update: AvailableUpdate }
  | { status: 'error'; message: string }

export interface UpdateProgress {
  downloadedBytes: number
  totalBytes: number
  percent: number
}

export interface AppUpdater {
  supported: boolean
  check: () => Promise<UpdateCheckResult>
  install: (update: AvailableUpdate, onProgress: (progress: UpdateProgress) => void) => Promise<void>
}

export const APP_UPDATER_KEY: InjectionKey<AppUpdater> = Symbol('ielts-pilot-app-updater')

interface UpdaterCheckOptions {
  timeout: number
  proxy?: string
}

export function buildUpdaterCheckOptions(systemProxy: string | null): UpdaterCheckOptions {
  const options: UpdaterCheckOptions = { timeout: 30_000 }
  if (!systemProxy) return options
  try {
    const url = new URL(systemProxy)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return options
    if (url.pathname !== '/' || url.search || url.hash) return options
    options.proxy = url.toString()
  } catch {
    // Native proxy discovery is best-effort; direct access remains available.
  }
  return options
}

function updaterErrorDetail(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error)
  return detail.trim().replace(/\s+/g, ' ').slice(0, 180) || '未知错误'
}

export function createAppUpdater(desktop: boolean, bindings?: UpdaterBindings): AppUpdater {
  return {
    supported: desktop,
    async check() {
      if (!desktop || !bindings) return { status: 'unsupported' }
      try {
        const update = await bindings.check()
        if (!update) return { status: 'current' }
        return {
          status: 'available',
          update: {
            version: update.version,
            date: update.date,
            notes: update.body?.trim() || '此版本未提供更新说明。',
            downloadAndInstall: update.downloadAndInstall.bind(update),
          },
        }
      } catch (error) {
        return {
          status: 'error',
          message: `检查更新失败：${updaterErrorDetail(error)}。请确认网络或代理设置后重试。`,
        }
      }
    },
    async install(update, onProgress) {
      if (!desktop || !bindings) throw new Error('应用内更新仅在桌面版可用。')
      let downloadedBytes = 0
      let totalBytes = 0
      try {
        await update.downloadAndInstall((event) => {
          if (event.event === 'Started') {
            downloadedBytes = 0
            totalBytes = event.data?.contentLength ?? 0
          } else if (event.event === 'Progress') {
            downloadedBytes += event.data?.chunkLength ?? 0
          } else if (event.event === 'Finished' && totalBytes) {
            downloadedBytes = totalBytes
          }
          const percent = event.event === 'Finished'
            ? 100
            : totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0
          onProgress({ downloadedBytes, totalBytes, percent })
        })
        await bindings.relaunch()
      } catch {
        throw new Error('更新下载或安装失败，请稍后重试。')
      }
    },
  }
}

async function loadTauriBindings(): Promise<UpdaterBindings> {
  const [{ check }, { relaunch }, { invoke }] = await Promise.all([
    import('@tauri-apps/plugin-updater'),
    import('@tauri-apps/plugin-process'),
    import('@tauri-apps/api/core'),
  ])
  return {
    async check() {
      let proxy: string | null = null
      try { proxy = await invoke<string | null>('get_system_proxy') }
      catch { /* direct updater access is still worth trying */ }
      return check(buildUpdaterCheckOptions(proxy))
    },
    relaunch,
  }
}

export function createRuntimeAppUpdater(
  desktop = isDesktopRuntime(),
  loadBindings: () => Promise<UpdaterBindings> = loadTauriBindings,
): AppUpdater {
  if (!desktop) return createAppUpdater(false)
  let delegate: Promise<AppUpdater> | null = null
  const resolveDelegate = () => {
    delegate ??= loadBindings().then((bindings) => createAppUpdater(true, bindings))
    return delegate
  }
  return {
    supported: true,
    async check() {
      try { return await (await resolveDelegate()).check() }
      catch { return { status: 'error', message: '更新组件加载失败，请重新启动应用后重试。' } }
    },
    async install(update, onProgress) {
      return (await resolveDelegate()).install(update, onProgress)
    },
  }
}
import type { InjectionKey } from 'vue'
import { isDesktopRuntime } from './runtime'
