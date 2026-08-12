import { computed, ref, shallowRef } from 'vue'
import { scoreReadingTest } from '../domain/readingScorer'
import type { Attempt, MockTest, PracticeSet, ReadingAnswers, ReadingQuestion } from '../domain/models'
import type { PracticeSessionOptions } from './usePracticeSession'

export interface MockQuestionEntry {
  question: ReadingQuestion
  practiceSet: PracticeSet
  passageIndex: number
  globalIndex: number
}

export function useMockSession(mock: MockTest, practiceSets: PracticeSet[], options: PracticeSessionOptions) {
  const now = options.now ?? (() => new Date())
  const createId = options.createId ?? (() => crypto.randomUUID())
  const draftId = `mock:${mock.id}`
  const totalSeconds = mock.durationMinutes * 60
  const entries: MockQuestionEntry[] = practiceSets.flatMap((practiceSet, passageIndex) => practiceSet.questions.map((question) => ({ question, practiceSet, passageIndex, globalIndex: 0 }))).map((entry, globalIndex) => ({ ...entry, globalIndex }))
  const draft = options.repository.getDraft(draftId)
  const answers = ref<ReadingAnswers>({ ...(draft?.answers ?? {}) })
  const flags = ref<string[]>([...(draft?.flags ?? [])])
  const currentIndex = ref(Math.min(Math.max(draft?.currentIndex ?? 0, 0), Math.max(entries.length - 1, 0)))
  const remainingSeconds = ref(Math.min(Math.max(draft?.remainingSeconds ?? totalSeconds, 0), totalSeconds))
  const status = ref<'active' | 'submitted'>('active')
  const attempt = shallowRef<Attempt | null>(null)
  const currentEntry = computed(() => entries[currentIndex.value]!)
  const currentPassageIndex = computed(() => currentEntry.value?.passageIndex ?? 0)
  const answeredCount = computed(() => entries.filter(({ question }) => answers.value[question.id]?.some((answer) => answer.trim())).length)
  const progressPercentage = computed(() => entries.length ? Math.round((answeredCount.value / entries.length) * 100) : 0)

  function persistDraft(): void {
    if (status.value !== 'active') return
    options.repository.saveDraft({ testId: draftId, answers: { ...answers.value }, currentIndex: currentIndex.value, remainingSeconds: remainingSeconds.value, updatedAt: now().toISOString(), flags: [...flags.value] })
  }

  function answerQuestion(questionId: string, answer: string[]): void {
    if (status.value !== 'active') return
    answers.value = { ...answers.value, [questionId]: [...answer] }
    persistDraft()
  }

  function toggleFlag(questionId: string): void {
    flags.value = flags.value.includes(questionId) ? flags.value.filter((id) => id !== questionId) : [...flags.value, questionId]
    persistDraft()
  }

  function goToQuestion(index: number): void {
    currentIndex.value = Math.min(Math.max(index, 0), Math.max(entries.length - 1, 0))
    persistDraft()
  }

  function goToPassage(index: number): void {
    const first = entries.find(({ passageIndex }) => passageIndex === index)
    if (first) goToQuestion(first.globalIndex)
  }

  function combinedSet(): PracticeSet {
    return {
      id: mock.id, sequence: 'M1', eyebrow: 'Complete Mock', title: mock.title,
      summary: mock.description, level: 'B2–C1', durationMinutes: mock.durationMinutes,
      topics: ['完整模考'], difficulty: 'advanced', estimatedBand: 7,
      passage: { title: mock.title, deck: mock.description, sections: [] },
      provenance: { kind: 'original', author: 'IELTS Pilot', note: 'Combined from original bundled passages.', license: 'CC-BY-4.0' },
      questions: entries.map(({ question }) => question),
    }
  }

  function submit(reason: Attempt['submissionReason']): Attempt {
    if (attempt.value) return attempt.value
    const result: Attempt = {
      id: createId(), testId: mock.id, mode: 'mock', mockId: mock.id, answers: { ...answers.value },
      score: scoreReadingTest(combinedSet(), answers.value), submittedAt: now().toISOString(),
      durationSeconds: totalSeconds - remainingSeconds.value, submissionReason: reason,
    }
    attempt.value = result
    status.value = 'submitted'
    options.repository.saveAttempt(result)
    options.repository.removeDraft(draftId)
    return result
  }

  function tick(): Attempt | null {
    if (status.value !== 'active') return attempt.value
    remainingSeconds.value = Math.max(remainingSeconds.value - 1, 0)
    if (remainingSeconds.value === 0) return submit('time-expired')
    persistDraft()
    return null
  }

  return { entries, answers, flags, currentIndex, currentEntry, currentPassageIndex, remainingSeconds, answeredCount, progressPercentage, status, answerQuestion, toggleFlag, goToQuestion, goToPassage, persistDraft, submit, tick }
}

