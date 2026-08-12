<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { measureActionOutcome, type LearningPlan } from '../domain/learningPlan'
import type { Attempt } from '../domain/models'

const props = defineProps<{ plan: LearningPlan; attempts: Attempt[] }>()
const emit = defineEmits<{ toggle: [id: string]; refresh: []; navigate: [] }>()
const horizon = ref<'today' | 'week'>('today')
const visible = computed(() => props.plan.items.filter((item) => item.horizon === horizon.value))
</script>

<template>
  <section class="learning-plan-view" aria-label="学习计划">
    <header>
      <div><span>LOCAL LEARNING PLAN</span><h3>把建议变成一次练习</h3></div>
      <button type="button" @click="emit('refresh')">重新生成</button>
    </header>
    <div class="learning-plan-tabs" role="tablist" aria-label="计划周期">
      <button role="tab" type="button" :aria-selected="horizon === 'today'" @click="horizon = 'today'">今天</button>
      <button role="tab" type="button" :aria-selected="horizon === 'week'" @click="horizon = 'week'">本周</button>
    </div>
    <div v-if="visible.length" class="learning-plan-list">
      <article v-for="(item, index) in visible" :key="item.id" :class="{ completed: item.status === 'completed' }">
        <button class="plan-check" type="button" :aria-label="item.status === 'completed' ? `恢复 ${item.title}` : `完成 ${item.title}`" @click="emit('toggle', item.id)">
          {{ item.status === 'completed' ? '✓' : String(index + 1).padStart(2, '0') }}
        </button>
        <div><h4>{{ item.title }}</h4><p>{{ item.reason }}</p>
          <small>{{ item.estimatedMinutes }} 分钟 · {{ measureActionOutcome(item, attempts).label }}</small>
        </div>
        <button v-if="item.kind === 'plan'" class="plan-go" type="button">→</button>
        <RouterLink v-else class="plan-go" :to="item.to" :aria-label="`开始 ${item.title}`" @click="emit('navigate')">→</RouterLink>
      </article>
    </div>
    <p v-else class="assistant-empty-state">这个周期暂时没有行动。完成更多练习后重新生成。</p>
    <footer><span>{{ plan.items.filter(({ status }) => status === 'completed').length }}/{{ plan.items.length }} 已完成</span><small>计划保存在本机，不上传学习记录。</small></footer>
  </section>
</template>
