<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { practiceSets } from '../data/practiceSets'
import { questionTypeLabels } from '../domain/questionLabels'
import { createBrowserPracticeRepository } from '../storage/practiceRepository'

const repository = createBrowserPracticeRepository()
const allSets = [...practiceSets, ...repository.listImportedSets()]
const setIds = ref(repository.listFavoriteSetIds())
const questionIds = ref(repository.listFavoriteQuestionIds())
const favoriteSets = () => allSets.filter(({ id }) => setIds.value.includes(id))
const favoriteQuestions = () => allSets.flatMap((practiceSet) => practiceSet.questions.filter(({ id }) => questionIds.value.includes(id)).map((question) => ({ practiceSet, question })))
function removeSet(id: string): void { repository.toggleFavoriteSet(id); setIds.value = repository.listFavoriteSetIds() }
function removeQuestion(id: string): void { repository.toggleFavoriteQuestion(id); questionIds.value = repository.listFavoriteQuestionIds() }
</script>

<template>
  <main class="favorites-page page-shell">
    <header class="page-intro"><div><p class="section-kicker">Saved index</p><h1>我的收藏</h1></div><p>集中查看想再次练习的文章和复盘时保存的重点题目。</p></header>
    <section class="favorite-section"><header class="index-heading"><div><p class="section-kicker">Saved passages</p><h2>收藏文章</h2></div><span>{{ favoriteSets().length }} 篇</span></header>
      <article v-for="set in favoriteSets()" :key="set.id" class="favorite-row"><div><span>{{ set.sequence }}</span><h3>{{ set.title }}</h3><p>{{ set.topics.join(' · ') }}</p></div><button @click="removeSet(set.id)">取消收藏</button><RouterLink :to="`/practice/${set.id}`">开始练习 →</RouterLink></article>
      <p v-if="!favoriteSets().length" class="empty-note">还没有收藏文章。</p>
    </section>
    <section class="favorite-section"><header class="index-heading"><div><p class="section-kicker">Saved questions</p><h2>收藏题目</h2></div><span>{{ favoriteQuestions().length }} 题</span></header>
      <article v-for="entry in favoriteQuestions()" :key="entry.question.id" class="favorite-question"><span>{{ questionTypeLabels[entry.question.type] }}</span><h3>{{ entry.question.prompt }}</h3><p>{{ entry.practiceSet.title }}</p><button @click="removeQuestion(entry.question.id)">取消收藏</button><RouterLink :to="`/practice/${entry.practiceSet.id}`">回到原练习 →</RouterLink></article>
      <p v-if="!favoriteQuestions().length" class="empty-note">还没有收藏题目。</p>
    </section>
  </main>
</template>
