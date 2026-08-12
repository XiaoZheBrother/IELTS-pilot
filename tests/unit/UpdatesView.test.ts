import { mount } from '@vue/test-utils'
import UpdatesView from '../../src/views/UpdatesView.vue'
import { APP_UPDATER_KEY, type AppUpdater, type AvailableUpdate } from '../../src/platform/appUpdater'

function mountView(updater: AppUpdater) {
  return mount(UpdatesView, { global: { provide: { [APP_UPDATER_KEY as symbol]: updater } } })
}

describe('UpdatesView', () => {
  it('explains that browser builds do not install desktop updates', () => {
    const wrapper = mountView({
      supported: false,
      check: async () => ({ status: 'unsupported' }),
      install: async () => undefined,
    })

    expect(wrapper.text()).toContain('应用内更新仅在 Windows 桌面版可用')
    expect(wrapper.find('[data-testid="check-update"]').attributes('disabled')).toBeDefined()
  })

  it('checks the release channel and reports the current version', async () => {
    const wrapper = mountView({
      supported: true,
      check: async () => ({ status: 'current' }),
      install: async () => undefined,
    })

    expect(wrapper.text()).toContain('尚未执行本次检查')
    await wrapper.get('[data-testid="check-update"]').trigger('click')
    expect(wrapper.text()).toContain('检查完成，当前已是最新版本')
    expect(wrapper.text()).not.toContain('尚未执行本次检查')
  })

  it('reviews a release before explicit installation', async () => {
    const update: AvailableUpdate = {
      version: '0.6.1', date: '2026-08-12T08:00:00.000Z', notes: 'Security release.',
      downloadAndInstall: async () => undefined,
    }
    const install = vi.fn(async (_update: AvailableUpdate, onProgress: (value: { downloadedBytes: number; totalBytes: number; percent: number }) => void) => {
      onProgress({ downloadedBytes: 40, totalBytes: 100, percent: 40 })
    })
    const wrapper = mountView({ supported: true, check: async () => ({ status: 'available', update }), install })

    await wrapper.get('[data-testid="check-update"]').trigger('click')
    expect(wrapper.text()).toContain('0.6.1')
    expect(wrapper.text()).toContain('Security release.')
    expect(install).not.toHaveBeenCalled()

    await wrapper.get('[data-testid="install-update"]').trigger('click')
    expect(install).toHaveBeenCalledWith(update, expect.any(Function))
    expect(wrapper.text()).toContain('40%')
  })
})
