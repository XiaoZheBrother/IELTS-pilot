<script setup lang="ts">
import type { PackagePreview } from '../domain/packageLifecycle'

defineProps<{ preview: PackagePreview }>()
</script>

<template>
  <section class="package-preview" aria-labelledby="package-preview-title">
    <header><div><p class="section-kicker">Installation preview</p><h2 id="package-preview-title">安装预览</h2></div><span :class="`package-action package-action--${preview.action}`">{{ preview.action === 'install' ? '新安装' : preview.action === 'upgrade' ? '可升级' : '存在冲突' }}</span></header>
    <div class="package-preview__identity"><strong>{{ preview.name }}</strong><span>v{{ preview.version }}</span><p>{{ preview.owner }} · {{ preview.license }}</p></div>
    <dl><div><dt>练习</dt><dd>{{ preview.setCount }} 套</dd></div><div><dt>题目</dt><dd>{{ preview.questionCount }} 题</dd></div><div><dt>主题</dt><dd>{{ preview.topics.join(' · ') || '未标注' }}</dd></div></dl>
    <p class="package-digest">SHA-256 · {{ preview.digest.slice(7, 23) }}…</p>
    <p v-if="preview.conflicts.length" class="package-conflicts">冲突的练习 ID：{{ preview.conflicts.join('、') }}</p>
    <p v-if="preview.compatibilityError" class="package-conflicts">{{ preview.compatibilityError }}</p>
  </section>
</template>
