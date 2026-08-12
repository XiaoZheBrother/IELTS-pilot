<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import QuestionRenderer from '../components/QuestionRenderer.vue'
import { useMockSession } from '../composables/useMockSession'
import { fullReadingMock, getMockPracticeSets } from '../data/fullMock'
import { questionTypeLabels } from '../domain/questionLabels'
import { createBrowserPracticeRepository } from '../storage/practiceRepository'

const route = useRoute()
const router = useRouter()
const validMock = String(route.params.mockId) === fullReadingMock.id
const practiceSets = getMockPracticeSets(String(route.params.mockId))
const session = useMockSession(fullReadingMock, practiceSets, { repository: createBrowserPracticeRepository() })
const confirmOpen = ref(false)
const mobilePane = ref<'passage' | 'questions'>('questions')
const currentQuestion = computed(() => session.currentEntry.value.question)
const currentSet = computed(() => session.currentEntry.value.practiceSet)
const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

function completeSubmission(): void {
  const attempt = session.submit('manual')
  confirmOpen.value = false
  void router.replace(`/result/${attempt.id}`)
}

let timer: number | undefined
onMounted(() => {
  if (!validMock || practiceSets.length !== 3) { void router.replace('/'); return }
  timer = window.setInterval(() => {
    const attempt = session.tick()
    if (attempt) { window.clearInterval(timer); void router.replace(`/result/${attempt.id}`) }
  }, 1000)
})
onBeforeUnmount(() => window.clearInterval(timer))
</script>

<template>
  <main v-if="validMock && currentQuestion" class="mock-page">
    <header class="exam-toolbar">
      <div class="exam-brand"><strong>IELTS PILOT</strong><span>完整模考</span></div>
      <nav class="passage-tabs" aria-label="文章切换">
        <button v-for="(set, index) in practiceSets" :key="set.id" data-testid="passage-tab" :class="{ active: session.currentPassageIndex.value === index }" @click="session.goToPassage(index)">PASSAGE {{ index + 1 }}</button>
      </nav>
      <div class="exam-timer" :class="{ urgent: session.remainingSeconds.value <= 300 }"><span>剩余时间</span><strong>{{ formatTime(session.remainingSeconds.value) }}</strong></div>
      <button class="submit-exam" type="button" @click="confirmOpen = true">提交试卷</button>
    </header>

    <div class="mobile-pane-switch" aria-label="移动端内容切换"><button :class="{ active: mobilePane === 'passage' }" @click="mobilePane = 'passage'">阅读文章</button><button :class="{ active: mobilePane === 'questions' }" @click="mobilePane = 'questions'">回答问题</button></div>

    <div class="exam-workspace">
      <article class="exam-passage" :class="{ 'mobile-pane--hidden': mobilePane !== 'passage' }">
        <header><p class="section-kicker">Passage {{ session.currentPassageIndex.value + 1 }} / 3</p><h1>{{ currentSet.passage.title }}</h1><p>{{ currentSet.passage.deck }}</p></header>
        <section v-for="(section, index) in currentSet.passage.sections" :key="section.heading" class="passage-block">
          <span>{{ String.fromCharCode(65 + index) }}</span><div><h2>{{ section.heading }}</h2><p v-for="paragraph in section.paragraphs" :key="paragraph">{{ paragraph }}</p></div>
        </section>
        <footer>{{ currentSet.provenance.note }}</footer>
      </article>

      <aside class="exam-questions" :class="{ 'mobile-pane--hidden': mobilePane !== 'questions' }">
        <div class="question-context"><div><p class="section-kicker">Question {{ session.currentIndex.value + 1 }} / 40</p><strong>{{ questionTypeLabels[currentQuestion.type] }}</strong></div><button class="flag-button" :class="{ active: session.flags.value.includes(currentQuestion.id) }" type="button" @click="session.toggleFlag(currentQuestion.id)">{{ session.flags.value.includes(currentQuestion.id) ? '已标记' : '标记此题' }}</button></div>
        <QuestionRenderer :key="currentQuestion.id" :question="currentQuestion" :model-value="session.answers.value[currentQuestion.id] ?? []" @update:model-value="session.answerQuestion(currentQuestion.id, $event)" />
        <div class="question-actions"><button type="button" :disabled="session.currentIndex.value === 0" @click="session.goToQuestion(session.currentIndex.value - 1)">上一题</button><button type="button" :disabled="session.currentIndex.value === 39" @click="session.goToQuestion(session.currentIndex.value + 1)">下一题 →</button></div>
      </aside>
    </div>

    <nav class="mock-question-nav" aria-label="40 题导航">
      <div class="nav-legend"><span>○ 未作答</span><span>● 已作答</span><span>◆ 已标记</span></div>
      <div><button v-for="entry in session.entries" :key="entry.question.id" data-testid="mock-question" :aria-label="`第 ${entry.globalIndex + 1} 题`" :class="{ active: entry.globalIndex === session.currentIndex.value, answered: session.answers.value[entry.question.id]?.some((answer) => answer.trim()), flagged: session.flags.value.includes(entry.question.id) }" @click="session.goToQuestion(entry.globalIndex)">{{ entry.globalIndex + 1 }}</button></div>
    </nav>

    <div v-if="confirmOpen" class="dialog-backdrop" @click.self="confirmOpen = false"><section class="submit-dialog" role="dialog" aria-modal="true" aria-labelledby="mock-submit-title"><button class="dialog-close" aria-label="关闭" @click="confirmOpen = false">×</button><p class="section-kicker">Ready to submit?</p><h2 id="mock-submit-title">确认提交完整模考？</h2><p>已完成 {{ session.answeredCount.value }} / 40 题，仍有 {{ 40 - session.answeredCount.value }} 题未作答。</p><div class="dialog-actions"><button @click="confirmOpen = false">继续检查</button><button class="signal-action" @click="completeSubmission">确认提交</button></div></section></div>
  </main>
</template>

