<script setup lang="ts">
import { inject, ref } from 'vue'
import { RouterLink } from 'vue-router'
import PublisherFingerprint from '../components/PublisherFingerprint.vue'
import PackagePreview from '../components/PackagePreview.vue'
import { practiceSets } from '../data/practiceSets'
import { createPackagePreview, installPackage, type PackageInstallProvenance, type PackagePreview as PackagePreviewModel } from '../domain/packageLifecycle'
import type { NormalizedContentPackage } from '../domain/contentPackage'
import { createContentSourceClient } from '../platform/contentSourceClient'
import { createBrowserContentSourceRepository, type StoredContentSource } from '../storage/contentSourceRepository'
import { createBrowserPracticeRepository } from '../storage/practiceRepository'
import { CONTENT_SOURCES_KEY, type ContentSourcesDependencies } from './contentSourcesDependencies'

const defaultDependencies: ContentSourcesDependencies = {
  sourceRepository: createBrowserContentSourceRepository(),
  practiceRepository: createBrowserPracticeRepository(),
  client: createContentSourceClient(),
}
const dependencies = inject(CONTENT_SOURCES_KEY, defaultDependencies)
const sources = ref(dependencies.sourceRepository.listSources())
const catalogUrl = ref('')
const busyUrl = ref('')
const feedback = ref('')
const error = ref('')
const pending = ref<{
  package: NormalizedContentPackage
  preview: PackagePreviewModel
  provenance: PackageInstallProvenance
  sourceUrl: string
} | null>(null)

const labels: Record<StoredContentSource['status'], string> = {
  pending: '等待信任', trusted: '签名可信', 'key-changed': '密钥已变化', revoked: '发布者已撤销',
}

function reload(): void {
  sources.value = dependencies.sourceRepository.listSources()
}

async function run(url: string, action: () => Promise<void>): Promise<void> {
  busyUrl.value = url
  error.value = ''
  try { await action() } catch (cause) { error.value = cause instanceof Error ? cause.message : '内容源操作失败。' } finally { busyUrl.value = '' }
}

async function refresh(source: StoredContentSource): Promise<void> {
  await run(source.url, async () => {
    const verified = await dependencies.client.fetchCatalog(source.url)
    const stored = dependencies.sourceRepository.recordVerifiedCatalog(source.url, verified)
    reload()
    feedback.value = stored.status === 'key-changed'
      ? '目录签名有效，但发布者密钥与已信任指纹不同；下载已阻止。'
      : '目录签名验证通过。请在下载前核对并信任发布者指纹。'
  })
}

async function addSource(): Promise<void> {
  const source = dependencies.sourceRepository.addSource(catalogUrl.value)
  catalogUrl.value = ''
  reload()
  await refresh(source)
}

function trust(source: StoredContentSource): void {
  if (!source.catalog || !source.fingerprint) return
  const publisher = source.catalog.publisher
  dependencies.sourceRepository.trustPublisher(publisher.publisherId, publisher.name, source.fingerprint, publisher.publicKey)
  reload()
  feedback.value = `已在当前设备信任 ${publisher.name} 的精确密钥指纹。`
}

function revoke(source: StoredContentSource): void {
  const publisherId = source.catalog?.publisher.publisherId
  if (!publisherId) return
  dependencies.sourceRepository.revokePublisher(publisherId)
  pending.value = null
  reload()
  feedback.value = '发布者信任已在当前设备撤销，相关内容源停止下载。'
}

function toggleSource(source: StoredContentSource): void {
  dependencies.sourceRepository.setSourceEnabled(source.url, !source.enabled)
  reload()
}

function removeSource(source: StoredContentSource): void {
  dependencies.sourceRepository.removeSource(source.url)
  if (pending.value?.sourceUrl === source.url) pending.value = null
  reload()
}

function installedVersion(packageId: string): string | null {
  return dependencies.practiceRepository.getInstalledPackage(packageId)?.version ?? null
}

async function downloadPackage(source: StoredContentSource, packageId: string): Promise<void> {
  await run(source.url, async () => {
    const verified = await dependencies.client.fetchCatalog(source.url)
    const updated = dependencies.sourceRepository.recordVerifiedCatalog(source.url, verified)
    reload()
    if (updated.status !== 'trusted' || !updated.trustedFingerprint) throw new Error('发布者信任状态已变化，下载已阻止。')
    const result = await dependencies.client.fetchPackage(verified, packageId, updated.trustedFingerprint)
    const preview = await createPackagePreview(result.package, dependencies.practiceRepository.listInstalledPackages(), practiceSets.map(({ id }) => id), '0.8.0')
    pending.value = { package: result.package, preview, provenance: result.provenance, sourceUrl: source.url }
    feedback.value = '内容包原始字节、目录摘要与字段均已校验。请复核安装预览。'
  })
}

async function confirmInstall(): Promise<void> {
  if (!pending.value) return
  const result = await installPackage(
    pending.value.package,
    dependencies.practiceRepository.listInstalledPackages(),
    practiceSets.map(({ id }) => id),
    () => new Date(),
    pending.value.provenance,
  )
  if (!result.ok) { error.value = result.error; return }
  dependencies.practiceRepository.replaceInstalledPackages(result.packages)
  feedback.value = `已安装 ${pending.value.package.name} v${pending.value.package.version}，发布者与目录来源已写入安装记录。`
  pending.value = null
}
</script>

<template>
  <main class="system-page content-sources-page page-shell">
    <header class="page-intro">
      <div><p class="section-kicker">Signed distribution ledger</p><h1>可信内容源</h1></div>
      <p>目录签名证明“谁发布”，SHA-256 证明“下载是否一致”。任何来源都必须由你在当前设备明确信任。</p>
    </header>

    <section class="source-onboarding">
      <label><span>签名目录 URL</span><input data-testid="catalog-url" v-model.trim="catalogUrl" type="url" placeholder="https://publisher.example/catalog.json" spellcheck="false" /></label>
      <button data-testid="add-content-source" class="signal-action" type="button" :disabled="!catalogUrl || Boolean(busyUrl)" @click="addSource">添加并验证签名</button>
      <p>只允许 HTTPS；本机开发可使用回环 HTTP。添加不会自动安装任何题库。</p>
    </section>

    <p v-if="error" class="import-feedback source-error" aria-live="assertive">{{ error }}</p>
    <p v-else class="import-feedback" aria-live="polite">{{ feedback }}</p>

    <section class="source-index">
      <header class="index-heading"><div><p class="section-kicker">Device trust store</p><h2>已订阅目录</h2></div><span>{{ sources.length }} 个</span></header>
      <article v-for="source in sources" :key="source.url" class="source-ledger" :class="`source-ledger--${source.status}`">
        <header>
          <div><span class="source-state">{{ labels[source.status] }}</span><h2>{{ source.catalog?.name || '尚未读取目录' }}</h2><p>{{ source.url }}</p></div>
          <div class="source-actions"><button data-testid="refresh-content-source" type="button" :disabled="!source.enabled || busyUrl === source.url" @click="refresh(source)">{{ busyUrl === source.url ? '验证中…' : '刷新验证' }}</button><button data-testid="toggle-content-source" type="button" @click="toggleSource(source)">{{ source.enabled ? '停用' : '启用' }}</button><button data-testid="remove-content-source" type="button" @click="removeSource(source)">移除</button></div>
        </header>

        <section v-if="source.catalog && source.fingerprint" class="publisher-ledger">
          <div><p class="section-kicker">Publisher identity</p><h3>{{ source.catalog.publisher.name }}</h3><span>{{ source.catalog.publisher.publisherId }}</span></div>
          <div><span>ECDSA P-256 公钥指纹</span><PublisherFingerprint :value="source.fingerprint" /></div>
          <div class="publisher-actions">
            <button v-if="source.status !== 'trusted'" data-testid="trust-publisher" class="signal-action" type="button" @click="trust(source)">{{ source.status === 'key-changed' ? '确认信任新密钥' : '信任此发布者' }}</button>
            <button v-if="source.trustedFingerprint" data-testid="revoke-publisher" class="danger-action" type="button" @click="revoke(source)">撤销信任</button>
          </div>
        </section>

        <div v-if="source.status === 'key-changed'" class="key-change-alert"><strong>密钥已变化</strong><p>目录本身签名有效，但与本机固定的旧指纹不一致。请通过独立渠道向发布者核对新指纹。</p><PublisherFingerprint v-if="source.trustedFingerprint" :value="source.trustedFingerprint" /></div>

        <section v-if="source.catalog" class="catalog-packages">
          <header><span>包 ID / 名称</span><span>许可</span><span>版本</span><span>状态 / 操作</span></header>
          <article v-for="item in source.catalog.packages" :key="item.packageId">
            <div><small>{{ item.packageId }}</small><h3>{{ item.name }}</h3><p>{{ item.description }}</p></div><span>{{ item.license }}</span><strong>{{ item.version }}</strong>
            <div><small v-if="installedVersion(item.packageId)">本机 {{ installedVersion(item.packageId) }}</small><button v-if="source.status === 'trusted' && source.enabled" data-testid="download-verified-package" type="button" :disabled="Boolean(busyUrl)" @click="downloadPackage(source, item.packageId)">下载并校验</button><span v-else>下载已锁定</span></div>
          </article>
        </section>
      </article>
      <p v-if="!sources.length" class="empty-note">尚未添加内容源。你仍可继续使用内置原创题库和本地 JSON 包。</p>
    </section>

    <section v-if="pending" class="package-install-stage source-install-preview">
      <PackagePreview :preview="pending.preview" />
      <div class="package-install-notice"><p class="section-kicker">Verified handoff</p><strong>安装预览</strong><p>发布者：{{ pending.provenance.publisherId }}</p><p>目录：{{ pending.provenance.catalogId }}</p><p>签名状态：已验证</p><button data-testid="confirm-source-package-install" class="signal-action" type="button" :disabled="pending.preview.action === 'blocked'" @click="confirmInstall">确认安装</button></div>
    </section>

    <aside class="trust-boundary"><strong>信任不随备份同步</strong><p>发布者信任存放在独立的设备本地信任库中，不进入练习备份和加密同步。更换设备后需要重新核对指纹。</p><RouterLink to="/library/packages">管理本地题库包 →</RouterLink></aside>
  </main>
</template>
