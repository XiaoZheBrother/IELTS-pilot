<script setup lang="ts">
import { computed, inject, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { writingTasks } from '../data/writingTasks'
import {
  WRITING_PROMPT_VERSION, buildWritingMessages, countWritingWords, parseWritingAssessment,
  type WritingTask,
} from '../domain/writingAssessment'
import { createWritingAssessmentClient, type EphemeralAiConfig } from '../platform/writingAssessmentClient'
import { isDesktopRuntime } from '../platform/runtime'
import { createBrowserWritingRepository } from '../storage/writingRepository'
import { WRITING_VIEW_KEY, type WritingViewDependencies } from '../platform/writingViewDependencies'

const injectedDependencies = inject(WRITING_VIEW_KEY, null)
const router = injectedDependencies ? null : useRouter()
const dependencies: WritingViewDependencies = injectedDependencies ?? {
  repository: createBrowserWritingRepository(), client: createWritingAssessmentClient(), desktop: isDesktopRuntime(),
  now: () => new Date(), createId: () => crypto.randomUUID(), navigate: (path) => router!.push(path),
}
const selectedId = ref(writingTasks[0]!.id)
const essay = ref('')
const elapsedSeconds = ref(0)
const feedback = ref('')
const error = ref('')
const busy = ref(false)
const consentOpen = ref(false)
const availability = ref('正在确认评分服务…')
const desktopConfig = reactive<EphemeralAiConfig>({ endpoint: '', apiKey: '', model: '' })

const selected = computed(() => writingTasks.find(({ id }) => id === selectedId.value) ?? writingTasks[0]!)
const wordCount = computed(() => countWritingWords(essay.value))
const wordReady = computed(() => wordCount.value >= selected.value.minimumWords)
const reports = ref(dependencies.repository.listReports())
const elapsedLabel = computed(() => `${String(Math.floor(elapsedSeconds.value / 60)).padStart(2, '0')}:${String(elapsedSeconds.value % 60).padStart(2, '0')}`)
const chartMaximum = computed(() => Math.max(...(selected.value.visualData?.series.flatMap(({ values }) => values) ?? [1])))

function loadTask(task: WritingTask): void {
  selectedId.value = task.id
  const draft = dependencies.repository.getDraft(task.id)
  essay.value = draft?.essay ?? ''
  elapsedSeconds.value = draft?.elapsedSeconds ?? 0
  feedback.value = draft ? '已恢复当前设备上的自动保存草稿。' : ''
  error.value = ''
}

function persistDraft(): void {
  if (!essay.value) { dependencies.repository.removeDraft(selected.value.id); return }
  dependencies.repository.saveDraft({ taskId: selected.value.id, essay: essay.value, elapsedSeconds: elapsedSeconds.value, updatedAt: dependencies.now().toISOString() })
}

function loadDemoEssay(): void {
  essay.value = selected.value.demoEssay
  persistDraft()
  feedback.value = '已载入项目原创演示作文，可直接走查辅助评分。'
}

function clearEssay(): void {
  essay.value = ''
  elapsedSeconds.value = 0
  dependencies.repository.removeDraft(selected.value.id)
  feedback.value = '当前任务草稿已清空。'
}

function requestAssessment(): void {
  if (!wordReady.value) { error.value = `当前 ${wordCount.value} 词，至少需要 ${selected.value.minimumWords} 词后再提交。`; return }
  error.value = ''
  consentOpen.value = true
}

async function confirmAssessment(): Promise<void> {
  consentOpen.value = false
  busy.value = true
  error.value = ''
  feedback.value = '正在准备量表并发送作文，完成后会验证评分结构与证据引用。'
  try {
    const request = {
      taskId: selected.value.id, taskType: selected.value.type, promptVersion: WRITING_PROMPT_VERSION,
      prompt: selected.value.prompt, essay: essay.value, wordCount: wordCount.value,
      messages: buildWritingMessages(selected.value, essay.value),
    }
    const config = dependencies.desktop ? { ...desktopConfig } : undefined
    const response = await dependencies.client.evaluate(request, config)
    const parsed = parseWritingAssessment(response.content, essay.value)
    const report = {
      ...parsed, id: dependencies.createId(), taskId: selected.value.id, taskType: selected.value.type,
      essay: essay.value, wordCount: wordCount.value, model: response.model, promptVersion: WRITING_PROMPT_VERSION,
      generatedAt: dependencies.now().toISOString(), requestId: response.requestId,
    }
    dependencies.repository.saveReport(report)
    dependencies.repository.removeDraft(selected.value.id)
    reports.value = dependencies.repository.listReports()
    await dependencies.navigate(`/writing/report/${report.id}`)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '生成辅助评估失败，请稍后重试。'
    feedback.value = '作文仍保存在当前设备，修复连接后可以直接重试。'
    persistDraft()
  } finally { busy.value = false }
}

watch([essay, elapsedSeconds], persistDraft)
const timer = window.setInterval(() => { if (essay.value && !busy.value) elapsedSeconds.value += 1 }, 1_000)
onBeforeUnmount(() => window.clearInterval(timer))

void dependencies.client.checkAvailability().then((status) => {
  availability.value = status.available
    ? `评分服务已就绪${status.model ? ` · ${status.model}` : ''}`
    : dependencies.desktop ? '桌面模式：密钥仅在本次页面内存中使用' : '评分网关未连接，作文仍可离线编辑'
})
loadTask(selected.value)
</script>

<template>
  <main class="writing-page page-shell">
    <header class="writing-intro">
      <div><p class="section-kicker">Evidence-led writing desk</p><h1>AI 写作工作室</h1></div>
      <div class="writing-intro__note"><strong>{{ availability }}</strong><p>以公开四维量表生成学习反馈；评分结果不能替代官方 IELTS 成绩或人工阅卷。</p></div>
    </header>

    <nav class="writing-task-switcher" aria-label="写作任务选择">
      <button v-for="task in writingTasks" :key="task.id" :data-testid="`writing-${task.type}`" type="button" :class="{ active: task.id === selected.id }" @click="loadTask(task)">
        <span>{{ task.sequence }}</span><small>{{ task.eyebrow }}</small><strong>{{ task.title }}</strong><i>{{ task.recommendedMinutes }} MIN · {{ task.minimumWords }}+ WORDS</i>
      </button>
    </nav>

    <section class="writing-workspace">
      <article class="writing-brief">
        <header><p class="section-kicker">Task brief · {{ selected.type }}</p><h2>{{ selected.title }}</h2></header>
        <p class="writing-prompt">{{ selected.prompt }}</p>
        <p class="writing-instructions">{{ selected.instructions }}</p>

        <figure v-if="selected.visualData" class="writing-chart">
          <figcaption><strong>{{ selected.visualData.title }}</strong><span>单位：{{ selected.visualData.unit }}</span></figcaption>
          <div v-for="series in selected.visualData.series" :key="series.name" class="chart-series">
            <span>{{ series.name }}</span>
            <div v-for="(value, index) in series.values" :key="selected.visualData.categories[index]">
              <i :style="{ height: `${(value / chartMaximum) * 100}%` }" /><b>{{ value }}</b><small>{{ selected.visualData.categories[index] }}</small>
            </div>
          </div>
        </figure>

        <div class="writing-focus"><span v-for="item in selected.focus" :key="item">{{ item }}</span></div>
        <footer><span>来源</span><strong>{{ selected.provenance.author }} 原创练习材料</strong><small>{{ selected.provenance.note }}</small></footer>
      </article>

      <section class="writing-editor-panel">
        <header><div><p class="section-kicker">Draft / local autosave</p><h2>作文稿件</h2></div><dl><div><dt>计时</dt><dd>{{ elapsedLabel }}</dd></div><div><dt>字数</dt><dd data-testid="writing-word-count">{{ wordCount }}</dd></div><div><dt>目标</dt><dd>{{ selected.minimumWords }}+</dd></div></dl></header>
        <textarea data-testid="writing-editor" v-model="essay" :aria-label="`${selected.title} 作文正文`" spellcheck="true" :placeholder="`在此完成 ${selected.type === 'task-1' ? 'Task 1 报告' : 'Task 2 议论文'}…`" />
        <div class="writing-editor-footer">
          <p :class="{ ready: wordReady }"><span>{{ wordReady ? '字数已达到提交线' : `还需 ${Math.max(0, selected.minimumWords - wordCount)} 词` }}</span><i><b :style="{ width: `${Math.min(100, (wordCount / selected.minimumWords) * 100)}%` }" /></i></p>
          <div><button data-testid="load-demo-essay" class="quiet-action" type="button" @click="loadDemoEssay">载入演示作文</button><button class="quiet-action" type="button" @click="clearEssay">清空</button></div>
        </div>

        <details v-if="dependencies.desktop" class="desktop-ai-config">
          <summary>桌面端一次性 AI 连接</summary>
          <p>以下信息只保留在当前页面内存中，不写入草稿、历史或备份。</p>
          <label><span>HTTPS Endpoint</span><input v-model.trim="desktopConfig.endpoint" type="url" autocomplete="off" /></label>
          <label><span>Model</span><input v-model.trim="desktopConfig.model" autocomplete="off" /></label>
          <label><span>API Key</span><input v-model="desktopConfig.apiKey" type="password" autocomplete="off" /></label>
        </details>

        <p v-if="error" class="writing-message writing-message--error" role="alert">{{ error }}</p>
        <p v-else class="writing-message" aria-live="polite">{{ feedback }}</p>
        <button data-testid="request-writing-assessment" class="signal-action writing-submit" type="button" :disabled="busy" @click="requestAssessment">{{ busy ? '验证反馈中…' : '生成 AI 辅助评估' }}<span>→</span></button>
      </section>
    </section>

    <section class="writing-history">
      <header class="index-heading"><div><p class="section-kicker">Local assessment archive</p><h2>写作报告历史</h2></div><span>{{ reports.length }} 份</span></header>
      <div v-if="reports.length" class="writing-history-list"><RouterLink v-for="report in reports" :key="report.id" :to="`/writing/report/${report.id}`"><span>{{ writingTasks.find((task) => task.id === report.taskId)?.title }}</span><time>{{ new Date(report.generatedAt).toLocaleString('zh-CN') }}</time><strong>Band {{ report.overallBand.toFixed(1) }}</strong><i>→</i></RouterLink></div>
      <p v-else class="empty-note">还没有写作报告。载入演示作文即可完成首次走查。</p>
    </section>

    <div v-if="consentOpen" data-testid="writing-consent-dialog" class="writing-consent-backdrop" role="presentation" @click.self="consentOpen = false">
      <section role="dialog" aria-modal="true" aria-labelledby="writing-consent-title">
        <p class="section-kicker">Explicit send boundary</p><h2 id="writing-consent-title">确认发送范围</h2>
        <p>本次仅发送题目与作文正文、任务类型、字数及提示词版本。不会发送阅读记录、收藏、批注、同步口令或其他本地数据。</p>
        <dl><div><dt>任务</dt><dd>{{ selected.type }}</dd></div><div><dt>正文</dt><dd>{{ wordCount }} 词</dd></div><div><dt>版本</dt><dd>{{ WRITING_PROMPT_VERSION }}</dd></div></dl>
        <div><button class="quiet-action" type="button" @click="consentOpen = false">取消</button><button data-testid="confirm-writing-assessment" class="signal-action" type="button" @click="confirmAssessment">确认并发送</button></div>
      </section>
    </div>
  </main>
</template>
