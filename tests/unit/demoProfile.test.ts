import { installDemoProfile } from '../../src/domain/demoProfile'
import { createPracticeRepository } from '../../src/storage/practiceRepository'
import { createWritingRepository } from '../../src/storage/writingRepository'

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return { get length() { return values.size }, clear: () => values.clear(), getItem: (key) => values.get(key) ?? null, key: (index) => [...values.keys()][index] ?? null, removeItem: (key) => values.delete(key), setItem: (key, value) => values.set(key, value) }
}

describe('installDemoProfile', () => {
  it('installs a locally generated reading history, draft, favorites, annotation and writing report', () => {
    const practice = createPracticeRepository(memoryStorage(), () => new Date('2026-08-12T09:30:00.000Z'))
    const writing = createWritingRepository(memoryStorage())

    const result = installDemoProfile(practice, writing, () => new Date('2026-08-12T09:30:00.000Z'))

    expect(result).toEqual({ readingAttempts: 3, writingReports: 2, message: expect.stringContaining('演示数据') })
    expect(practice.listAttempts()).toHaveLength(3)
    expect(practice.listAttempts().some(({ score }) => score.items.some(({ isCorrect }) => !isCorrect))).toBe(true)
    expect(practice.getDraft('shade-networks')?.answers).toBeTruthy()
    expect(practice.listFavoriteSetIds()).toContain('shade-networks')
    expect(practice.listFavoriteQuestionIds()).toContain('shade_q2')
    expect(practice.listAnnotations('shade-networks')[0]?.selectedText).toBe('same journey can feel radically longer')
    expect(writing.listReports()[0]).toMatchObject({ id: 'demo-writing-balanced-library', overallBand: 7 })
  })

  it('is idempotent and does not toggle demo favorites off', () => {
    const practice = createPracticeRepository(memoryStorage(), () => new Date('2026-08-12T09:30:00.000Z'))
    const writing = createWritingRepository(memoryStorage())

    installDemoProfile(practice, writing)
    installDemoProfile(practice, writing)

    expect(practice.listAttempts()).toHaveLength(3)
    expect(practice.listFavoriteSetIds()).toContain('shade-networks')
    expect(practice.listFavoriteQuestionIds()).toContain('shade_q2')
    expect(writing.listReports()).toHaveLength(2)
  })
})
