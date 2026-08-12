<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import ReviewItem from '../components/ReviewItem.vue'
import ScoreSummary from '../components/ScoreSummary.vue'
import { deriveReadingAnalytics } from '../domain/analytics'
import { getMockPracticeSets } from '../data/fullMock'
import { getPracticeSet } from '../data/practiceSets'
import { createBrowserPracticeRepository } from '../storage/practiceRepository'

const route = useRoute(); const repository = createBrowserPracticeRepository()
const attempt = repository.getAttempt(String(route.params.attemptId))
const sets = attempt?.mode === 'mock' ? getMockPracticeSets(attempt.mockId ?? attempt.testId) : [getPracticeSet(attempt?.testId ?? '') ?? repository.listImportedSets().find(({ id }) => id === attempt?.testId)].filter(Boolean)
const entries = sets.flatMap((practiceSet) => practiceSet ? practiceSet.questions.map((question) => ({ question, practiceSet })) : [])
const results = computed(() => new Map(attempt?.score.items.map((item) => [item.questionId, item]) ?? []))
const diagnostics = attempt ? deriveReadingAnalytics([attempt]) : null
const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`
</script>

<template>
  <main v-if="attempt && entries.length" class="result-page page-shell">
    <header class="result-heading"><div><p class="section-kicker">Attempt report · {{ attempt.mode === 'mock' ? 'Full mock' : 'Practice' }}</p><h1>本次成绩</h1><p>{{ attempt.mode === 'mock' ? '完整阅读模考' : entries[0]?.practiceSet.title }} · 用时 {{ formatDuration(attempt.durationSeconds) }}</p></div><div><RouterLink to="/analytics">查看统计</RouterLink><RouterLink class="signal-action" :to="attempt.mode === 'mock' ? `/mock/${attempt.mockId}` : `/practice/${attempt.testId}`">再练一次 →</RouterLink></div></header>
    <section class="result-overview"><ScoreSummary :score="attempt.score" /><div class="result-ledger"><header><h2>{{ attempt.score.total }} 题答题结果</h2><span><i /> 正确 <i /> 错误</span></header><div><span v-for="(item, index) in attempt.score.items" :key="item.questionId" :class="{ correct: item.isCorrect, wrong: !item.isCorrect }">{{ index + 1 }}</span></div></div><div class="result-types"><header><h2>题型诊断</h2></header><p v-for="stat in diagnostics?.typeAccuracy" :key="stat.type"><span>{{ stat.type }}</span><i><b :style="{ width: `${stat.percentage}%` }" /></i><strong>{{ stat.percentage }}%</strong></p></div></section>
    <section class="review-section"><header class="index-heading"><div><p class="section-kicker">Answer review</p><h2>错题复盘与原文定位</h2></div><p>{{ attempt.score.total - attempt.score.correct }} 道题需要复盘</p></header><div class="review-table"><ReviewItem v-for="(entry, index) in entries" :key="entry.question.id" :index="index" :question="entry.question" :result="results.get(entry.question.id)!" :practice-set="entry.practiceSet" /></div></section>
  </main>
  <main v-else class="missing-result page-shell"><p class="section-kicker">Report not found</p><h1>这份练习记录不存在</h1><RouterLink class="signal-action" to="/">返回工作台</RouterLink></main>
</template>

