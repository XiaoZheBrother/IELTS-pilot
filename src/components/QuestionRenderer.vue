<script setup lang="ts">
import type { ReadingQuestion } from '../domain/models'

const props = defineProps<{
  question: ReadingQuestion
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const tfngOptions = [
  { key: 'true', label: 'True' },
  { key: 'false', label: 'False' },
  { key: 'not given', label: 'Not Given' },
]

function updateValue(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <fieldset class="question-fieldset" :aria-labelledby="`question-${props.question.id}`">
    <legend class="visually-hidden">作答选项</legend>
    <p :id="`question-${props.question.id}`" class="question-prompt">
      {{ props.question.prompt }}
    </p>

    <div v-if="props.question.type === 'multiple-choice'" class="answer-options">
      <label
        v-for="option in props.question.options"
        :key="option.key"
        class="answer-option"
        :class="{ 'answer-option--selected': props.modelValue === option.key }"
      >
        <input
          type="radio"
          :name="props.question.id"
          :value="option.key"
          :checked="props.modelValue === option.key"
          @change="updateValue"
        />
        <span class="answer-option__key">{{ option.key }}</span>
        <span>{{ option.label }}</span>
      </label>
    </div>

    <div v-else-if="props.question.type === 'true-false-not-given'" class="tfng-options">
      <label
        v-for="option in tfngOptions"
        :key="option.key"
        class="tfng-option"
        :class="{ 'tfng-option--selected': props.modelValue === option.key }"
      >
        <input
          type="radio"
          :name="props.question.id"
          :value="option.key"
          :checked="props.modelValue === option.key"
          @change="updateValue"
        />
        <span>{{ option.label }}</span>
      </label>
    </div>

    <div v-else class="short-answer">
      <label :for="`answer-${props.question.id}`">
        你的答案
        <small>不超过 {{ props.question.wordLimit }} 个英文单词</small>
      </label>
      <input
        :id="`answer-${props.question.id}`"
        type="text"
        autocomplete="off"
        spellcheck="false"
        :value="props.modelValue"
        placeholder="Type your answer"
        @input="updateValue"
      />
    </div>
  </fieldset>
</template>
