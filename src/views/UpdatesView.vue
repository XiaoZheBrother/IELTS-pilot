<script setup lang="ts">
import { inject, ref } from 'vue'
import {
  APP_UPDATER_KEY, createRuntimeAppUpdater, type AvailableUpdate, type UpdateCheckResult,
} from '../platform/appUpdater'
import { APP_VERSION } from '../platform/runtime'

const updater = inject(APP_UPDATER_KEY, createRuntimeAppUpdater())
const status = ref<UpdateCheckResult>(updater.supported ? { status: 'current' } : { status: 'unsupported' })
const checking = ref(false)
const hasChecked = ref(false)
const installing = ref(false)
const progress = ref(0)
const installError = ref('')

async function checkForUpdates(): Promise<void> {
  checking.value = true
  installError.value = ''
  status.value = await updater.check()
  hasChecked.value = true
  checking.value = false
}

async function installUpdate(update: AvailableUpdate): Promise<void> {
  installing.value = true
  installError.value = ''
  try {
    await updater.install(update, (value) => { progress.value = value.percent })
  } catch (error) {
    installError.value = error instanceof Error ? error.message : '更新安装失败，请稍后重试。'
  } finally {
    installing.value = false
  }
}
</script>

<template>
  <main class="system-page page-shell">
    <header class="page-intro">
      <div><p class="section-kicker">Secure release channel</p><h1>应用更新</h1></div>
      <p>桌面版只会安装通过项目 updater 公钥验证的发布包。检查和安装都由你主动触发。</p>
    </header>

    <section class="security-status" :class="`is-${status.status}`" aria-live="polite">
      <span>当前版本</span><strong>{{ APP_VERSION }}</strong>
      <p v-if="status.status === 'unsupported'">应用内更新仅在 Windows 桌面版可用。浏览器版由网站发布者更新。</p>
      <p v-else-if="status.status === 'current'">{{ checking ? '正在连接签名发布通道…' : hasChecked ? '检查完成，当前已是最新版本。' : '尚未执行本次检查。' }}</p>
      <p v-else-if="status.status === 'error'">{{ status.message }}</p>
      <p v-else>发现已验证的新版本 {{ status.update.version }}</p>
      <button data-testid="check-update" class="signal-action" type="button" :disabled="!updater.supported || checking || installing" @click="checkForUpdates">
        {{ checking ? '检查中…' : '检查更新' }}
      </button>
    </section>

    <ol class="system-steps" aria-label="安全更新步骤">
      <li><span>01</span><div><strong>验证通道</strong><p>从公开的 GitHub Release 元数据读取新版本，并由 Tauri 校验更新签名。</p></div></li>
      <li :class="{ active: status.status === 'available' }"><span>02</span><div><strong>阅读说明</strong><p>在下载前确认版本、发布日期与发布说明。</p></div></li>
      <li :class="{ active: installing }"><span>03</span><div><strong>安装并重启</strong><p>下载完成后安装，Windows 会关闭并重新启动应用。</p></div></li>
    </ol>

    <section v-if="status.status === 'available'" class="release-review">
      <div><p class="section-kicker">Verified release</p><h2>IELTS Pilot {{ status.update.version }}</h2></div>
      <dl>
        <div><dt>发布日期</dt><dd>{{ status.update.date ? new Date(status.update.date).toLocaleString('zh-CN') : '未提供' }}</dd></div>
        <div><dt>验证方式</dt><dd>Tauri updater signature</dd></div>
      </dl>
      <p class="release-notes">{{ status.update.notes }}</p>
      <div v-if="installing || progress" class="download-progress"><span :style="{ width: `${progress}%` }" /><strong>{{ progress }}%</strong></div>
      <p v-if="installError" class="import-feedback">{{ installError }}</p>
      <button data-testid="install-update" class="signal-action" type="button" :disabled="installing" @click="installUpdate(status.update)">
        {{ installing ? '正在下载并安装…' : '确认下载并安装' }}
      </button>
    </section>

    <aside class="trust-boundary"><strong>关于 Windows 签名</strong><p>更新包签名用于阻止被篡改的升级。商业 Authenticode 证书需要由维护者另行配置；未配置时 SmartScreen 仍可能显示“未知发布者”。</p></aside>
  </main>
</template>
