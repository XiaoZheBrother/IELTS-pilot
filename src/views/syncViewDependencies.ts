import type { InjectionKey } from 'vue'
import type { EncryptedVaultEnvelope, VaultCryptoOptions } from '../domain/encryptedVault'
import type { VaultTransport, VaultTransportOptions } from '../platform/vaultTransport'
import type { PracticeRepository } from '../storage/practiceRepository'
import type { SyncSettingsRepository } from '../storage/syncSettingsRepository'

export interface SyncViewDependencies {
  repository: PracticeRepository
  settingsRepository: SyncSettingsRepository
  encrypt: (plaintext: string, passphrase: string, options: VaultCryptoOptions) => Promise<EncryptedVaultEnvelope>
  decrypt: (envelope: EncryptedVaultEnvelope | string | unknown, passphrase: string) => Promise<string>
  createTransport: (options: VaultTransportOptions) => VaultTransport
  download: (name: string, content: string) => void
  now: () => Date
}

export const SYNC_VIEW_KEY: InjectionKey<SyncViewDependencies> = Symbol('ielts-pilot-sync-view')
