<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="app-shell">
    <header class="site-header">
      <RouterLink class="brand" data-testid="brand" to="/" aria-label="IELTS Pilot 首页">
        <span class="brand__mark" aria-hidden="true">IP</span>
        <span>
          <strong>IELTS Pilot</strong>
          <small>Reading Practice Desk</small>
        </span>
      </RouterLink>
      <span class="site-header__note">本地保存 · 原创练习</span>
    </header>

    <RouterView />
  </div>
</template>
