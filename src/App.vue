<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const focusMode = computed(() => route.name === 'mock' || route.name === 'practice')
</script>

<template>
  <div class="app-shell">
    <a class="skip-link" href="#app-content">跳到主要内容</a>
    <header v-if="!focusMode" class="site-header">
      <RouterLink class="brand" data-testid="brand" to="/" aria-label="IELTS Pilot 首页"><strong>IELTS PILOT</strong><small>Reading Studio</small></RouterLink>
      <nav aria-label="主要导航"><RouterLink to="/">工作台</RouterLink><RouterLink to="/library">题库</RouterLink><RouterLink to="/analytics">统计</RouterLink></nav>
      <span class="local-status"><i aria-hidden="true" /> 本地数据</span>
    </header>
    <div id="app-content"><RouterView /></div>
  </div>
</template>
