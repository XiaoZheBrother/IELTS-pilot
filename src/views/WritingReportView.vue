<script setup lang="ts">
import { computed, inject } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import WritingRubric from '../components/WritingRubric.vue'
import { writingTasks } from '../data/writingTasks'
import { WRITING_CRITERIA } from '../domain/writingAssessment'
import { createWritingAssessmentClient } from '../platform/writingAssessmentClient'
import { isDesktopRuntime } from '../platform/runtime'
import { WRITING_VIEW_KEY, type WritingViewDependencies } from '../platform/writingViewDependencies'
import { createBrowserWritingRepository } from '../storage/writingRepository'

const route = useRoute()
const router = useRouter()
const defaults: WritingViewDependencies = {
  repository: createBrowserWritingRepository(), client: createWritingAssessmentClient(), desktop: isDesktopRuntime(),
  now: () => new Date(), createId: () => crypto.randomUUID(), navigate: (path) => router.push(path),
}
const dependencies = inject(WRITING_VIEW_KEY, defaults)
const report = dependencies.repository.getReport(String(route.params.reportId))
const task = writingTasks.find(({ id }) => id === report?.taskId)
const generated = computed(() => report ? new Date(report.generatedAt).toLocaleString('zh-CN') : '')

function criterionLabel(id: string): string {
  return WRITING_CRITERIA.find((item) => item.id === id)?.label ?? id
}
</script>

<template>
  <main v-if="report" class="writing-report page-shell">
    <header class="writing-report-hero">
      <div><p class="section-kicker">Validated feedback ledger</p><h1>写作辅助评估报告</h1><p>{{ task?.title }}</p></div>
      <div class="writing-overall"><span>辅助 Band{{ ' ' }}</span><strong>{{ report.overallBand.toFixed(1) }}</strong><small>由四项合法分数平均并归一到 0.5</small></div>
    </header>

    <section class="writing-report-summary"><div><p class="section-kicker">Executive note</p><h2>总体诊断</h2></div><p>{{ report.summary }}</p></section>
    <WritingRubric :criteria="report.criteria" />

    <section class="writing-action-grid">
      <article><p class="section-kicker">Keep</p><h2>已经做好的部分</h2><ol><li v-for="item in report.strengths" :key="item">{{ item }}</li></ol></article>
      <article><p class="section-kicker">Next pass</p><h2>优先修改顺序</h2><ol><li v-for="item in report.priorities" :key="item">{{ item }}</li></ol></article>
    </section>

    <section class="writing-evidence">
      <header class="index-heading"><div><p class="section-kicker">Source-backed evidence</p><h2>可回溯证据与改写建议</h2></div><span>{{ report.evidence.length }} 条已验证引用</span></header>
      <article v-for="(item, index) in report.evidence" :id="`evidence-${index + 1}`" :key="`${item.quote}-${index}`">
        <span>{{ String(index + 1).padStart(2, '0') }}</span><blockquote>“{{ item.quote }}”</blockquote>
        <div><small>{{ criterionLabel(item.criterion) }}</small><p>{{ item.observation }}</p><strong>建议改写</strong><p>{{ item.revision }}</p></div>
      </article>
      <p v-if="!report.evidence.length" class="empty-note">模型没有返回可在原文中验证的精确引用，因此本报告未展示证据句。</p>
    </section>

    <section class="writing-submission-copy"><header><p class="section-kicker">Submitted manuscript</p><h2>本次作文原文</h2></header><pre>{{ report.essay }}</pre></section>

    <footer class="writing-report-meta">
      <dl><div><dt>生成时间</dt><dd>{{ generated }}</dd></div><div><dt>字数</dt><dd>{{ report.wordCount }}</dd></div><div><dt>模型</dt><dd>{{ report.model }}</dd></div><div><dt>提示词版本</dt><dd>{{ report.promptVersion }}</dd></div><div><dt>请求编号</dt><dd>{{ report.requestId || '未提供' }}</dd></div></dl>
      <p>本报告由 AI 按公开写作维度生成，仅用于学习反馈。它可能存在遗漏或判断偏差，不能替代官方 IELTS 成绩、认证考官评分或教师复核。</p>
      <RouterLink class="signal-action" to="/writing">返回写作工作室</RouterLink>
    </footer>
  </main>
  <main v-else class="writing-report-missing page-shell"><p class="section-kicker">Report unavailable</p><h1>没有找到这份写作报告</h1><p>报告可能已被清理，或仅存在于另一台设备。</p><RouterLink class="signal-action" to="/writing">返回写作工作室</RouterLink></main>
</template>
