<script setup lang="ts">
import { inject, onMounted, reactive, ref } from 'vue'
import type { ReaderPreferences, ReaderTheme } from '../domain/models'
import { applyReaderPreferences } from '../composables/useReaderPreferences'
import { installDemoProfile } from '../domain/demoProfile'
import { createBrowserPracticeRepository } from '../storage/practiceRepository'
import { createBrowserWritingRepository } from '../storage/writingRepository'
import { AI_SETTINGS_VIEW_KEY, DEFAULT_AI_SETTINGS_VIEW_DEPENDENCIES } from './aiSettingsViewDependencies'

const repository = createBrowserPracticeRepository()
const form = reactive<ReaderPreferences>({ ...repository.getPreferences() })
const feedback = ref('')
const demoConfirmationOpen = ref(false)
const aiDependencies = inject(AI_SETTINGS_VIEW_KEY, DEFAULT_AI_SETTINGS_VIEW_DEPENDENCIES)
const aiForm = reactive({ ...aiDependencies.repository.get(), apiKey: '' })
const aiBusy = ref(false)
const aiFeedback = ref('正在检查 AI 服务…')
const aiHasKey = ref(false)
const aiAvailable = ref(false)

const themes: Array<{ id: ReaderTheme; name: string; description: string }> = [
  { id: 'paper', name: '纸张', description: '明亮中性，适合日间专注。' },
  { id: 'sepia', name: '护眼', description: '暖色低对比，适合长时阅读。' },
  { id: 'night', name: '夜间', description: '深色界面，降低暗处眩光。' },
]

function preview(): void {
  applyReaderPreferences(form)
  feedback.value = '预览已更新，保存后会在本机保留。'
}

function save(): void {
  repository.savePreferences(form)
  Object.assign(form, repository.getPreferences())
  applyReaderPreferences(form)
  feedback.value = '设置已保存到当前设备。'
}

function reset(): void {
  Object.assign(form, { theme: 'paper', fontScale: 1, lineHeight: 1.85, readingWidth: 850, defaultTimedPractice: true })
  preview()
}

function confirmDemoProfile(): void {
  const result = installDemoProfile(repository, createBrowserWritingRepository())
  demoConfirmationOpen.value = false
  feedback.value = result.message
}

async function refreshAiStatus(): Promise<void> {
  const availability = await aiDependencies.client.checkAvailability(aiForm)
  aiAvailable.value = availability.available
  aiHasKey.value = availability.available && availability.mode === 'desktop'
  aiFeedback.value = availability.available
    ? availability.mode === 'gateway'
      ? `本地网关已连接${availability.model ? ` · ${availability.model}` : ''}`
      : `密钥已配置${availability.model ? ` · ${availability.model}` : ''}`
    : availability.reason === 'configuration-required'
      ? '尚未配置密钥'
      : 'AI 服务当前不可用'
}

async function testAiConnection(): Promise<void> {
  aiBusy.value = true
  const result = await aiDependencies.client.testConnection(aiForm, aiDependencies.desktop ? aiForm.apiKey : undefined)
  aiFeedback.value = result.ok
    ? `连接成功${result.model ? ` · ${result.model}` : ''}${result.latencyMs !== undefined ? ` · ${result.latencyMs} ms` : ''}`
    : result.error ?? '连接失败'
  aiBusy.value = false
}

async function saveAiSettings(): Promise<void> {
  aiBusy.value = true
  try {
    aiDependencies.repository.save({ endpoint: aiForm.endpoint, model: aiForm.model })
    if (aiDependencies.desktop && aiForm.apiKey.trim()) await aiDependencies.client.saveCredential(aiForm.apiKey)
    aiForm.apiKey = ''
    aiFeedback.value = 'AI 设置已保存到当前设备。'
    await refreshAiStatus()
  } catch (error) {
    aiFeedback.value = error instanceof Error ? error.message : 'AI 设置保存失败。'
  } finally { aiBusy.value = false }
}

async function clearAiCredential(): Promise<void> {
  aiBusy.value = true
  try {
    await aiDependencies.client.clearCredential()
    aiForm.apiKey = ''
    aiHasKey.value = false
    aiAvailable.value = false
    aiFeedback.value = '已清除当前设备上的 AI 密钥。'
  } catch (error) { aiFeedback.value = error instanceof Error ? error.message : '无法清除 AI 密钥。' }
  finally { aiBusy.value = false }
}

onMounted(refreshAiStatus)
</script>

<template>
  <main class="settings-page page-shell">
    <header class="page-intro settings-intro">
      <div><p class="section-kicker">Reading environment</p><h1>阅读设置</h1></div>
      <p>调整文章区域的配色、字号、行距和宽度。所有偏好只保存在当前设备，不会上传。</p>
    </header>

    <form class="settings-layout" @submit.prevent="save">
      <section class="settings-section" aria-labelledby="theme-title">
        <header><p class="section-kicker">01 · Theme</p><h2 id="theme-title">阅读主题</h2></header>
        <div class="theme-options">
          <label v-for="theme in themes" :key="theme.id" class="theme-option" :class="`theme-option--${theme.id}`">
            <input :data-testid="`theme-${theme.id}`" v-model="form.theme" type="radio" name="reader-theme" :value="theme.id" @change="preview" />
            <span class="theme-swatch" aria-hidden="true"><i>Aa</i><b /></span>
            <strong>{{ theme.name }}</strong><small>{{ theme.description }}</small>
          </label>
        </div>
      </section>

      <section class="settings-section" aria-labelledby="typeset-title">
        <header><p class="section-kicker">02 · Typesetting</p><h2 id="typeset-title">文章排版</h2></header>
        <div class="range-settings">
          <label><span><strong>字号</strong><output>{{ Math.round(form.fontScale * 100) }}%</output></span><input data-testid="font-scale" v-model.number="form.fontScale" type="range" min="0.85" max="1.35" step="0.05" @input="preview" /></label>
          <label><span><strong>行距</strong><output>{{ form.lineHeight.toFixed(2) }}</output></span><input v-model.number="form.lineHeight" type="range" min="1.5" max="2.2" step="0.05" @input="preview" /></label>
          <label><span><strong>阅读宽度</strong><output>{{ form.readingWidth }} px</output></span><input v-model.number="form.readingWidth" type="range" min="620" max="980" step="20" @input="preview" /></label>
        </div>
        <article class="reader-sample">
          <p class="section-kicker">Live sample</p><h3>Reading should feel measured.</h3>
          <p>清晰的层级和稳定的行长能减少视线跳动，让注意力留在文章本身。</p>
        </article>
      </section>

      <section class="settings-section settings-section--compact" aria-labelledby="practice-title">
        <header><p class="section-kicker">03 · Practice</p><h2 id="practice-title">练习默认项</h2></header>
        <label class="toggle-setting"><span><strong>默认开启计时</strong><small>新专项练习进入后自动倒计时，练习中仍可暂停。</small></span><input data-testid="default-timed" v-model="form.defaultTimedPractice" type="checkbox" /></label>
      </section>

      <section class="settings-section ai-settings-section" aria-labelledby="ai-title">
        <header><p class="section-kicker">04 · Assistant</p><h2 id="ai-title">AI 助手</h2></header>
        <div class="ai-settings-control">
          <div class="ai-settings-status" :class="{ 'ai-settings-status--ready': aiAvailable }">
            <span aria-hidden="true" />
            <div><strong>{{ aiDependencies.desktop ? (aiHasKey ? '密钥已配置' : '桌面安全配置') : '浏览器网关配置' }}</strong><small>{{ aiFeedback }}</small></div>
          </div>
          <div v-if="aiDependencies.desktop" class="ai-settings-fields">
            <label><span>HTTPS Endpoint</span><input data-testid="ai-endpoint" v-model.trim="aiForm.endpoint" type="url" autocomplete="url" spellcheck="false" :disabled="!aiDependencies.desktop" /></label>
            <label><span>Model</span><input data-testid="ai-model" v-model.trim="aiForm.model" autocomplete="off" spellcheck="false" :disabled="!aiDependencies.desktop" /></label>
            <label><span>API Key</span><input data-testid="ai-api-key" v-model="aiForm.apiKey" type="password" autocomplete="off" :placeholder="aiHasKey ? '留空则保留现有密钥' : '仅保存到 Windows 当前用户凭据'" /></label>
          </div>
          <p v-if="aiDependencies.desktop" class="ai-settings-note">API Key 使用 Windows 当前用户加密保护，不进入浏览器存储、数据备份或对话记录。</p>
          <p v-else class="ai-settings-note">浏览器版由本地生产网关管理密钥；前端不会读取、保存或回显 API Key。</p>
          <div class="ai-settings-actions">
            <button data-testid="test-ai-connection" type="button" :disabled="aiBusy" @click="testAiConnection">测试连接</button>
            <button v-if="aiDependencies.desktop && aiHasKey" type="button" :disabled="aiBusy" @click="clearAiCredential">清除密钥</button>
            <button v-if="aiDependencies.desktop" data-testid="save-ai-settings" class="signal-action" type="button" :disabled="aiBusy" @click="saveAiSettings">保存 AI 设置</button>
          </div>
        </div>
      </section>

      <section class="settings-section settings-section--compact" aria-labelledby="demo-title">
        <header><p class="section-kicker">05 · Walkthrough</p><h2 id="demo-title">产品演示数据</h2></header>
        <div class="demo-profile-control">
          <p>一键生成可重复使用的本地样例：3 次阅读记录、1 份草稿、收藏与批注，以及 1 份写作辅助报告。不会联网，也不会删除你的现有数据。</p>
          <div v-if="demoConfirmationOpen" class="demo-profile-confirm" role="alert">
            <p>将写入 3 次阅读记录和 1 份写作报告；使用固定编号，重复安装只会刷新样例。</p>
            <button type="button" @click="demoConfirmationOpen = false">取消</button>
            <button data-testid="confirm-demo-profile" class="signal-action" type="button" @click="confirmDemoProfile">确认安装</button>
          </div>
          <button v-else data-testid="install-demo-profile" type="button" @click="demoConfirmationOpen = true">准备演示数据</button>
        </div>
      </section>

      <footer class="settings-actions"><p aria-live="polite">{{ feedback }}</p><button type="button" @click="reset">恢复默认</button><button data-testid="save-preferences" class="signal-action" type="button" @click="save">保存设置</button></footer>
    </form>
  </main>
</template>
