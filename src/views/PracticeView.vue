<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import QuestionRenderer from '../components/QuestionRenderer.vue'
import { getPracticeSet, practiceSets } from '../data/practiceSets'
import { usePracticeSession } from '../composables/usePracticeSession'
import { createBrowserPracticeRepository } from '../storage/practiceRepository'

const route = useRoute()
const router = useRouter()
const requestedSet = getPracticeSet(String(route.params.testId))
const practiceSet = requestedSet ?? practiceSets[0]!
const repository = createBrowserPracticeRepository()
const session = usePracticeSession(practiceSet, { repository })
const confirmOpen = ref(false)
const mobilePane = ref<'passage' | 'questions'>('questions')
const currentQuestion = computed(() => practiceSet.questions[session.currentIndex.value]!)

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function updateAnswer(value: string): void {
  session.answerQuestion(currentQuestion.value.id, value)
}

function completeSubmission(): void {
  const attempt = session.submit('manual')
  confirmOpen.value = false
  void router.replace(`/result/${attempt.id}`)
}

let timer: number | undefined
onMounted(() => {
  if (!requestedSet) {
    void router.replace('/')
    return
  }
  timer = window.setInterval(() => {
    const attempt = session.tick()
    if (attempt) {
      window.clearInterval(timer)
      void router.replace(`/result/${attempt.id}`)
    }
  }, 1000)
})

onBeforeUnmount(() => window.clearInterval(timer))
</script>

<template>
  <main class="practice-page">
    <header class="practice-toolbar">
      <RouterLink class="back-link" to="/" aria-label="返回练习首页">← 返回</RouterLink>
      <div class="practice-toolbar__title">
        <span>{{ practiceSet.sequence }}</span>
        <strong>{{ practiceSet.title }}</strong>
      </div>
      <div class="timer" :class="{ 'timer--urgent': session.remainingSeconds.value <= 300 }" aria-live="polite">
        <span>剩余时间</span>
        <strong>{{ formatTime(session.remainingSeconds.value) }}</strong>
      </div>
    </header>

    <div class="mobile-pane-switch" aria-label="移动端内容切换">
      <button :class="{ active: mobilePane === 'passage' }" @click="mobilePane = 'passage'">阅读文章</button>
      <button :class="{ active: mobilePane === 'questions' }" @click="mobilePane = 'questions'">回答问题</button>
    </div>

    <div class="practice-workspace">
      <article class="reading-paper" :class="{ 'mobile-pane--hidden': mobilePane !== 'passage' }">
        <header class="reading-paper__header">
          <p class="section-kicker">Reading passage</p>
          <h1>{{ practiceSet.passage.title }}</h1>
          <p>{{ practiceSet.passage.deck }}</p>
        </header>
        <section v-for="(section, index) in practiceSet.passage.sections" :key="section.heading" class="passage-section">
          <span>{{ String.fromCharCode(65 + index) }}</span>
          <div>
            <h2>{{ section.heading }}</h2>
            <p v-for="paragraph in section.paragraphs" :key="paragraph">{{ paragraph }}</p>
          </div>
        </section>
        <footer>{{ practiceSet.provenance.note }}</footer>
      </article>

      <aside class="question-desk" :class="{ 'mobile-pane--hidden': mobilePane !== 'questions' }">
        <div class="progress-header">
          <div>
            <p class="section-kicker">Question {{ session.currentIndex.value + 1 }}</p>
            <strong>{{ session.answeredCount.value }} / {{ practiceSet.questions.length }} 已作答</strong>
          </div>
          <span>{{ session.progressPercentage.value }}%</span>
        </div>
        <div class="progress-track"><i :style="{ width: `${session.progressPercentage.value}%` }" /></div>

        <nav class="question-nav" aria-label="题目导航">
          <button
            v-for="(question, index) in practiceSet.questions"
            :key="question.id"
            :aria-label="`第 ${index + 1} 题${session.answers.value[question.id] ? '，已作答' : ''}`"
            :class="{
              active: index === session.currentIndex.value,
              answered: Boolean(session.answers.value[question.id]?.trim()),
            }"
            @click="session.goToQuestion(index)"
          >
            {{ index + 1 }}
          </button>
        </nav>

        <section class="question-sheet">
          <div class="question-sheet__type">
            {{
              currentQuestion.type === 'multiple-choice'
                ? '单项选择'
                : currentQuestion.type === 'true-false-not-given'
                  ? '判断信息'
                  : '简短回答'
            }}
          </div>
          <QuestionRenderer
            :key="currentQuestion.id"
            :question="currentQuestion"
            :model-value="session.answers.value[currentQuestion.id] ?? ''"
            @update:model-value="updateAnswer"
          />
        </section>

        <div class="question-actions">
          <button
            class="secondary-action"
            :disabled="session.currentIndex.value === 0"
            @click="session.goToQuestion(session.currentIndex.value - 1)"
          >
            上一题
          </button>
          <button
            v-if="session.currentIndex.value < practiceSet.questions.length - 1"
            class="primary-action"
            @click="session.goToQuestion(session.currentIndex.value + 1)"
          >
            下一题 <span>→</span>
          </button>
          <button v-else class="primary-action primary-action--submit" @click="confirmOpen = true">提交并评分</button>
        </div>
        <button class="submit-text-button" @click="confirmOpen = true">提前提交本套练习</button>
        <p class="autosave-note"><span aria-hidden="true">✓</span> 答案已自动保存在此浏览器</p>
      </aside>
    </div>

    <div v-if="confirmOpen" class="dialog-backdrop" @click.self="confirmOpen = false">
      <section class="submit-dialog" role="dialog" aria-modal="true" aria-labelledby="submit-title">
        <button class="dialog-close" aria-label="关闭" @click="confirmOpen = false">×</button>
        <p class="section-kicker">Ready to check?</p>
        <h2 id="submit-title">确认提交这套练习？</h2>
        <p>
          你已完成 {{ session.answeredCount.value }} / {{ practiceSet.questions.length }} 题。提交后会立即显示估算分数和逐题解析。
        </p>
        <div class="dialog-actions">
          <button class="secondary-action" @click="confirmOpen = false">继续检查</button>
          <button class="primary-action" @click="completeSubmission">确认提交</button>
        </div>
      </section>
    </div>
  </main>
</template>
