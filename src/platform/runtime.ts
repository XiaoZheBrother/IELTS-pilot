export const APP_NAME = 'IELTS Pilot'
export const APP_VERSION = '0.8.0'

export function isDesktopRuntime(scope: typeof globalThis = globalThis): boolean {
  return '__TAURI_INTERNALS__' in scope
}

export function runtimeLabel(): string {
  return isDesktopRuntime() ? 'Windows 桌面应用' : '浏览器'
}

export function platformLabel(): string {
  if (typeof navigator === 'undefined') return '未知平台'
  return navigator.platform || '未知平台'
}
