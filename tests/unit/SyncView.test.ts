import { flushPromises, mount } from '@vue/test-utils'
import SyncView from '../../src/views/SyncView.vue'
import { SYNC_VIEW_KEY, type SyncViewDependencies } from '../../src/views/syncViewDependencies'
import { createPracticeRepository } from '../../src/storage/practiceRepository'
import { createSyncSettingsRepository } from '../../src/storage/syncSettingsRepository'
import type { EncryptedVaultEnvelope } from '../../src/domain/encryptedVault'
import type { PracticeDraft } from '../../src/domain/models'

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return { get length() { return values.size }, clear: () => values.clear(), getItem: (key) => values.get(key) ?? null, key: (index) => [...values.keys()][index] ?? null, removeItem: (key) => values.delete(key), setItem: (key, value) => values.set(key, value) }
}

const envelope = {
  protocol: 'ielts-pilot-vault', version: 1, profileId: 'main', createdAt: '2026-08-12T04:00:00.000Z',
  kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 1_000, salt: 'AAAAAAAAAAAAAAAAAAAAAA' },
  cipher: { name: 'AES-GCM', tagLength: 128, iv: 'AAAAAAAAAAAAAAAA' }, ciphertext: 'AAAAAAAAAAAAAAAAAAAAAA',
} as EncryptedVaultEnvelope

const draft: PracticeDraft = { testId: 'set-1', answers: {}, currentIndex: 2, remainingSeconds: 900, updatedAt: '2026-08-12T01:00:00.000Z' }

function setup(overrides: Partial<SyncViewDependencies> = {}) {
  const practiceStorage = memoryStorage()
  const settingsStorage = memoryStorage()
  const repository = createPracticeRepository(practiceStorage, () => new Date('2026-08-12T01:00:00.000Z'))
  repository.saveDraft(draft)
  const downloads: Array<{ name: string; content: string }> = []
  const deps: SyncViewDependencies = {
    repository,
    settingsRepository: createSyncSettingsRepository(settingsStorage),
    encrypt: vi.fn(async () => envelope),
    decrypt: vi.fn(async () => repository.exportBackup()),
    download: (name, content) => downloads.push({ name, content }),
    createTransport: vi.fn(() => ({ pull: vi.fn(async () => ({ kind: 'missing' as const })), push: vi.fn(async () => ({ etag: '"new"' })) })),
    now: () => new Date('2026-08-12T05:00:00.000Z'),
    ...overrides,
  }
  const wrapper = mount(SyncView, { global: { provide: { [SYNC_VIEW_KEY as symbol]: deps } } })
  return { wrapper, deps, downloads, practiceStorage, settingsStorage }
}

async function fillCredentials(wrapper: ReturnType<typeof setup>['wrapper']) {
  await wrapper.get('[data-testid="profile-id"]').setValue('main')
  await wrapper.get('[data-testid="endpoint"]').setValue('https://sync.example.test')
  await wrapper.get('[data-testid="passphrase"]').setValue('a-secure-passphrase')
  await wrapper.get('[data-testid="access-token"]').setValue('ephemeral-token')
}

describe('SyncView', () => {
  it('persists only non-secret profile settings', async () => {
    const { wrapper, settingsStorage } = setup()
    await fillCredentials(wrapper)
    await wrapper.get('[data-testid="save-sync-settings"]').trigger('click')
    const serialized = [...Array(settingsStorage.length)].map((_, index) => settingsStorage.getItem(settingsStorage.key(index)!)).join('')
    expect(serialized).toContain('https://sync.example.test')
    expect(serialized).toContain('main')
    expect(serialized).not.toContain('a-secure-passphrase')
    expect(serialized).not.toContain('ephemeral-token')
  })

  it('exports a locally encrypted vault without sending it remotely', async () => {
    const { wrapper, deps, downloads } = setup()
    await fillCredentials(wrapper)
    await wrapper.get('[data-testid="export-vault"]').trigger('click')
    await flushPromises()
    expect(deps.encrypt).toHaveBeenCalledWith(expect.stringContaining('"version": 4'), 'a-secure-passphrase', expect.objectContaining({ profileId: 'main' }))
    expect(downloads).toEqual([{ name: 'ielts-pilot-main.vault.json', content: JSON.stringify(envelope, null, 2) }])
  })

  it('shows an import merge preview and waits for explicit confirmation', async () => {
    const remote = createPracticeRepository(memoryStorage(), () => new Date('2026-08-12T02:00:00.000Z'))
    remote.saveDraft({ ...draft, currentIndex: 6 })
    const { wrapper, deps } = setup({ decrypt: vi.fn(async () => remote.exportBackup()) })
    await fillCredentials(wrapper)
    await (wrapper.vm as unknown as { loadVaultText: (value: string) => Promise<void> }).loadVaultText(JSON.stringify(envelope))
    await flushPromises()
    expect(wrapper.text()).toContain('合并预览')
    expect(wrapper.text()).toContain('1 个冲突')
    expect(deps.repository.getDraft('set-1')?.currentIndex).toBe(2)
    await wrapper.get('[data-testid="confirm-vault-merge"]').trigger('click')
    expect(deps.repository.getDraft('set-1')?.currentIndex).toBe(6)
  })

  it('uploads the first encrypted remote vault and records an audit timestamp', async () => {
    const push = vi.fn(async () => ({ etag: '"new"' }))
    const { wrapper, deps } = setup({ createTransport: vi.fn(() => ({ pull: vi.fn(async () => ({ kind: 'missing' as const })), push })) })
    await fillCredentials(wrapper)
    await wrapper.get('[data-testid="run-remote-sync"]').trigger('click')
    await flushPromises()
    expect(push).toHaveBeenCalledWith(envelope)
    expect(wrapper.text()).toContain('首次加密上传完成')
    expect(deps.settingsRepository.load().lastSyncedAt).toBe('2026-08-12T05:00:00.000Z')
  })

  it('re-pulls, re-merges and retries once after an ETag conflict', async () => {
    const pull = vi.fn(async () => ({ kind: 'found' as const, envelope, etag: pull.mock.calls.length === 1 ? '"one"' : '"two"' }))
    const conflict = Object.assign(new Error('conflict'), { code: 'conflict' })
    const push = vi.fn().mockRejectedValueOnce(conflict).mockResolvedValueOnce({ etag: '"three"' })
    const { wrapper } = setup({ createTransport: vi.fn(() => ({ pull, push })) })
    await fillCredentials(wrapper)
    await wrapper.get('[data-testid="run-remote-sync"]').trigger('click')
    await flushPromises()
    expect(pull).toHaveBeenCalledTimes(2)
    expect(push).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('冲突已自动合并并重试')
  })
})
