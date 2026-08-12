<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { practiceSets } from '../data/practiceSets'
import { createRetryPracticeSet, deriveErrorBook, filterErrorBook } from '../domain/errorBook'
import { questionTypeLabels } from '../domain/questionLabels'
import type { QuestionType } from '../domain/models'
import { createBrowserPracticeRepository } from '../storage/practiceRepository'

const repository = createBrowserPracticeRepository()
const route = useRoute()
const allSets = [...practiceSets, ...repository.listImportedSets()]
const entries = ref(deriveErrorBook(repository.listAttempts(), allSets, repository.listMasteredErrorKeys()))
const questionTypes = new Set<QuestionType>(Object.keys(questionTypeLabels) as QuestionType[])
const initialType = typeof route.query.type === 'string' && questionTypes.has(route.query.type as QuestionType)
  ? route.query.type as QuestionType : 'all'
const initialState = route.query.state === 'mastered' || route.query.state === 'all' ? route.query.state : 'learning'
const type = ref<QuestionType | 'all'>(initialType)
const setId = ref('all')
const state = ref<'learning' | 'mastered' | 'all'>(initialState)
const query = ref('')
const retryId = ref('')
const visibleEntries = computed(() => filterErrorBook(entries.value, { type: type.value, setId: setId.value, state: state.value, query: query.value }))

function toggleMastered(key: string, mastered: boolean): void {
  repository.setErrorMastered(key, mastered)
  entries.value = deriveErrorBook(repository.listAttempts(), allSets, repository.listMasteredErrorKeys())
}

function createRetry(): void {
  const drill = createRetryPracticeSet(visibleEntries.value)
  repository.saveImportedSets([drill])
  sessionStorage.setItem('ielts-pilot:retry-drill', JSON.stringify(drill))
  retryId.value = drill.id
}
</script>

<template>
  <main class="error-book-page page-shell">
    <header class="page-intro"><div><p class="section-kicker">Recovery queue</p><h1>错题本</h1></div><p>按题型和文章整理未掌握错误，重新作答后再标记为已掌握。</p></header>
    <section class="filter-rail" aria-label="错题筛选">
      <label class="search-field"><span>搜索</span><input v-model.trim="query" type="search" placeholder="题目、文章或解析" /></label>
      <label><span>文章</span><select v-model="setId"><option value="all">全部文章</option><option v-for="set in allSets" :key="set.id" :value="set.id">{{ set.title }}</option></select></label>
      <label><span>题型</span><select v-model="type"><option value="all">全部题型</option><option v-for="(label, key) in questionTypeLabels" :key="key" :value="key">{{ label }}</option></select></label>
      <label><span>状态</span><select v-model="state"><option value="learning">待巩固</option><option value="mastered">已掌握</option><option value="all">全部</option></select></label>
    </section>
    <section class="error-actions"><span>{{ visibleEntries.length }} 道题</span><button v-if="visibleEntries.length" data-testid="start-retry" type="button" @click="createRetry">生成当前错题练习</button><RouterLink v-if="retryId" class="signal-action" :to="`/practice/${retryId}`">开始强化练习 →</RouterLink></section>
    <section class="error-list">
      <article v-for="entry in visibleEntries" :key="entry.key" data-testid="error-row" class="error-row">
        <div><span>{{ questionTypeLabels[entry.question.type] }}</span><time>{{ new Date(entry.submittedAt).toLocaleDateString('zh-CN') }}</time></div>
        <h2>{{ entry.question.prompt }}</h2><p>{{ entry.practiceSet.title }} · 你的答案：{{ entry.result.givenAnswer.join(' + ') || '未作答' }}</p>
        <footer><RouterLink :to="`/result/${entry.attemptId}`">查看解析</RouterLink><button type="button" @click="repository.toggleFavoriteQuestion(entry.question.id)">收藏题目</button><button data-testid="master-error" type="button" :class="{ active: entry.mastered }" @click="toggleMastered(entry.key, !entry.mastered)">{{ entry.mastered ? '已掌握' : '标记掌握' }}</button></footer>
      </article>
      <p v-if="!visibleEntries.length" class="empty-note">当前筛选下没有需要巩固的错题。</p>
    </section>
  </main>
</template>
