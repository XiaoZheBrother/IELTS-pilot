<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { deriveReadingAnalytics } from '../domain/analytics'
import { questionTypeLabels } from '../domain/questionLabels'
import { createBrowserPracticeRepository } from '../storage/practiceRepository'

const repository = createBrowserPracticeRepository()
const attempts = ref(repository.listAttempts())
const analytics = ref(deriveReadingAnalytics(attempts.value))
const backupMessage = ref('')

function exportBackup(): void {
  const blob = new Blob([repository.exportBackup()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = `ielts-pilot-backup-${new Date().toISOString().slice(0, 10)}.json`; anchor.click()
  URL.revokeObjectURL(url)
}

async function importBackup(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const result = repository.importBackup(await file.text())
  backupMessage.value = result.ok ? `已恢复 ${result.attempts} 次成绩和 ${result.drafts} 份草稿。` : result.error
  if (result.ok) { attempts.value = repository.listAttempts(); analytics.value = deriveReadingAnalytics(attempts.value) }
  input.value = ''
}
</script>

<template>
  <main class="analytics-page page-shell">
    <header class="page-intro analytics-intro">
      <div><p class="section-kicker">Performance ledger</p><h1>成绩与诊断</h1></div>
      <div class="backup-actions"><button data-testid="export-backup" type="button" @click="exportBackup">导出数据备份</button><label>导入备份<input type="file" accept="application/json,.json" @change="importBackup" /></label></div>
    </header>
    <p class="import-feedback" aria-live="polite">{{ backupMessage }}</p>

    <section class="metric-ledger">
      <div><span>完成记录</span><strong>{{ analytics.attemptCount }} 次</strong></div>
      <div><span>平均估算</span><strong>{{ analytics.averageBand.toFixed(1) }}</strong></div>
      <div><span>最佳估算</span><strong>{{ analytics.bestBand.toFixed(1) }}</strong></div>
      <div><span>累计专注</span><strong>{{ Math.round(analytics.totalDurationSeconds / 60) }} min</strong></div>
    </section>

    <section class="diagnostic-grid">
      <div class="trend-panel">
        <header><div><p class="section-kicker">Recent five</p><h2>正确率趋势</h2></div></header>
        <div v-if="analytics.recentTrend.length" class="trend-bars">
          <div v-for="point in analytics.recentTrend" :key="point.attemptId"><span>{{ point.percentage }}%</span><i :style="{ height: `${Math.max(point.percentage, 4)}%` }" /><small>{{ point.band.toFixed(1) }}</small></div>
        </div>
        <p v-else class="empty-note">完成练习后显示最近五次趋势。</p>
      </div>
      <div class="type-panel">
        <header><p class="section-kicker">Question types</p><h2>题型诊断</h2></header>
        <div v-for="stat in analytics.typeAccuracy" :key="stat.type" class="type-stat"><span>{{ questionTypeLabels[stat.type] }}</span><i><b :style="{ width: `${stat.percentage}%` }" /></i><strong>{{ stat.percentage }}%</strong><small>{{ stat.correct }}/{{ stat.total }}</small></div>
        <p v-if="!analytics.typeAccuracy.length" class="empty-note">暂无可分析的题型数据。</p>
      </div>
    </section>

    <section class="attempt-table">
      <header class="index-heading"><div><p class="section-kicker">Attempt history</p><h2>全部记录</h2></div></header>
      <RouterLink v-for="attempt in attempts" :key="attempt.id" :to="`/result/${attempt.id}`"><span>{{ attempt.mode === 'mock' ? '完整模考' : '专项练习' }}</span><time>{{ new Date(attempt.submittedAt).toLocaleDateString('zh-CN') }}</time><strong>{{ attempt.score.correct }}/{{ attempt.score.total }}</strong><b>Band {{ attempt.score.approximateBand.toFixed(1) }}</b><i>→</i></RouterLink>
      <p v-if="!attempts.length" class="empty-note">尚无成绩记录。</p>
    </section>
  </main>
</template>

