<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import PackagePreview from '../components/PackagePreview.vue'
import { practiceSets } from '../data/practiceSets'
import { validateContentPackage, type NormalizedContentPackage } from '../domain/contentPackage'
import { createPackagePreview, installPackage, type PackagePreview as PackagePreviewModel } from '../domain/packageLifecycle'
import type { InstalledContentPackage } from '../domain/models'
import { createBrowserPracticeRepository } from '../storage/practiceRepository'

const repository = createBrowserPracticeRepository()
const installed = ref<InstalledContentPackage[]>(repository.listInstalledPackages())
const incoming = ref<NormalizedContentPackage | null>(null)
const preview = ref<PackagePreviewModel | null>(null)
const feedback = ref('')

async function loadPackageText(text: string): Promise<void> {
  try {
    const result = validateContentPackage(JSON.parse(text) as unknown)
    if (!result.ok) { feedback.value = `无法预览：${result.errors.join('；')}`; incoming.value = null; preview.value = null; return }
    incoming.value = result.value
    preview.value = await createPackagePreview(result.value, installed.value, practiceSets.map(({ id }) => id))
    feedback.value = preview.value.compatibilityError ?? (preview.value.action === 'blocked' ? '内容包存在版本或练习 ID 冲突，安装已阻止。' : '校验完成，请确认来源和授权后再安装。')
  } catch { feedback.value = '文件不是有效的 JSON 内容包。'; incoming.value = null; preview.value = null }
}

async function choosePackage(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) await loadPackageText(await readFileText(file))
  input.value = ''
}

function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

async function confirmInstall(): Promise<void> {
  if (!incoming.value) return
  const result = await installPackage(incoming.value, installed.value, practiceSets.map(({ id }) => id))
  if (!result.ok) { feedback.value = result.error; return }
  repository.replaceInstalledPackages(result.packages)
  installed.value = repository.listInstalledPackages()
  feedback.value = `已安装 ${incoming.value.name} v${incoming.value.version}。`
  incoming.value = null; preview.value = null
}

function uninstall(packageId: string): void {
  repository.removeInstalledPackage(packageId)
  installed.value = repository.listInstalledPackages()
  feedback.value = '内容包已卸载；历史成绩仍然保留。'
}

onMounted(() => {
  const pending = sessionStorage.getItem('ielts-pilot:pending-package')
  if (pending) { sessionStorage.removeItem('ielts-pilot:pending-package'); void loadPackageText(pending) }
})
</script>

<template>
  <main class="package-manager-page page-shell">
    <header class="page-intro"><div><p class="section-kicker">Content packages</p><h1>题库包管理</h1></div><p>所有内容先校验、预览再安装。升级和卸载不会改写历史成绩。</p></header>
    <section class="package-tools"><label class="package-file"><span>选择 JSON 内容包</span><input type="file" accept="application/json,.json" @change="choosePackage" /><b>读取并预览</b></label><RouterLink to="/library/editor">创建本地题库 →</RouterLink></section>
    <p class="import-feedback" aria-live="polite">{{ feedback }}</p>
    <section v-if="preview && incoming" class="package-install-stage"><PackagePreview :preview="preview" /><div class="package-install-notice"><strong>安装前确认</strong><p>{{ incoming.note }}</p><p>来源：{{ incoming.sourceUrl || '内容包未提供外部链接' }}</p><button data-testid="confirm-package-install" class="signal-action" type="button" :disabled="preview.action === 'blocked'" @click="confirmInstall">{{ preview.action === 'upgrade' ? '确认升级' : '确认安装' }}</button></div></section>
    <section class="installed-packages"><header class="index-heading"><div><p class="section-kicker">Installed locally</p><h2>已安装内容包</h2></div><span>{{ installed.length }} 个</span></header>
      <article v-for="item in installed" :key="item.packageId" class="installed-package"><div><span>{{ item.packageId }}</span><h3>{{ item.name }}</h3><p>{{ item.owner }} · {{ item.license }}</p></div><dl><div><dt>版本</dt><dd>{{ item.version }}</dd></div><div><dt>练习</dt><dd>{{ item.sets.length }}</dd></div><div><dt>安装日期</dt><dd>{{ new Date(item.installedAt).toLocaleDateString('zh-CN') }}</dd></div></dl><button data-testid="uninstall-package" type="button" @click="uninstall(item.packageId)">卸载</button></article>
      <p v-if="!installed.length" class="empty-note">尚未安装外部题库。内置原创练习不会显示在这里。</p>
    </section>
  </main>
</template>
