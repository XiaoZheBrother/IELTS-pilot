export interface SupportDiagnosticInput {
  appVersion: string
  runtime: 'desktop' | 'browser'
  platform: string
  generatedAt?: Date
  storage: {
    readable: boolean
    readingAttempts: number
    readingDrafts: number
    installedPackages: number
    writingDrafts: number
    writingReports: number
    planItems: number
    conversations: number
    messages: number
  }
  ai: { available: boolean; credentialConfigured: boolean; mode: 'desktop' | 'gateway' }
  update: { supported: boolean; lastStatus: 'not-checked' | 'current' | 'available' | 'error' }
  unsafeContext?: unknown
}

function count(value: number): number {
  return Number.isInteger(value) && value >= 0 ? Math.min(value, 1_000_000) : 0
}

export function buildSupportDiagnostic(input: SupportDiagnosticInput) {
  return {
    protocol: 'ielts-pilot-support-diagnostic' as const,
    version: 1 as const,
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    app: {
      version: input.appVersion.slice(0, 40), runtime: input.runtime,
      platform: input.platform.trim().slice(0, 120) || 'unknown',
    },
    storage: {
      readable: input.storage.readable,
      readingAttempts: count(input.storage.readingAttempts), readingDrafts: count(input.storage.readingDrafts),
      installedPackages: count(input.storage.installedPackages), writingDrafts: count(input.storage.writingDrafts),
      writingReports: count(input.storage.writingReports), planItems: count(input.storage.planItems),
      conversations: count(input.storage.conversations), messages: count(input.storage.messages),
    },
    ai: {
      available: input.ai.available, credentialConfigured: input.ai.credentialConfigured, mode: input.ai.mode,
    },
    update: { supported: input.update.supported, lastStatus: input.update.lastStatus },
    privacy: {
      excludesLearningContent: true, excludesCredentials: true, excludesNetworkAddresses: true,
    },
  }
}
