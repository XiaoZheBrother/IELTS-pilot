<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { ReaderPreferences, ReaderTheme } from '../domain/models'
import { applyReaderPreferences } from '../composables/useReaderPreferences'
import { createBrowserPracticeRepository } from '../storage/practiceRepository'

const repository = createBrowserPracticeRepository()
const form = reactive<ReaderPreferences>({ ...repository.getPreferences() })
const feedback = ref('')

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

      <footer class="settings-actions"><p aria-live="polite">{{ feedback }}</p><button type="button" @click="reset">恢复默认</button><button data-testid="save-preferences" class="signal-action" type="button" @click="save">保存设置</button></footer>
    </form>
  </main>
</template>
