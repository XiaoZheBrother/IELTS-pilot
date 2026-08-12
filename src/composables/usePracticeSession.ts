import { computed, ref, shallowRef } from 'vue'
import { scoreReadingTest } from '../domain/readingScorer'
import type { Attempt, PracticeSet, ReadingAnswers } from '../domain/models'
import type { PracticeRepository } from '../storage/practiceRepository'

export interface PracticeSessionOptions {
  repository: PracticeRepository
  now?: () => Date
  createId?: () => string
}

export function usePracticeSession(practiceSet: PracticeSet, options: PracticeSessionOptions) {
  const now = options.now ?? (() => new Date())
  const createId = options.createId ?? (() => crypto.randomUUID())
  const totalSeconds = practiceSet.durationMinutes * 60
  const draft = options.repository.getDraft(practiceSet.id)
  const answers = ref<ReadingAnswers>({ ...(draft?.answers ?? {}) })
  const flags = ref<string[]>([...(draft?.flags ?? [])])
  const currentIndex = ref(Math.min(Math.max(draft?.currentIndex ?? 0, 0), practiceSet.questions.length - 1))
  const remainingSeconds = ref(Math.min(Math.max(draft?.remainingSeconds ?? totalSeconds, 0), totalSeconds))
  const status = ref<'active' | 'submitted'>('active')
  const attempt = shallowRef<Attempt | null>(null)

  const answeredCount = computed(() => practiceSet.questions.filter(({ id }) => answers.value[id]?.some((answer) => answer.trim())).length)
  const progressPercentage = computed(() => Math.round((answeredCount.value / practiceSet.questions.length) * 100))

  function persistDraft(): void {
    if (status.value !== 'active') return
    options.repository.saveDraft({ testId: practiceSet.id, answers: { ...answers.value }, currentIndex: currentIndex.value, remainingSeconds: remainingSeconds.value, updatedAt: now().toISOString(), flags: [...flags.value] })
  }

  function answerQuestion(questionId: string, answer: string[]): void {
    if (status.value !== 'active') return
    answers.value = { ...answers.value, [questionId]: [...answer] }
    persistDraft()
  }

  function toggleFlag(questionId: string): void {
    if (status.value !== 'active') return
    flags.value = flags.value.includes(questionId) ? flags.value.filter((id) => id !== questionId) : [...flags.value, questionId]
    persistDraft()
  }

  function goToQuestion(index: number): void {
    if (status.value !== 'active') return
    currentIndex.value = Math.min(Math.max(index, 0), practiceSet.questions.length - 1)
    persistDraft()
  }

  function submit(reason: Attempt['submissionReason']): Attempt {
    if (attempt.value) return attempt.value
    const result: Attempt = {
      id: createId(), testId: practiceSet.id, mode: 'practice', answers: { ...answers.value },
      score: scoreReadingTest(practiceSet, answers.value), submittedAt: now().toISOString(),
      durationSeconds: totalSeconds - remainingSeconds.value, submissionReason: reason,
    }
    attempt.value = result
    status.value = 'submitted'
    options.repository.saveAttempt(result)
    options.repository.removeDraft(practiceSet.id)
    return result
  }

  function tick(): Attempt | null {
    if (status.value !== 'active') return attempt.value
    remainingSeconds.value = Math.max(remainingSeconds.value - 1, 0)
    if (remainingSeconds.value === 0) return submit('time-expired')
    persistDraft()
    return null
  }

  return { answers, flags, currentIndex, remainingSeconds, status, attempt, answeredCount, progressPercentage, answerQuestion, toggleFlag, goToQuestion, persistDraft, submit, tick }
}

