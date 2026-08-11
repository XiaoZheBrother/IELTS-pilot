<script setup lang="ts">
import { RouterLink } from 'vue-router'
import PracticeCard from '../components/PracticeCard.vue'
import { practiceSets } from '../data/practiceSets'
import { createBrowserPracticeRepository } from '../storage/practiceRepository'

const repository = createBrowserPracticeRepository()
const attempts = repository.listAttempts()

function latestAttempt(testId: string) {
  return attempts.find((attempt) => attempt.testId === testId) ?? null
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
</script>

<template>
  <main>
    <section class="dashboard-hero page-shell">
      <div class="dashboard-hero__copy">
        <p class="section-kicker">Independent reading practice · v0.1</p>
        <h1>读懂文章，<br /><em>也读懂每一个失分点。</em></h1>
        <p class="dashboard-hero__lede">
          一张为雅思阅读准备的个人练习桌：限时作答、自动保存、即时评分，并把每个答案的依据摊开给你看。
        </p>
        <a class="primary-action" href="#practice-library">选择一套练习 <span>↓</span></a>
      </div>
      <aside class="dashboard-hero__brief" aria-label="MVP 功能说明">
        <span class="brief-stamp">Reading<br />Desk</span>
        <ol>
          <li><span>01</span> 英文原创文章</li>
          <li><span>02</span> 三种阅读题型</li>
          <li><span>03</span> 逐题答案解析</li>
        </ol>
        <p>数据只保存在当前浏览器。</p>
      </aside>
    </section>

    <section id="practice-library" class="practice-library page-shell">
      <header class="section-heading">
        <div>
          <p class="section-kicker">Practice library</p>
          <h2>今天，从一篇文章开始</h2>
        </div>
        <p>2 套练习 · 16 道题 · 约 50 分钟</p>
      </header>
      <div class="practice-grid">
        <PracticeCard
          v-for="practiceSet in practiceSets"
          :key="practiceSet.id"
          :practice-set="practiceSet"
          :draft="repository.getDraft(practiceSet.id)"
          :latest-attempt="latestAttempt(practiceSet.id)"
        />
      </div>
      <p class="originality-note">
        <strong>内容说明：</strong>当前内置文章与题目均为项目原创练习材料，不是官方 IELTS 真题。
      </p>
    </section>

    <section class="history-section page-shell">
      <header class="section-heading">
        <div>
          <p class="section-kicker">Recent attempts</p>
          <h2>最近成绩</h2>
        </div>
      </header>
      <div v-if="attempts.length" class="history-list">
        <RouterLink
          v-for="attempt in attempts.slice(0, 6)"
          :key="attempt.id"
          class="history-row"
          :to="`/result/${attempt.id}`"
        >
          <span>{{ practiceSets.find(({ id }) => id === attempt.testId)?.title }}</span>
          <time :datetime="attempt.submittedAt">{{ formatDate(attempt.submittedAt) }}</time>
          <strong>{{ attempt.score.correct }}/{{ attempt.score.total }}</strong>
          <i>Band {{ attempt.score.approximateBand.toFixed(1) }}</i>
          <b aria-hidden="true">→</b>
        </RouterLink>
      </div>
      <p v-else class="empty-history">完成第一套练习后，你的成绩与复盘入口会出现在这里。</p>
    </section>
  </main>
</template>
