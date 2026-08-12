<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { validateContentPackage } from '../domain/contentPackage'
import { questionTypeLabels } from '../domain/questionLabels'
import type { Difficulty, PracticeSet, QuestionType } from '../domain/models'
import { practiceSets } from '../data/practiceSets'
import { createBrowserPracticeRepository } from '../storage/practiceRepository'

const repository = createBrowserPracticeRepository()
const importedSets = ref<PracticeSet[]>(repository.listImportedSets())
const query = ref('')
const difficulty = ref<Difficulty | 'all'>('all')
const type = ref<QuestionType | 'all'>('all')
const importMessage = ref('')
const favoriteSetIds = ref(repository.listFavoriteSetIds())
const allSets = computed(() => [...practiceSets, ...importedSets.value])
const filteredSets = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase()
  return allSets.value.filter((set) => {
    const searchable = [set.title, set.summary, set.passage.deck, ...set.topics].join(' ').toLocaleLowerCase()
    return (!needle || searchable.includes(needle))
      && (difficulty.value === 'all' || set.difficulty === difficulty.value)
      && (type.value === 'all' || set.questions.some((question) => question.type === type.value))
  })
})

function toggleFavorite(setId: string): void {
  repository.toggleFavoriteSet(setId)
  favoriteSetIds.value = repository.listFavoriteSetIds()
}

async function importPackage(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const result = validateContentPackage(JSON.parse(await file.text()))
    if (!result.ok) { importMessage.value = `导入失败：${result.errors[0]}`; return }
    repository.saveImportedSets(result.value.sets)
    importedSets.value = repository.listImportedSets()
    importMessage.value = `已导入 ${result.value.sets.length} 套授权练习。`
  } catch {
    importMessage.value = '导入失败：文件不是有效的 JSON 内容包。'
  } finally {
    input.value = ''
  }
}
</script>

<template>
  <main class="library-page page-shell">
    <header class="page-intro">
      <div><p class="section-kicker">Practice library</p><h1>题库索引</h1></div>
      <p>搜索原创内置内容，或导入你有权使用的 JSON 内容包。导入包必须包含作者、授权方式和来源说明。</p>
    </header>

    <section class="filter-rail" aria-label="题库筛选">
      <label class="search-field"><span>搜索</span><input v-model.trim="query" type="search" placeholder="标题、主题或关键词" /></label>
      <label><span>难度</span><select v-model="difficulty" name="difficulty"><option value="all">全部</option><option value="foundation">基础</option><option value="medium">中等</option><option value="advanced">进阶</option></select></label>
      <label><span>题型</span><select v-model="type" name="type"><option value="all">全部</option><option v-for="(label, key) in questionTypeLabels" :key="key" :value="key">{{ label }}</option></select></label>
      <label class="import-control"><span>授权内容</span><input type="file" accept="application/json,.json" @change="importPackage" /><b>导入 JSON</b></label>
    </section>
    <p class="import-feedback" aria-live="polite">{{ importMessage }}</p>

    <section class="library-index" aria-live="polite">
      <header><span>练习内容</span><span>难度</span><span>题量</span><span>题型</span><span>操作</span></header>
      <article v-for="set in filteredSets" :key="set.id" data-testid="library-row" class="library-row">
        <div><span>{{ set.sequence }}</span><div><h2>{{ set.title }}</h2><p>{{ set.topics.join(' · ') }} · {{ set.provenance.kind === 'original' ? '项目原创' : '已授权导入' }}</p></div></div>
        <span>{{ set.level }}</span><strong>{{ set.questions.length }}</strong><span>{{ new Set(set.questions.map(({ type }) => type)).size }} 种</span>
        <div class="library-row__actions"><button data-testid="favorite-set" type="button" :aria-pressed="favoriteSetIds.includes(set.id)" @click="toggleFavorite(set.id)">{{ favoriteSetIds.includes(set.id) ? '★ 已收藏' : '☆ 收藏' }}</button><RouterLink :to="`/practice/${set.id}`">开始练习 →</RouterLink></div>
      </article>
      <p v-if="!filteredSets.length" class="empty-note">没有符合当前条件的练习。</p>
    </section>
  </main>
</template>
