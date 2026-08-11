<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import ScoreSummary from '../components/ScoreSummary.vue'
import { getPracticeSet } from '../data/practiceSets'
import { createBrowserPracticeRepository } from '../storage/practiceRepository'

const route = useRoute()
const repository = createBrowserPracticeRepository()
const attempt = repository.getAttempt(String(route.params.attemptId))
const practiceSet = attempt ? getPracticeSet(attempt.testId) : undefined
const itemResults = computed(() => new Map(attempt?.score.items.map((item) => [item.questionId, item]) ?? []))

function answerLabel(questionId: string): string {
  const result = itemResults.value.get(questionId)
  if (!result?.givenAnswer) return '未作答'
  return result.givenAnswer
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes} 分 ${remainder} 秒`
}
</script>

<template>
  <main v-if="attempt && practiceSet" class="result-page page-shell">
    <header class="result-hero">
      <div>
        <p class="section-kicker">Practice report · {{ practiceSet.sequence }}</p>
        <h1>这次阅读，<br /><em>哪里真正读懂了？</em></h1>
        <p>{{ practiceSet.title }} · 用时 {{ formatDuration(attempt.durationSeconds) }}</p>
      </div>
      <div class="result-hero__actions">
        <RouterLink class="secondary-action" to="/">返回练习桌</RouterLink>
        <RouterLink class="primary-action" :to="`/practice/${practiceSet.id}`">再练一次 <span>↗</span></RouterLink>
      </div>
    </header>

    <ScoreSummary :score="attempt.score" />

    <section class="review-section">
      <header class="section-heading">
        <div>
          <p class="section-kicker">Answer review</p>
          <h2>逐题复盘</h2>
        </div>
        <p>先看判断，再看证据。</p>
      </header>

      <div class="review-list">
        <article
          v-for="(question, index) in practiceSet.questions"
          :key="question.id"
          class="review-item"
          :class="{ 'review-item--correct': itemResults.get(question.id)?.isCorrect }"
        >
          <span class="review-item__number">{{ String(index + 1).padStart(2, '0') }}</span>
          <div class="review-item__body">
            <div class="review-item__status">
              <strong>{{ itemResults.get(question.id)?.isCorrect ? '回答正确' : '需要复盘' }}</strong>
              <span>{{ question.type === 'multiple-choice' ? '单项选择' : question.type === 'true-false-not-given' ? '判断信息' : '简短回答' }}</span>
            </div>
            <h3>{{ question.prompt }}</h3>
            <dl>
              <div>
                <dt>你的答案</dt>
                <dd>{{ answerLabel(question.id) }}</dd>
              </div>
              <div>
                <dt>参考答案</dt>
                <dd>{{ question.acceptedAnswers.join(' / ') }}</dd>
              </div>
            </dl>
            <p class="review-item__explanation"><span>解析</span>{{ question.explanation }}</p>
          </div>
        </article>
      </div>
    </section>
  </main>

  <main v-else class="missing-result page-shell">
    <p class="section-kicker">Report not found</p>
    <h1>这份练习记录不存在</h1>
    <p>记录可能来自另一个浏览器，或本地数据已被清除。</p>
    <RouterLink class="primary-action" to="/">返回练习桌</RouterLink>
  </main>
</template>
