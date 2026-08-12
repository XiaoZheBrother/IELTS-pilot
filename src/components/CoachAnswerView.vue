<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { CoachAnswer, CoachEvidenceEntry } from '../domain/coachAnswer'
import type { ResolvedLearningAction } from '../domain/learningPlan'

const props = defineProps<{ answer: CoachAnswer; catalog: CoachEvidenceEntry[]; actions?: ResolvedLearningAction[] }>()
const emit = defineEmits<{ navigate: []; showPlan: [] }>()
const expanded = ref(false)
const evidence = computed(() => {
  const ids = new Set([
    ...props.answer.conclusion.evidenceIds,
    ...props.answer.facts.flatMap(({ evidenceIds }) => evidenceIds),
    ...props.answer.inferences.flatMap(({ evidenceIds }) => evidenceIds),
  ])
  return props.catalog.filter(({ id }) => ids.has(id))
})
const confidenceLabel = (value: string) => value === 'high' ? '高可信' : value === 'medium' ? '可参考' : '样本不足'
</script>

<template>
  <article class="coach-answer" data-testid="coach-answer">
    <header class="coach-answer__conclusion">
      <span>结论</span>
      <small :data-confidence="answer.conclusion.confidence">{{ confidenceLabel(answer.conclusion.confidence) }}</small>
      <h4>{{ answer.conclusion.text }}</h4>
    </header>

    <button v-if="evidence.length" class="coach-evidence-toggle" type="button" :aria-expanded="expanded" @click="expanded = !expanded">
      <span>证据链 · {{ evidence.length }} 项</span><b aria-hidden="true">{{ expanded ? '−' : '+' }}</b>
    </button>
    <dl v-if="expanded" class="coach-evidence-list">
      <div v-for="item in evidence" :key="item.id">
        <dt>{{ item.label }}</dt><dd>{{ item.value }}</dd>
        <small>{{ item.sampleSize }} 个样本 · {{ confidenceLabel(item.confidence) }}</small>
      </div>
    </dl>

    <div v-if="answer.facts.length || answer.inferences.length" class="coach-answer__reasoning">
      <div v-if="answer.facts.length"><span>已知事实</span><p v-for="fact in answer.facts" :key="fact.text">{{ fact.text }}</p></div>
      <div v-if="answer.inferences.length"><span>基于事实的判断</span><p v-for="item in answer.inferences" :key="item.text">{{ item.text }}</p></div>
    </div>

    <div v-if="actions?.length" class="coach-actions" aria-label="建议行动">
      <span>下一步行动</span>
      <template v-for="action in actions" :key="action.id">
        <button v-if="action.kind === 'plan'" type="button" @click="emit('showPlan')">
          <b>{{ action.title }}</b><small>{{ action.reason }} · {{ action.estimatedMinutes }} 分钟</small><i aria-hidden="true">→</i>
        </button>
        <RouterLink v-else :to="action.to" @click="emit('navigate')">
          <b>{{ action.title }}</b><small>{{ action.reason }} · {{ action.estimatedMinutes }} 分钟</small><i aria-hidden="true">→</i>
        </RouterLink>
      </template>
    </div>
  </article>
</template>
