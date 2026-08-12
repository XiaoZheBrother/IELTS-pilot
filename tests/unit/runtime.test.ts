import { isDesktopRuntime } from '../../src/platform/runtime'

describe('runtime detection', () => {
  it('detects the Tauri internal marker without depending on Tauri APIs', () => {
    expect(isDesktopRuntime({} as typeof globalThis)).toBe(false)
    expect(isDesktopRuntime({ __TAURI_INTERNALS__: {} } as unknown as typeof globalThis)).toBe(true)
  })
})
