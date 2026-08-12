<script setup lang="ts">
import { computed } from 'vue'
import type { QuestionOption, ReadingQuestion } from '../domain/models'

const props = defineProps<{ question: ReadingQuestion; modelValue: string[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

const matchingTypes = new Set([
  'matching-headings', 'matching-information', 'matching-features',
  'matching-sentence-endings', 'summary-word-bank',
])

const isMatching = computed(() => matchingTypes.has(props.question.type))
const isText = computed(() => ['short-answer', 'sentence-completion', 'diagram-label'].includes(props.question.type))
const options = computed<QuestionOption[]>(() => 'options' in props.question ? props.question.options : [])
const judgmentOptions = computed(() => props.question.type === 'yes-no-not-given'
  ? [{ key: 'yes', label: 'Yes' }, { key: 'no', label: 'No' }, { key: 'not given', label: 'Not Given' }]
  : [{ key: 'true', label: 'True' }, { key: 'false', label: 'False' }, { key: 'not given', label: 'Not Given' }])
const wordLimit = computed(() => 'wordLimit' in props.question ? props.question.wordLimit : 0)

function emitSingle(event: Event): void {
  const value = (event.target as HTMLInputElement | HTMLSelectElement).value
  emit('update:modelValue', value ? [value] : [])
}

function emitMultiple(event: Event): void {
  const input = event.target as HTMLInputElement
  const next = input.checked
    ? [...props.modelValue, input.value]
    : props.modelValue.filter((value) => value !== input.value)
  emit('update:modelValue', next)
}

function multiDisabled(key: string): boolean {
  if (props.question.type !== 'multiple-select') return false
  return !props.modelValue.includes(key) && props.modelValue.length >= props.question.selectLimit
}
</script>

<template>
  <fieldset class="question-fieldset" :aria-labelledby="`question-${question.id}`">
    <legend class="visually-hidden">作答选项</legend>
    <p :id="`question-${question.id}`" class="question-prompt">{{ question.prompt }}</p>

    <div v-if="question.type === 'multiple-choice'" class="answer-options">
      <label v-for="option in options" :key="option.key" class="answer-option" :class="{ 'answer-option--selected': modelValue.includes(option.key) }">
        <input type="radio" :name="question.id" :value="option.key" :checked="modelValue.includes(option.key)" @change="emitSingle" />
        <span class="answer-option__key">{{ option.key }}</span><span>{{ option.label }}</span>
      </label>
    </div>

    <div v-else-if="question.type === 'multiple-select'" class="answer-options">
      <p class="question-instruction">请选择 {{ question.selectLimit }} 项</p>
      <label v-for="option in options" :key="option.key" class="answer-option" :class="{ 'answer-option--selected': modelValue.includes(option.key) }">
        <input type="checkbox" :name="question.id" :value="option.key" :checked="modelValue.includes(option.key)" :disabled="multiDisabled(option.key)" @change="emitMultiple" />
        <span class="answer-option__key">{{ option.key }}</span><span>{{ option.label }}</span>
      </label>
    </div>

    <div v-else-if="question.type === 'true-false-not-given' || question.type === 'yes-no-not-given'" class="tfng-options">
      <label v-for="option in judgmentOptions" :key="option.key" class="tfng-option" :class="{ 'tfng-option--selected': modelValue.includes(option.key) }">
        <input type="radio" :name="question.id" :value="option.key" :checked="modelValue.includes(option.key)" @change="emitSingle" />
        <span>{{ option.label }}</span>
      </label>
    </div>

    <div v-else-if="isMatching" class="select-answer">
      <label :for="`answer-${question.id}`">选择最合适的答案</label>
      <select :id="`answer-${question.id}`" :value="modelValue[0] ?? ''" @change="emitSingle">
        <option value="">尚未作答</option>
        <option v-for="option in options" :key="option.key" :value="option.key">{{ option.key }} · {{ option.label }}</option>
      </select>
    </div>

    <div v-else-if="isText" class="short-answer">
      <p v-if="question.type === 'sentence-completion'" class="completion-context">
        {{ question.beforeBlank }} <span>________</span> {{ question.afterBlank }}
      </p>
      <p v-if="question.type === 'diagram-label'" class="diagram-context">{{ question.diagramDescription }}</p>
      <label :for="`answer-${question.id}`">你的答案 <small>不超过 {{ wordLimit }} 个英文单词</small></label>
      <input :id="`answer-${question.id}`" type="text" autocomplete="off" spellcheck="false" :value="modelValue[0] ?? ''" placeholder="Type your answer" @input="emitSingle" />
    </div>
  </fieldset>
</template>

