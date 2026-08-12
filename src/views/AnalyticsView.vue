<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { deriveReadingAnalytics } from '../domain/analytics'
import { createPortableBackup, inspectPortableBackup, restorePortableBackup, type PortableBackupCounts } from '../domain/portableBackup'
import { questionTypeLabels } from '../domain/questionLabels'
import { APP_VERSION } from '../platform/runtime'
import { createBrowserAssistantConversationRepository } from '../storage/assistantConversationRepository'
import { createBrowserLearningPlanRepository } from '../storage/learningPlanRepository'
import { createBrowserPracticeRepository } from '../storage/practiceRepository'
import { createBrowserWritingRepository } from '../storage/writingRepository'

const repository = createBrowserPracticeRepository()
const repositories = {
  practice: repository,
  writing: createBrowserWritingRepository(),
  learningPlan: createBrowserLearningPlanRepository(),
  assistant: createBrowserAssistantConversationRepository(),
}
const attempts = ref(repository.listAttempts())
const analytics = ref(deriveReadingAnalytics(attempts.value))
const backupMessage = ref('')
type PendingBackup =
  | { kind: 'complete'; value: string; appVersion: string; exportedAt: string; counts: PortableBackupCounts }
  | { kind: 'legacy'; value: string; counts: { drafts: number; attempts: number; importedSets: number } }
const pendingBackup = ref<PendingBackup | null>(null)

function exportBackup(): void {
  const blob = new Blob([createPortableBackup(repositories, { appVersion: APP_VERSION })], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = `ielts-pilot-complete-backup-${new Date().toISOString().slice(0, 10)}.json`; anchor.click()
  URL.revokeObjectURL(url)
  backupMessage.value = '完整学习备份已生成。请把文件保存到安全位置。'
}

async function importBackup(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const value = await file.text()
  const complete = inspectPortableBackup(value, repositories)
  if (complete.ok) {
    pendingBackup.value = { kind: 'complete', value, appVersion: complete.appVersion, exportedAt: complete.exportedAt, counts: complete.counts }
    backupMessage.value = '完整学习备份校验通过。确认前不会修改当前数据。'
  } else {
    const legacy = repository.inspectBackup(value)
    if (legacy.ok) {
      pendingBackup.value = { kind: 'legacy', value, counts: legacy }
      backupMessage.value = '检测到旧版阅读备份：只会恢复阅读数据，不包含写作、计划和助手会话。'
    } else {
      pendingBackup.value = null
      backupMessage.value = complete.error
    }
  }
  input.value = ''
}

function confirmRestore(): void {
  const pending = pendingBackup.value
  if (!pending) return
  if (pending.kind === 'complete') {
    const result = restorePortableBackup(pending.value, repositories)
    if (!result.ok) { backupMessage.value = result.error; return }
    backupMessage.value = '完整学习数据已恢复。阅读、写作、计划和助手会话将在对应页面显示。'
  } else {
    const result = repository.importBackup(pending.value)
    if (!result.ok) { backupMessage.value = result.error; return }
    backupMessage.value = `旧版阅读数据已恢复：${result.attempts} 次成绩、${result.drafts} 份草稿。`
  }
  attempts.value = repository.listAttempts()
  analytics.value = deriveReadingAnalytics(attempts.value)
  pendingBackup.value = null
}
</script>

<template>
  <main class="analytics-page page-shell">
    <header class="page-intro analytics-intro">
      <div><p class="section-kicker">Performance ledger</p><h1>成绩与诊断</h1></div>
      <div class="backup-actions"><button data-testid="export-backup" type="button" @click="exportBackup">导出完整备份</button><label>选择备份文件<input data-testid="import-backup-input" type="file" accept="application/json,.json" @change="importBackup" /></label></div>
    </header>
    <p class="import-feedback" aria-live="polite">{{ backupMessage }}</p>

    <section class="complete-backup-panel" aria-labelledby="complete-backup-title">
      <div class="complete-backup-copy">
        <p class="section-kicker">Portable learning data</p>
        <h2 id="complete-backup-title">完整学习备份</h2>
        <p>一次迁移阅读记录与题库、写作草稿与报告、学习计划和助手会话。备份不包含 API Key、AI Endpoint、同步配置或代理地址。</p>
      </div>
      <div class="backup-scope" aria-label="备份范围">
        <span>阅读</span><span>写作</span><span>计划</span><span>对话</span>
      </div>
    </section>

    <section v-if="pendingBackup" class="backup-preview" aria-labelledby="backup-preview-title">
      <header><div><p class="section-kicker">Validated preview</p><h2 id="backup-preview-title">{{ pendingBackup.kind === 'complete' ? '完整备份待恢复' : '旧版阅读备份待恢复' }}</h2></div><strong>{{ pendingBackup.kind === 'complete' ? `来源 v${pendingBackup.appVersion}` : '兼容模式' }}</strong></header>
      <div v-if="pendingBackup.kind === 'complete'" class="backup-preview-counts">
        <div><span>阅读</span><strong>{{ pendingBackup.counts.readingAttempts }}</strong><small>成绩 · {{ pendingBackup.counts.readingDrafts }} 草稿</small></div>
        <div><span>写作</span><strong>{{ pendingBackup.counts.writingReports }}</strong><small>报告 · {{ pendingBackup.counts.writingDrafts }} 草稿</small></div>
        <div><span>计划</span><strong>{{ pendingBackup.counts.planItems }}</strong><small>训练任务</small></div>
        <div><span>助手</span><strong>{{ pendingBackup.counts.conversations }}</strong><small>会话 · {{ pendingBackup.counts.messages }} 消息</small></div>
      </div>
      <div v-else class="backup-preview-counts">
        <div><span>阅读成绩</span><strong>{{ pendingBackup.counts.attempts }}</strong><small>次记录</small></div>
        <div><span>阅读草稿</span><strong>{{ pendingBackup.counts.drafts }}</strong><small>份草稿</small></div>
        <div><span>导入题库</span><strong>{{ pendingBackup.counts.importedSets }}</strong><small>套练习</small></div>
      </div>
      <footer><p>恢复会替换本机对应学习数据。文件已经完整校验，但仍建议先导出当前备份。</p><button type="button" @click="pendingBackup = null">取消</button><button data-testid="confirm-backup-restore" class="signal-action" type="button" @click="confirmRestore">确认恢复</button></footer>
    </section>

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

