<script setup lang="ts">
import { inject, onBeforeUnmount, reactive, ref } from 'vue'
import { decryptPracticeVault, encryptPracticeVault, parseEncryptedVault } from '../domain/encryptedVault'
import { mergePracticeBackups, type SyncMergePreview } from '../domain/syncMerge'
import { createVaultTransport } from '../platform/vaultTransport'
import { createBrowserPracticeRepository } from '../storage/practiceRepository'
import { createBrowserSyncSettingsRepository } from '../storage/syncSettingsRepository'
import { SYNC_VIEW_KEY, type SyncViewDependencies } from './syncViewDependencies'

function downloadText(name: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

const defaultDependencies: SyncViewDependencies = {
  repository: createBrowserPracticeRepository(),
  settingsRepository: createBrowserSyncSettingsRepository(),
  encrypt: encryptPracticeVault,
  decrypt: decryptPracticeVault,
  createTransport: createVaultTransport,
  download: downloadText,
  now: () => new Date(),
}
const dependencies = inject(SYNC_VIEW_KEY, defaultDependencies)
const saved = dependencies.settingsRepository.load()
const form = reactive({ profileId: saved.profileId, endpoint: saved.endpoint })
const passphrase = ref('')
const token = ref('')
const busy = ref(false)
const feedback = ref('')
const error = ref('')
const preview = ref<SyncMergePreview | null>(null)
const pendingBackup = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

function requireSecrets(requireEndpoint = false): void {
  if (!/^[A-Za-z0-9._-]{1,128}$/u.test(form.profileId)) throw new Error('档案 ID 格式无效。')
  if (passphrase.value.length < 12) throw new Error('同步口令至少 12 个字符。')
  if (requireEndpoint && !form.endpoint.trim()) throw new Error('请先填写同步服务地址。')
}

function saveSettings(lastSyncedAt = saved.lastSyncedAt): void {
  dependencies.settingsRepository.save({ profileId: form.profileId, endpoint: form.endpoint, ...(lastSyncedAt ? { lastSyncedAt } : {}) })
  feedback.value = '档案设置已保存；口令和访问令牌仍只在当前页面内存中。'
}

async function run(action: () => Promise<void>): Promise<void> {
  busy.value = true
  error.value = ''
  try { await action() } catch (cause) { error.value = cause instanceof Error ? cause.message : '操作失败，请稍后重试。' } finally { busy.value = false }
}

async function exportVault(): Promise<void> {
  await run(async () => {
    requireSecrets()
    const encrypted = await dependencies.encrypt(dependencies.repository.exportBackup(), passphrase.value, { profileId: form.profileId })
    dependencies.download(`ielts-pilot-${form.profileId}.vault.json`, JSON.stringify(encrypted, null, 2))
    feedback.value = '加密保险库已导出。文件只包含密文，请妥善保管同步口令。'
  })
}

async function loadVaultText(value: string): Promise<void> {
  await run(async () => {
    requireSecrets()
    const encrypted = parseEncryptedVault(value)
    const remoteBackup = await dependencies.decrypt(encrypted, passphrase.value)
    const merged = mergePracticeBackups(dependencies.repository.exportBackup(), remoteBackup)
    preview.value = merged.preview
    pendingBackup.value = merged.serialized
    feedback.value = '保险库已解密并完成本地比较，确认前不会修改任何练习数据。'
  })
}

async function selectFile(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) await loadVaultText(await file.text())
  if (fileInput.value) fileInput.value.value = ''
}

function confirmMerge(): void {
  if (!pendingBackup.value) return
  const result = dependencies.repository.importBackup(pendingBackup.value)
  if (!result.ok) { error.value = result.error; return }
  pendingBackup.value = ''
  preview.value = null
  feedback.value = `合并已写入本机：${result.drafts} 份草稿、${result.attempts} 次练习记录。`
}

async function mergeRemote(envelope: Parameters<SyncViewDependencies['decrypt']>[0]): Promise<string> {
  const decrypted = await dependencies.decrypt(envelope, passphrase.value)
  return mergePracticeBackups(dependencies.repository.exportBackup(), decrypted).serialized
}

async function encryptedFrom(backup: string) {
  return dependencies.encrypt(backup, passphrase.value, { profileId: form.profileId })
}

async function remoteSync(): Promise<void> {
  await run(async () => {
    requireSecrets(true)
    const transport = dependencies.createTransport({ endpoint: form.endpoint, profileId: form.profileId, token: token.value })
    let remote = await transport.pull()
    if (remote.kind === 'missing') {
      await transport.push(await encryptedFrom(dependencies.repository.exportBackup()))
      const at = dependencies.now().toISOString()
      saveSettings(at)
      feedback.value = `首次加密上传完成 · ${new Date(at).toLocaleString('zh-CN')}`
      return
    }

    let mergedBackup = await mergeRemote(remote.envelope)
    let retried = false
    try {
      await transport.push(await encryptedFrom(mergedBackup), remote.etag)
    } catch (cause) {
      if (!(typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 'conflict')) throw cause
      retried = true
      remote = await transport.pull()
      if (remote.kind === 'missing') throw new Error('冲突处理期间远程保险库被删除，请重试。')
      mergedBackup = mergePracticeBackups(mergedBackup, await dependencies.decrypt(remote.envelope, passphrase.value)).serialized
      await transport.push(await encryptedFrom(mergedBackup), remote.etag)
    }
    const imported = dependencies.repository.importBackup(mergedBackup)
    if (!imported.ok) throw new Error(imported.error)
    const at = dependencies.now().toISOString()
    saveSettings(at)
    feedback.value = retried ? '远程冲突已自动合并并重试，同步完成。' : '加密同步完成，本机与远程保险库已合并。'
  })
}

onBeforeUnmount(() => {
  passphrase.value = ''
  token.value = ''
})

defineExpose({ loadVaultText })
</script>

<template>
  <main class="system-page sync-page page-shell">
    <header class="page-intro">
      <div><p class="section-kicker">Zero-knowledge vault</p><h1>加密同步中心</h1></div>
      <p>练习记录先在本机加密，服务端只接触密文。无需账户，也可以只使用文件手动迁移。</p>
    </header>

    <ol class="sync-sequence" aria-label="加密同步步骤">
      <li class="active"><span>01</span><strong>定义档案</strong><small>保存非敏感连接信息</small></li>
      <li><span>02</span><strong>临时解锁</strong><small>口令从不写入存储</small></li>
      <li :class="{ active: preview }"><span>03</span><strong>比较差异</strong><small>冲突按实体时钟合并</small></li>
      <li :class="{ active: busy }"><span>04</span><strong>确认提交</strong><small>写入前保留人工边界</small></li>
    </ol>

    <section class="sync-console">
      <header><div><p class="section-kicker">Profile / Endpoint</p><h2>连接档案</h2></div><p>这里只保存档案 ID、服务地址和最近同步时间。</p></header>
      <div class="sync-fields">
        <label><span>档案 ID</span><input data-testid="profile-id" v-model.trim="form.profileId" autocomplete="off" spellcheck="false" /></label>
        <label><span>同步服务地址</span><input data-testid="endpoint" v-model.trim="form.endpoint" type="url" placeholder="https://sync.example.com" autocomplete="url" spellcheck="false" /></label>
        <label><span>同步口令</span><input data-testid="passphrase" v-model="passphrase" type="password" minlength="12" autocomplete="new-password" placeholder="至少 12 个字符" /></label>
        <label><span>访问令牌（可选）</span><input data-testid="access-token" v-model="token" type="password" autocomplete="off" placeholder="仅在当前页面内存中" /></label>
      </div>
      <button data-testid="save-sync-settings" class="quiet-action" type="button" @click="saveSettings()">保存非敏感设置</button>
    </section>

    <div class="sync-lanes">
      <section class="sync-lane">
        <p class="section-kicker">Offline handoff</p><h2>文件保险库</h2>
        <p>适合 U 盘、私有云盘或设备间手动搬运。导入时先解密比较，再由你确认写入。</p>
        <input ref="fileInput" data-testid="vault-file" class="visually-hidden" type="file" accept=".json,.vault" @change="selectFile" />
        <div><button data-testid="export-vault" class="signal-action" type="button" :disabled="busy" @click="exportVault">导出加密文件</button><button class="quiet-action" type="button" :disabled="busy" @click="fileInput?.click()">选择保险库文件</button></div>
      </section>
      <section class="sync-lane sync-lane--remote">
        <p class="section-kicker">ETag protected REST</p><h2>远程保险库</h2>
        <p>使用 HTTPS 或本机服务。每次提交都携带 ETag；并发变化会重新拉取、合并并只重试一次。</p>
        <button data-testid="run-remote-sync" class="signal-action" type="button" :disabled="busy" @click="remoteSync">{{ busy ? '正在处理…' : '拉取、合并并同步' }}</button>
      </section>
    </div>

    <section v-if="preview" class="merge-preview" aria-live="polite">
      <div><p class="section-kicker">Review before write</p><h2>合并预览</h2><p>比较完成但尚未写入。冲突由严格时间戳处理，同一时刻使用确定性内容排序。</p></div>
      <dl><div><dt>新增</dt><dd>{{ preview.added }}</dd></div><div><dt>冲突</dt><dd>{{ preview.conflicts }} 个冲突</dd></div><div><dt>删除</dt><dd>{{ preview.deleted }}</dd></div><div><dt>未变化</dt><dd>{{ preview.unchanged }}</dd></div></dl>
      <button data-testid="confirm-vault-merge" class="signal-action" type="button" @click="confirmMerge">确认写入本机</button>
    </section>

    <footer class="sync-audit" aria-live="polite"><strong>本次会话</strong><p v-if="error" class="sync-error">{{ error }}</p><p v-else>{{ feedback || '尚未执行操作。同步口令和令牌将在离开页面时清空。' }}</p></footer>
  </main>
</template>
