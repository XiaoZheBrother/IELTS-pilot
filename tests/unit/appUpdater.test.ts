import { createAppUpdater, type UpdaterBindings } from '../../src/platform/appUpdater'

describe('app updater adapter', () => {
  it('keeps browser builds on an explicit unsupported path', async () => {
    const updater = createAppUpdater(false)

    expect(updater.supported).toBe(false)
    await expect(updater.check()).resolves.toEqual({ status: 'unsupported' })
  })

  it('maps a desktop release and reports cumulative download progress', async () => {
    const events: Array<{ event: 'Started' | 'Progress' | 'Finished'; data?: { contentLength?: number; chunkLength?: number } }> = []
    const progress: number[] = []
    const bindings: UpdaterBindings = {
      async check() {
        return {
          version: '0.6.1', date: '2026-08-12T08:00:00.000Z', body: 'Security release.',
          async downloadAndInstall(listener) {
            const sequence = [
              { event: 'Started' as const, data: { contentLength: 100 } },
              { event: 'Progress' as const, data: { chunkLength: 25 } },
              { event: 'Progress' as const, data: { chunkLength: 75 } },
              { event: 'Finished' as const },
            ]
            sequence.forEach((event) => { events.push(event); listener(event) })
          },
        }
      },
      relaunch: vi.fn(async () => undefined),
    }

    const updater = createAppUpdater(true, bindings)
    const result = await updater.check()
    expect(result).toMatchObject({ status: 'available', update: { version: '0.6.1', notes: 'Security release.' } })
    if (result.status !== 'available') throw new Error('Expected an available update')

    await updater.install(result.update, (value) => progress.push(value.percent))

    expect(events).toHaveLength(4)
    expect(progress).toEqual([0, 25, 100, 100])
    expect(bindings.relaunch).toHaveBeenCalledOnce()
  })

  it('returns current when the desktop endpoint has no newer release', async () => {
    const updater = createAppUpdater(true, { check: async () => null, relaunch: async () => undefined })
    await expect(updater.check()).resolves.toEqual({ status: 'current' })
  })

  it('turns plugin failures into stable user-facing errors', async () => {
    const updater = createAppUpdater(true, {
      check: async () => { throw new Error('network timeout') },
      relaunch: async () => undefined,
    })

    await expect(updater.check()).resolves.toEqual({ status: 'error', message: '检查更新失败，请确认网络后重试。' })
  })
})
