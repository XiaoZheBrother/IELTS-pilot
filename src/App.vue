<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useReaderPreferences } from './composables/useReaderPreferences'
import { createBrowserPracticeRepository } from './storage/practiceRepository'
import LearningAssistant from './components/LearningAssistant.vue'

const route = useRoute()
const focusMode = computed(() => route.name === 'mock' || route.name === 'practice')
useReaderPreferences(createBrowserPracticeRepository())
</script>

<template>
  <div class="app-shell">
    <a class="skip-link" href="#app-content">跳到主要内容</a>
    <header v-if="!focusMode" class="site-header">
      <RouterLink class="brand" data-testid="brand" to="/" aria-label="IELTS Pilot 首页"><strong>IELTS PILOT</strong><small>Reading Studio</small></RouterLink>
      <nav aria-label="主要导航"><RouterLink to="/">工作台</RouterLink><RouterLink to="/library">题库</RouterLink><RouterLink to="/writing">写作</RouterLink><RouterLink to="/errors">错题本</RouterLink><RouterLink to="/favorites">收藏</RouterLink><RouterLink to="/analytics">统计</RouterLink></nav>
      <div class="header-tools" data-testid="utility-nav"><span class="local-status"><i aria-hidden="true" /> 本地优先</span><RouterLink to="/library/sources">内容源</RouterLink><RouterLink to="/sync">同步</RouterLink><RouterLink to="/updates">更新</RouterLink><RouterLink to="/settings">设置</RouterLink><RouterLink to="/about">关于</RouterLink></div>
    </header>
    <div id="app-content"><RouterView /></div>
    <LearningAssistant />
  </div>
</template>
