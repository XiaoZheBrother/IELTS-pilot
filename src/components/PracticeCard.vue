<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { Attempt, PracticeDraft, PracticeSet } from '../domain/models'

const props = defineProps<{
  practiceSet: PracticeSet
  draft: PracticeDraft | null
  latestAttempt: Attempt | null
  isFavorite?: boolean
}>()
const emit = defineEmits<{ favorite: [setId: string] }>()

function draftProgress(): number {
  if (!props.draft) return 0
  const answered = Object.values(props.draft.answers).filter((value) => value.some((answer) => answer.trim())).length
  return Math.round((answered / props.practiceSet.questions.length) * 100)
}
</script>

<template>
  <article class="practice-card" data-testid="practice-card">
    <header class="practice-card__header">
      <span class="practice-card__number">{{ props.practiceSet.sequence }}</span>
      <div>
        <button data-testid="card-favorite" class="card-favorite" type="button" :aria-label="props.isFavorite ? '取消收藏' : '收藏练习'" :aria-pressed="props.isFavorite" @click="emit('favorite', props.practiceSet.id)"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3.6 14.6 9l5.9.9-4.3 4.2 1 5.9-5.2-2.8L6.8 20l1-5.9-4.3-4.2L9.4 9 12 3.6Z" :fill="props.isFavorite ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.6" /></svg></button>
        <p class="section-kicker">{{ props.practiceSet.eyebrow }}</p>
        <span class="practice-card__level">{{ props.practiceSet.level }}</span>
      </div>
    </header>
    <h3>{{ props.practiceSet.title }}</h3>
    <p>{{ props.practiceSet.summary }}</p>
    <dl class="practice-card__meta">
      <div>
        <dt>题量</dt>
        <dd>{{ props.practiceSet.questions.length }} 题</dd>
      </div>
      <div>
        <dt>建议用时</dt>
        <dd>{{ props.practiceSet.durationMinutes }} 分钟</dd>
      </div>
      <div>
        <dt>题型</dt>
        <dd>混合题型</dd>
      </div>
    </dl>
    <div v-if="props.draft" class="draft-progress">
      <span>上次进度 {{ draftProgress() }}%</span>
      <span class="draft-progress__track"><i :style="{ width: `${draftProgress()}%` }" /></span>
    </div>
    <div v-else-if="props.latestAttempt" class="last-score">
      上次 {{ props.latestAttempt.score.correct }}/{{ props.latestAttempt.score.total }} · Band
      {{ props.latestAttempt.score.approximateBand.toFixed(1) }}
    </div>
    <RouterLink class="text-link" :to="`/practice/${props.practiceSet.id}`">
      {{ props.draft ? '继续练习' : '开始练习' }} <span aria-hidden="true">↗</span>
    </RouterLink>
  </article>
</template>
