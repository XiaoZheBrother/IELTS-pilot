<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import PackagePreview from '../components/PackagePreview.vue'
import { practiceSets } from '../data/practiceSets'
import { validateContentPackage } from '../domain/contentPackage'
import { installPackageBatch, previewPackageBatch, type PackageBatchCandidate, type PackageBatchEntry } from '../domain/packageBatch'
import type { InstalledContentPackage } from '../domain/models'
import { createBrowserPracticeRepository } from '../storage/practiceRepository'

type InvalidBatchEntry = { fileName: string; status: 'invalid'; error: string }
type ViewBatchEntry = PackageBatchEntry | InvalidBatchEntry
type LoadedFile = { fileName: string; text?: string; error?: string }

const repository = createBrowserPracticeRepository()
const installed = ref<InstalledContentPackage[]>(repository.listInstalledPackages())
const batch = ref<ViewBatchEntry[]>([])
const isInstalling = ref(false)
const feedback = ref('')
const bundledSetIds = practiceSets.map(({ id }) => id)
const packageEntries = computed(() => batch.value.filter((entry): entry is PackageBatchEntry => entry.status !== 'invalid'))
const readyEntries = computed(() => packageEntries.value.filter((entry): entry is Extract<PackageBatchEntry, { status: 'ready' }> => entry.status === 'ready'))
const singlePackageEntry = computed(() => batch.value.length === 1 && batch.value[0]?.status !== 'invalid' ? batch.value[0] as PackageBatchEntry : null)

function invalidEntry(fileName: string, error: string): InvalidBatchEntry {
  return { fileName, status: 'invalid', error }
}

async function loadPackageTexts(files: LoadedFile[]): Promise<void> {
  const parsed: Array<PackageBatchCandidate | InvalidBatchEntry> = files.map(({ fileName, text, error }) => {
    if (error || text === undefined) return invalidEntry(fileName, error ?? '无法读取文件。')
    try {
      const result = validateContentPackage(JSON.parse(text) as unknown)
      return result.ok
        ? { fileName, content: result.value }
        : invalidEntry(fileName, `内容包字段校验失败：${result.errors.join('；')}`)
    } catch {
      return invalidEntry(fileName, '文件不是有效的 JSON 内容包。')
    }
  })
  const candidates = parsed.filter((entry): entry is PackageBatchCandidate => 'content' in entry)
  const previews = await previewPackageBatch(candidates, installed.value, bundledSetIds)
  let previewIndex = 0
  batch.value = parsed.map((entry) => 'status' in entry ? entry : previews[previewIndex++]!)
  const skipped = batch.value.length - readyEntries.value.length
  feedback.value = `已读取 ${batch.value.length} 个文件：${readyEntries.value.length} 个可安装，${skipped} 个需跳过。`
}

async function loadPackageFiles(files: File[]): Promise<void> {
  const loaded = await Promise.all(files.map(async (file): Promise<LoadedFile> => {
    try { return { fileName: file.name, text: await readFileText(file) } }
    catch { return { fileName: file.name, error: '无法读取文件。' } }
  }))
  await loadPackageTexts(loaded)
}

async function choosePackage(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (files.length) await loadPackageFiles(files)
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

async function confirmBatchInstall(): Promise<void> {
  if (!readyEntries.value.length || isInstalling.value) return
  isInstalling.value = true
  const total = batch.value.length
  try {
    const result = await installPackageBatch(packageEntries.value, installed.value, bundledSetIds)
    repository.replaceInstalledPackages(result.packages)
    installed.value = repository.listInstalledPackages()
    const failures = new Map(result.failures.map(({ fileName, error }) => [fileName, error]))
    batch.value = batch.value.flatMap((entry): ViewBatchEntry[] => {
      if (entry.status !== 'ready') return [entry]
      const error = failures.get(entry.fileName)
      return error ? [{ ...entry, status: 'blocked', error }] : []
    })
    feedback.value = `已安装 ${result.installedCount} 个内容包，跳过 ${total - result.installedCount} 个。`
  } finally {
    isInstalling.value = false
  }
}

function uninstall(packageId: string): void {
  repository.removeInstalledPackage(packageId)
  installed.value = repository.listInstalledPackages()
  feedback.value = '内容包已卸载；历史成绩仍然保留。'
}

onMounted(() => {
  const pending = sessionStorage.getItem('ielts-pilot:pending-package')
  if (pending) {
    sessionStorage.removeItem('ielts-pilot:pending-package')
    void loadPackageTexts([{ fileName: '内容源下载包.json', text: pending }])
  }
})
</script>

<template>
  <main class="package-manager-page page-shell">
    <header class="page-intro"><div><p class="section-kicker">Content packages</p><h1>题库包管理</h1></div><p>所有内容先校验、预览再安装。升级和卸载不会改写历史成绩。</p></header>
    <section class="package-tools"><label class="package-file"><span>选择一个或多个 JSON 内容包</span><input type="file" accept="application/json,.json" multiple @change="choosePackage" /><b>批量读取并预览</b></label><RouterLink to="/library/sources">浏览可信内容源 →</RouterLink><RouterLink to="/library/editor">创建本地题库 →</RouterLink></section>
    <p class="import-feedback" aria-live="polite">{{ feedback }}</p>
    <section v-if="singlePackageEntry" class="package-install-stage"><PackagePreview :preview="singlePackageEntry.preview" /><div class="package-install-notice"><strong>安装前确认</strong><p>{{ singlePackageEntry.content.note }}</p><p>来源：{{ singlePackageEntry.content.sourceUrl || '内容包未提供外部链接' }}</p><p v-if="singlePackageEntry.status === 'blocked'" class="package-conflicts">{{ singlePackageEntry.error }}</p><button data-testid="confirm-package-batch-install" class="signal-action" type="button" :disabled="singlePackageEntry.status === 'blocked' || isInstalling" @click="confirmBatchInstall">{{ singlePackageEntry.preview.action === 'upgrade' ? '确认升级' : '确认安装' }}</button></div></section>
    <section v-else-if="batch.length" class="package-batch-stage">
      <header class="package-batch-heading"><div><p class="section-kicker">Batch preview</p><h2>批量安装预览</h2></div><p><strong>{{ batch.length }}</strong> 个文件 · <strong>{{ readyEntries.length }}</strong> 个可安装</p></header>
      <ol class="package-batch-list">
        <li v-for="(entry, index) in batch" :key="`${entry.fileName}-${index}`" class="package-batch-item">
          <div class="package-batch-identity"><span>{{ entry.fileName }}</span><strong>{{ entry.status === 'invalid' ? '无法识别的内容包' : entry.preview.name }}</strong><p v-if="entry.status !== 'invalid'">v{{ entry.preview.version }} · {{ entry.preview.setCount }} 套练习 · {{ entry.preview.questionCount }} 题</p></div>
          <div v-if="entry.status !== 'invalid'" class="package-batch-rights"><span>{{ entry.preview.owner }}</span><p>{{ entry.preview.license }}</p><p>{{ entry.content.sourceUrl || '未提供来源链接' }}</p></div>
          <div class="package-batch-result"><b :class="`package-batch-status package-batch-status--${entry.status}`">{{ entry.status === 'ready' ? (entry.preview.action === 'upgrade' ? '可升级' : '可安装') : entry.status === 'blocked' ? '已阻止' : '格式错误' }}</b><p v-if="entry.status !== 'ready'">{{ entry.error }}</p></div>
        </li>
      </ol>
      <footer class="package-batch-actions"><p>只会安装通过字段、版本、完整性与 ID 冲突检查的内容包。</p><button data-testid="confirm-package-batch-install" class="signal-action" type="button" :disabled="!readyEntries.length || isInstalling" @click="confirmBatchInstall">{{ isInstalling ? '正在安装…' : `安装全部可用内容包（${readyEntries.length}）` }}</button></footer>
    </section>
    <section class="installed-packages"><header class="index-heading"><div><p class="section-kicker">Installed locally</p><h2>已安装内容包</h2></div><span>{{ installed.length }} 个</span></header>
      <article v-for="item in installed" :key="item.packageId" class="installed-package"><div><span>{{ item.packageId }}</span><h3>{{ item.name }}</h3><p>{{ item.owner }} · {{ item.license }}</p></div><dl><div><dt>版本</dt><dd>{{ item.version }}</dd></div><div><dt>练习</dt><dd>{{ item.sets.length }}</dd></div><div><dt>安装日期</dt><dd>{{ new Date(item.installedAt).toLocaleDateString('zh-CN') }}</dd></div></dl><button data-testid="uninstall-package" type="button" @click="uninstall(item.packageId)">卸载</button></article>
      <p v-if="!installed.length" class="empty-note">尚未安装外部题库。内置原创练习不会显示在这里。</p>
    </section>
  </main>
</template>
