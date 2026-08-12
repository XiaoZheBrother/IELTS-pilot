<script setup lang="ts">
import type { ReadingScore } from '../domain/models'

const props = defineProps<{ score: ReadingScore }>()
</script>

<template>
  <section class="score-summary" aria-labelledby="score-heading">
    <div class="score-summary__main">
      <p class="section-kicker">Raw score</p>
      <h2 id="score-heading">{{ props.score.correct }} / {{ props.score.total }}</h2>
      <p>{{ props.score.percentage }}% 正确率</p>
    </div>
    <div class="score-summary__band">
      <span>练习估算</span>
      <strong>Band {{ props.score.approximateBand.toFixed(1) }}</strong>
      <small>折算原始分 {{ props.score.normalizedRaw40 }} / 40</small>
    </div>
    <p class="score-summary__notice">
      此分数按当前答题结果估算，仅用于练习反馈，不是官方 IELTS 成绩。
    </p>
  </section>
</template>
