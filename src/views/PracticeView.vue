<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import QuestionRenderer from '../components/QuestionRenderer.vue'
import { usePracticeSession } from '../composables/usePracticeSession'
import { getPracticeSet } from '../data/practiceSets'
import { questionTypeLabels } from '../domain/questionLabels'
import { createBrowserPracticeRepository } from '../storage/practiceRepository'

const route = useRoute(); const router = useRouter(); const repository = createBrowserPracticeRepository()
const practiceSet = getPracticeSet(String(route.params.testId)) ?? repository.listImportedSets().find(({ id }) => id === String(route.params.testId))
const session = practiceSet ? usePracticeSession(practiceSet, { repository }) : null
const confirmOpen = ref(false); const mobilePane = ref<'passage' | 'questions'>('questions')
const currentQuestion = computed(() => practiceSet && session ? practiceSet.questions[session.currentIndex.value] : undefined)
const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
function submit(): void { if (!session) return; const attempt = session.submit('manual'); void router.replace(`/result/${attempt.id}`) }
let timer: number | undefined
onMounted(() => { if (!practiceSet || !session) { void router.replace('/library'); return }; timer = window.setInterval(() => { const attempt = session.tick(); if (attempt) { window.clearInterval(timer); void router.replace(`/result/${attempt.id}`) } }, 1000) })
onBeforeUnmount(() => window.clearInterval(timer))
</script>

<template>
  <main v-if="practiceSet && session && currentQuestion" class="mock-page practice-mode">
    <header class="exam-toolbar"><RouterLink class="exam-brand" to="/library"><strong>IELTS PILOT</strong><span>专项练习</span></RouterLink><div class="practice-title"><span>{{ practiceSet.sequence }}</span><strong>{{ practiceSet.title }}</strong></div><div class="exam-timer"><span>剩余时间</span><strong>{{ formatTime(session.remainingSeconds.value) }}</strong></div><button class="submit-exam" @click="confirmOpen = true">提交练习</button></header>
    <div class="mobile-pane-switch"><button :class="{ active: mobilePane === 'passage' }" @click="mobilePane = 'passage'">阅读文章</button><button :class="{ active: mobilePane === 'questions' }" @click="mobilePane = 'questions'">回答问题</button></div>
    <div class="exam-workspace">
      <article class="exam-passage" :class="{ 'mobile-pane--hidden': mobilePane !== 'passage' }"><header><p class="section-kicker">Reading passage</p><h1>{{ practiceSet.passage.title }}</h1><p>{{ practiceSet.passage.deck }}</p></header><section v-for="(section, index) in practiceSet.passage.sections" :key="section.heading" class="passage-block"><span>{{ String.fromCharCode(65 + index) }}</span><div><h2>{{ section.heading }}</h2><p v-for="paragraph in section.paragraphs" :key="paragraph">{{ paragraph }}</p></div></section><footer>{{ practiceSet.provenance.note }}</footer></article>
      <aside class="exam-questions" :class="{ 'mobile-pane--hidden': mobilePane !== 'questions' }"><div class="question-context"><div><p class="section-kicker">Question {{ session.currentIndex.value + 1 }} / {{ practiceSet.questions.length }}</p><strong>{{ questionTypeLabels[currentQuestion.type] }}</strong></div><button class="flag-button" :class="{ active: session.flags.value.includes(currentQuestion.id) }" @click="session.toggleFlag(currentQuestion.id)">{{ session.flags.value.includes(currentQuestion.id) ? '已标记' : '标记此题' }}</button></div><QuestionRenderer :key="currentQuestion.id" :question="currentQuestion" :model-value="session.answers.value[currentQuestion.id] ?? []" @update:model-value="session.answerQuestion(currentQuestion.id, $event)" /><div class="question-actions"><button :disabled="session.currentIndex.value === 0" @click="session.goToQuestion(session.currentIndex.value - 1)">上一题</button><button v-if="session.currentIndex.value < practiceSet.questions.length - 1" @click="session.goToQuestion(session.currentIndex.value + 1)">下一题 →</button><button v-else class="signal-action" @click="confirmOpen = true">提交并评分</button></div><nav class="compact-question-nav"><button v-for="(question, index) in practiceSet.questions" :key="question.id" :class="{ active: index === session.currentIndex.value, answered: session.answers.value[question.id]?.some((answer) => answer.trim()), flagged: session.flags.value.includes(question.id) }" @click="session.goToQuestion(index)">{{ index + 1 }}</button></nav></aside>
    </div>
    <div v-if="confirmOpen" class="dialog-backdrop" @click.self="confirmOpen = false"><section class="submit-dialog" role="dialog" aria-modal="true"><button class="dialog-close" aria-label="关闭" @click="confirmOpen = false">×</button><p class="section-kicker">Ready to check?</p><h2>确认提交这套练习？</h2><p>你已完成 {{ session.answeredCount.value }} / {{ practiceSet.questions.length }} 题。</p><div class="dialog-actions"><button @click="confirmOpen = false">继续检查</button><button class="signal-action" @click="submit">确认提交</button></div></section></div>
  </main>
</template>

