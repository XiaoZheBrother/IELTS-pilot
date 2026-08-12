import { buildSupportDiagnostic } from '../../src/domain/supportDiagnostics'

describe('support diagnostics', () => {
  it('uses an explicit metadata whitelist and never serializes learning text or credentials', () => {
    const diagnostic = buildSupportDiagnostic({
      appVersion: '0.9.8', runtime: 'desktop', platform: 'Win32', generatedAt: new Date('2026-08-12T06:00:00.000Z'),
      storage: { readable: true, readingAttempts: 3, readingDrafts: 1, installedPackages: 11, writingDrafts: 2, writingReports: 4, planItems: 5, conversations: 2, messages: 8 },
      ai: { available: true, credentialConfigured: true, mode: 'desktop' },
      update: { supported: true, lastStatus: 'current' },
      unsafeContext: {
        apiKey: 'sk-proj-do-not-export', endpoint: 'https://private.example/v1', essay: 'private essay body',
        answer: 'private answer', conversation: 'private conversation', proxy: 'http://corp.proxy:8080',
      },
    })
    const serialized = JSON.stringify(diagnostic)
    expect(diagnostic).toMatchObject({
      protocol: 'ielts-pilot-support-diagnostic', version: 1, app: { version: '0.9.8', runtime: 'desktop' },
      privacy: { excludesLearningContent: true, excludesCredentials: true, excludesNetworkAddresses: true },
    })
    expect(serialized).not.toMatch(/do-not-export|private\.example|private essay|private answer|private conversation|corp\.proxy/)
  })
})
