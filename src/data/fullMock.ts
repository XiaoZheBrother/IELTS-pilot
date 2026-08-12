import type { MockTest, PracticeSet } from '../domain/models'
import { getPracticeSet } from './practiceSets'

export const fullReadingMock: MockTest = {
  id: 'reading-mock-01',
  title: 'Reading Mock 01',
  description: '3 篇原创文章、40 道题、60 分钟，完整模拟学术类阅读节奏。',
  durationMinutes: 60,
  practiceSetIds: ['shade-networks', 'repair-libraries', 'rainwater-ledgers'],
}

export function getMockPracticeSets(mockId: string): PracticeSet[] {
  if (mockId !== fullReadingMock.id) return []
  return fullReadingMock.practiceSetIds
    .map((id) => getPracticeSet(id))
    .filter((set): set is PracticeSet => Boolean(set))
}

