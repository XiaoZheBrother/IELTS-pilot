<script setup lang="ts">
import { computed, ref } from 'vue'
import { questionTypeLabels } from '../domain/questionLabels'
import type { PracticeSet, ReadingItemResult, ReadingQuestion } from '../domain/models'

const props = defineProps<{ index: number; question: ReadingQuestion; result: ReadingItemResult; practiceSet: PracticeSet; favorite?: boolean }>()
const emit = defineEmits<{ 'toggle-favorite': [questionId: string] }>()
const expanded = ref(false)
const sourceParagraph = computed(() => props.practiceSet.passage.sections[props.result.sourceRef.sectionIndex]?.paragraphs[props.result.sourceRef.paragraphIndex] ?? '原文定位不可用。')

function formatAnswers(values: Array<string | string[]>): string {
  return values.map((value) => Array.isArray(value) ? value.join(' + ') : value).join(' / ')
}
</script>

<template>
  <article class="review-row" :class="{ 'review-row--correct': result.isCorrect, 'review-row--expanded': expanded }">
    <div class="review-row__summary">
      <span class="review-row__number">{{ String(index + 1).padStart(2, '0') }}</span>
      <div class="review-row__question">
        <span>{{ questionTypeLabels[question.type] }}</span>
        <strong>{{ question.prompt }}</strong>
      </div>
      <div><small>你的答案</small><b>{{ result.givenAnswer.join(' + ') || '未作答' }}</b></div>
      <div><small>正确答案</small><b>{{ formatAnswers(result.acceptedAnswers) }}</b></div>
      <div class="review-row__actions"><button data-testid="favorite-question" type="button" :aria-label="favorite ? '取消收藏题目' : '收藏题目'" :aria-pressed="favorite" @click="emit('toggle-favorite', question.id)"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3.6 14.6 9l5.9.9-4.3 4.2 1 5.9-5.2-2.8L6.8 20l1-5.9-4.3-4.2L9.4 9 12 3.6Z" :fill="favorite ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.6" /></svg></button><button type="button" :aria-expanded="expanded" @click="expanded = !expanded">{{ expanded ? '收起原文' : '查看原文' }}</button></div>
    </div>
    <div v-show="expanded" class="review-row__detail">
      <blockquote data-testid="source-excerpt">
        <span>原文定位 · {{ practiceSet.passage.title }}</span>
        <p>{{ sourceParagraph }}</p>
      </blockquote>
      <div><span>解析</span><p>{{ result.explanation }}</p></div>
    </div>
  </article>
</template>

