<script setup lang="ts">
import { APP_NAME, APP_VERSION, platformLabel, runtimeLabel } from '../platform/runtime'
</script>

<template>
  <main class="about-page page-shell">
    <header class="page-intro about-intro">
      <div><p class="section-kicker">About the project</p><h1>{{ APP_NAME }}</h1></div>
      <p>一个本地优先的 IELTS 阅读与写作训练工作台。练习、批注、错题、内容包与写作报告都由你掌控。</p>
    </header>
    <section class="about-ledger">
      <div><span>版本</span><strong>{{ APP_VERSION }}</strong></div>
      <div><span>运行环境</span><strong>{{ runtimeLabel() }}</strong></div>
      <div><span>系统</span><strong>{{ platformLabel() }}</strong></div>
      <div><span>数据策略</span><strong>本地优先 · 可选密文同步</strong></div>
    </section>
    <section class="about-copy">
      <article><p class="section-kicker">Content statement</p><h2>内容与评分说明</h2><p>内置阅读与写作材料均为本项目原创，不是官方 IELTS 真题。阅读 Band 依据公开区间近似估算；写作报告由 AI 按四项公开维度辅助生成，均不代表官方成绩。</p></article>
      <article><p class="section-kicker">Reference attribution</p><h2>参考与致谢</h2><p>产品方向与早期功能调研参考了开源项目 <a href="https://github.com/sallowayma-git/IELTS-practice" target="_blank" rel="noreferrer">sallowayma-git/IELTS-practice</a>。我们未复制其题目内容、受保护素材或界面实现；本项目采用独立的数据模型、交互设计与原创题库。</p></article>
    </section>
  </main>
</template>
