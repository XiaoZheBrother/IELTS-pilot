<script setup lang="ts">
import type { WritingCriterion } from '../domain/writingAssessment'
import { WRITING_CRITERIA } from '../domain/writingAssessment'

const props = defineProps<{ criteria: WritingCriterion[] }>()

function label(id: WritingCriterion['criterion']): string {
  return WRITING_CRITERIA.find((item) => item.id === id)?.label ?? id
}
</script>

<template>
  <div class="writing-rubric" aria-label="写作四维辅助量表">
    <article v-for="criterion in props.criteria" :key="criterion.criterion" data-testid="writing-criterion">
      <header><span>{{ label(criterion.criterion) }}</span><strong>{{ criterion.band.toFixed(1) }}</strong></header>
      <div class="rubric-scale" aria-hidden="true"><i :style="{ width: `${(criterion.band / 9) * 100}%` }" /></div>
      <p>{{ criterion.rationale }}</p>
    </article>
  </div>
</template>
