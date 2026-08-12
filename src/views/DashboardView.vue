<script setup lang="ts">
import { RouterLink } from 'vue-router'
import PracticeCard from '../components/PracticeCard.vue'
import { deriveReadingAnalytics } from '../domain/analytics'
import { fullReadingMock } from '../data/fullMock'
import { practiceSets } from '../data/practiceSets'
import { createBrowserPracticeRepository } from '../storage/practiceRepository'

const repository = createBrowserPracticeRepository()
const attempts = repository.listAttempts()
const analytics = deriveReadingAnalytics(attempts)
const latestAttempt = (testId: string) => attempts.find((attempt) => attempt.testId === testId) ?? null
const formatDate = (value: string) => new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(new Date(value))
</script>

<template>
  <main class="dashboard page-shell">
    <section class="dashboard-index">
      <aside class="study-state">
        <p class="section-kicker">Study status · Local</p>
        <h1>阅读工作台</h1>
        <dl>
          <div><dt>当前估算</dt><dd>{{ analytics.attemptCount ? analytics.averageBand.toFixed(1) : '—' }}<small>Band</small></dd></div>
          <div><dt>已完成</dt><dd>{{ analytics.attemptCount }}<small>次练习</small></dd></div>
          <div><dt>累计专注</dt><dd>{{ Math.round(analytics.totalDurationSeconds / 60) }}<small>分钟</small></dd></div>
        </dl>
        <p>数据仅保存在当前浏览器，可在统计页导出备份。</p>
      </aside>

      <section class="mock-launch">
        <p class="section-kicker">Complete simulation · 01</p>
        <h2>完整模考 <em>60 MIN</em></h2>
        <p>{{ fullReadingMock.description }}</p>
        <ul><li>3 篇文章</li><li>40 道题</li><li>自动保存</li></ul>
        <RouterLink class="signal-action" :to="`/mock/${fullReadingMock.id}`">开始模考 <span aria-hidden="true">→</span></RouterLink>
      </section>

      <aside class="recent-strip">
        <div class="section-heading--line"><h2>最近表现</h2><RouterLink to="/analytics">查看统计</RouterLink></div>
        <RouterLink v-for="attempt in attempts.slice(0, 4)" :key="attempt.id" class="recent-attempt" :to="`/result/${attempt.id}`">
          <span>{{ attempt.mode === 'mock' ? '完整模考' : practiceSets.find(({ id }) => id === attempt.testId)?.title }}</span>
          <time>{{ formatDate(attempt.submittedAt) }}</time>
          <strong>{{ attempt.score.correct }}/{{ attempt.score.total }}</strong><b>{{ attempt.score.approximateBand.toFixed(1) }}</b>
        </RouterLink>
        <p v-if="!attempts.length" class="empty-note">完成第一篇练习后，这里会显示你的最近成绩。</p>
      </aside>
    </section>

    <section class="dashboard-library">
      <header class="index-heading">
        <div><p class="section-kicker">Practice index</p><h2>专项练习</h2></div>
        <RouterLink to="/library">打开完整题库 →</RouterLink>
      </header>
      <div class="practice-grid">
        <PracticeCard v-for="practiceSet in practiceSets" :key="practiceSet.id" :practice-set="practiceSet" :draft="repository.getDraft(practiceSet.id)" :latest-attempt="latestAttempt(practiceSet.id)" />
      </div>
      <p class="originality-note"><strong>内容说明：</strong>当前内置文章与题目均为项目原创练习材料，不是官方 IELTS 真题。</p>
    </section>
  </main>
</template>

