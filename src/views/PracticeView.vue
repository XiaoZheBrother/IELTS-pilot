<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import PassageReader from '../components/PassageReader.vue'
import QuestionRenderer from '../components/QuestionRenderer.vue'
import { usePassageAnnotations } from '../composables/usePassageAnnotations'
import { usePracticeSession } from '../composables/usePracticeSession'
import { useReaderPreferences } from '../composables/useReaderPreferences'
import { getPracticeSet } from '../data/practiceSets'
import { questionTypeLabels } from '../domain/questionLabels'
import { createBrowserPracticeRepository } from '../storage/practiceRepository'

const route = useRoute()
const router = useRouter()
const repository = createBrowserPracticeRepository()
const practiceSet = getPracticeSet(String(route.params.testId)) ?? repository.listImportedSets().find(({ id }) => id === String(route.params.testId))
const session = practiceSet ? usePracticeSession(practiceSet, { repository, defaultTimed: repository.getPreferences().defaultTimedPractice }) : null
const reader = practiceSet ? usePassageAnnotations(practiceSet.id, repository) : null
const { preferences } = useReaderPreferences(repository)
const confirmOpen = ref(false)
const mobilePane = ref<'passage' | 'questions'>('questions')
const currentQuestion = computed(() => practiceSet && session ? practiceSet.questions[session.currentIndex.value] : undefined)
const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

function submit(): void {
  if (!session) return
  const attempt = session.submit('manual')
  confirmOpen.value = false
  void router.replace(`/result/${attempt.id}`)
}

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

function handleShortcut(event: KeyboardEvent): void {
  if (!session || !practiceSet || isTypingTarget(event.target)) return
  const key = event.key.toLocaleLowerCase()
  if (key === 'j') session.goToQuestion(session.currentIndex.value + 1)
  else if (key === 'k') session.goToQuestion(session.currentIndex.value - 1)
  else if (key === 'f' && currentQuestion.value) session.toggleFlag(currentQuestion.value.id)
  else if (key === '1') mobilePane.value = 'passage'
  else if (key === '2') mobilePane.value = 'questions'
  else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) confirmOpen.value = true
  else return
  event.preventDefault()
}

function beforeUnload(event: BeforeUnloadEvent): void {
  if (session?.status.value === 'active' && session.answeredCount.value > 0) event.preventDefault()
}

let timer: number | undefined
onMounted(() => {
  if (!practiceSet || !session) { void router.replace('/library'); return }
  window.addEventListener('keydown', handleShortcut)
  window.addEventListener('beforeunload', beforeUnload)
  timer = window.setInterval(() => {
    const attempt = session.tick()
    if (attempt) { window.clearInterval(timer); void router.replace(`/result/${attempt.id}`) }
  }, 1000)
})
onBeforeUnmount(() => {
  window.clearInterval(timer)
  window.removeEventListener('keydown', handleShortcut)
  window.removeEventListener('beforeunload', beforeUnload)
})
onBeforeRouteLeave(() => !session || session.status.value !== 'active' || session.answeredCount.value === 0 || window.confirm('当前答案已自动保存。确定离开练习吗？'))
</script>

<template>
  <main v-if="practiceSet && session && currentQuestion && reader" class="mock-page practice-mode">
    <header class="exam-toolbar">
      <RouterLink class="exam-brand" to="/library"><strong>IELTS PILOT</strong><span>专项练习</span></RouterLink>
      <div class="practice-title"><span>{{ practiceSet.sequence }}</span><strong>{{ practiceSet.title }}</strong></div>
      <button data-testid="pause-practice" class="pause-practice" type="button" @click="session.togglePause()">{{ session.isPaused.value ? '继续计时' : '暂停练习' }}</button>
      <div class="exam-timer" :class="{ paused: session.isPaused.value }"><span>{{ session.isPaused.value ? '练习已暂停' : '剩余时间' }}</span><strong>{{ formatTime(session.remainingSeconds.value) }}</strong></div>
      <button class="submit-exam" type="button" @click="confirmOpen = true">提交练习</button>
    </header>
    <div class="mobile-pane-switch"><button :class="{ active: mobilePane === 'passage' }" @click="mobilePane = 'passage'">阅读文章</button><button :class="{ active: mobilePane === 'questions' }" @click="mobilePane = 'questions'">回答问题</button></div>
    <div class="exam-workspace">
      <PassageReader :class="{ 'mobile-pane--hidden': mobilePane !== 'passage' }" :practice-set="practiceSet" :annotations="reader.annotations.value" :preferences="preferences" @add="reader.save" @update="reader.save" @remove="reader.remove" />
      <aside class="exam-questions" :class="{ 'mobile-pane--hidden': mobilePane !== 'questions' }">
        <div v-if="session.isPaused.value" class="paused-banner"><strong>练习已暂停</strong><span>答案仍会保留，继续后恢复计时。</span></div>
        <div class="question-context"><div><p class="section-kicker">Question {{ session.currentIndex.value + 1 }} / {{ practiceSet.questions.length }}</p><strong>{{ questionTypeLabels[currentQuestion.type] }}</strong></div><button class="flag-button" :class="{ active: session.flags.value.includes(currentQuestion.id) }" @click="session.toggleFlag(currentQuestion.id)">{{ session.flags.value.includes(currentQuestion.id) ? '已标记' : '标记此题' }}</button></div>
        <QuestionRenderer :key="currentQuestion.id" :question="currentQuestion" :model-value="session.answers.value[currentQuestion.id] ?? []" @update:model-value="session.answerQuestion(currentQuestion.id, $event)" />
        <div class="question-actions"><button :disabled="session.currentIndex.value === 0" @click="session.goToQuestion(session.currentIndex.value - 1)">上一题</button><button v-if="session.currentIndex.value < practiceSet.questions.length - 1" @click="session.goToQuestion(session.currentIndex.value + 1)">下一题 →</button><button v-else class="signal-action" @click="confirmOpen = true">提交并评分</button></div>
        <nav class="compact-question-nav"><button v-for="(question, index) in practiceSet.questions" :key="question.id" :class="{ active: index === session.currentIndex.value, answered: session.answers.value[question.id]?.some((answer) => answer.trim()), flagged: session.flags.value.includes(question.id) }" @click="session.goToQuestion(index)">{{ index + 1 }}</button></nav>
        <p class="shortcut-hint">快捷键 J/K 切题 · F 标记 · Ctrl/⌘+Enter 提交</p>
      </aside>
    </div>
    <div v-if="confirmOpen" class="dialog-backdrop" @click.self="confirmOpen = false"><section class="submit-dialog" role="dialog" aria-modal="true"><button class="dialog-close" aria-label="关闭" @click="confirmOpen = false">×</button><p class="section-kicker">Ready to check?</p><h2>确认提交这套练习？</h2><p>你已完成 {{ session.answeredCount.value }} / {{ practiceSet.questions.length }} 题。</p><div class="dialog-actions"><button @click="confirmOpen = false">继续检查</button><button class="signal-action" @click="submit">确认提交</button></div></section></div>
  </main>
</template>
