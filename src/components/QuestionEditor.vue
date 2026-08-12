<script setup lang="ts">
import { computed } from 'vue'
import { questionTypeLabels } from '../domain/questionLabels'
import type { QuestionOption, QuestionType } from '../domain/models'

const props = defineProps<{ modelValue: Record<string, unknown>; questionIndex: number }>()
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>]; remove: [] }>()
const optionTypes = new Set<QuestionType>(['multiple-choice', 'multiple-select', 'matching-headings', 'matching-information', 'matching-features', 'matching-sentence-endings', 'summary-word-bank'])
const textTypes = new Set<QuestionType>(['short-answer', 'sentence-completion', 'diagram-label'])
const type = computed(() => props.modelValue.type as QuestionType)
const answersText = computed(() => ((props.modelValue.acceptedAnswers as Array<string | string[]>) ?? []).map((answer) => Array.isArray(answer) ? answer.join('+') : answer).join(' / '))
const optionsText = computed(() => ((props.modelValue.options as QuestionOption[]) ?? []).map((option) => `${option.key}|${option.label}`).join('\n'))
const sourceRef = computed(() => (props.modelValue.sourceRef as { sectionIndex: number; paragraphIndex: number }) ?? { sectionIndex: 0, paragraphIndex: 0 })

function update(key: string, value: unknown): void { emit('update:modelValue', { ...props.modelValue, [key]: value }) }
function changeType(value: QuestionType): void {
  const next: Record<string, unknown> = { ...props.modelValue, type: value }
  if (optionTypes.has(value) && !Array.isArray(next.options)) next.options = [{ key: 'A', label: 'Option A' }, { key: 'B', label: 'Option B' }]
  if (textTypes.has(value) && typeof next.wordLimit !== 'number') next.wordLimit = 2
  if (value === 'multiple-select') next.selectLimit = Number(next.selectLimit) || 2
  if (value === 'sentence-completion') { next.beforeBlank = String(next.beforeBlank ?? 'Complete'); next.afterBlank = String(next.afterBlank ?? '.') }
  if (value === 'diagram-label') next.diagramDescription = String(next.diagramDescription ?? 'Describe the diagram position.')
  emit('update:modelValue', next)
}
function updateAnswers(value: string): void {
  update('acceptedAnswers', value.split('/').map((item) => item.trim()).filter(Boolean).map((item) => item.includes('+') ? item.split('+').map((part) => part.trim()).filter(Boolean) : item))
}
function updateOptions(value: string): void {
  update('options', value.split('\n').map((line) => line.trim()).filter(Boolean).map((line, index) => { const [key, ...label] = line.split('|'); return { key: key?.trim() || String.fromCharCode(65 + index), label: label.join('|').trim() || key?.trim() || `Option ${index + 1}` } }))
}
function updateSource(key: 'sectionIndex' | 'paragraphIndex', value: number): void { update('sourceRef', { ...sourceRef.value, [key]: value }) }
</script>

<template>
  <article class="question-editor">
    <header><span>QUESTION {{ String(questionIndex + 1).padStart(2, '0') }}</span><button type="button" @click="emit('remove')">删除题目</button></header>
    <div class="editor-grid">
      <label><span>题目 ID</span><input :value="String(modelValue.id ?? '')" @input="update('id', ($event.target as HTMLInputElement).value)" /></label>
      <label><span>题型</span><select :value="type" @change="changeType(($event.target as HTMLSelectElement).value as QuestionType)"><option v-for="(label, key) in questionTypeLabels" :key="key" :value="key">{{ label }}</option></select></label>
      <label class="editor-span"><span>题干</span><textarea rows="2" :value="String(modelValue.prompt ?? '')" @input="update('prompt', ($event.target as HTMLTextAreaElement).value)" /></label>
      <label class="editor-span"><span>可接受答案 <small>用 / 分隔同义答案，多选组合用 +</small></span><input :value="answersText" @input="updateAnswers(($event.target as HTMLInputElement).value)" /></label>
      <label v-if="optionTypes.has(type)" class="editor-span"><span>选项 <small>每行使用 KEY|Label</small></span><textarea rows="4" :value="optionsText" @input="updateOptions(($event.target as HTMLTextAreaElement).value)" /></label>
      <label v-if="textTypes.has(type)"><span>单词上限</span><input type="number" min="1" :value="Number(modelValue.wordLimit ?? 2)" @input="update('wordLimit', Number(($event.target as HTMLInputElement).value))" /></label>
      <label v-if="type === 'multiple-select'"><span>选择数量</span><input type="number" min="2" :value="Number(modelValue.selectLimit ?? 2)" @input="update('selectLimit', Number(($event.target as HTMLInputElement).value))" /></label>
      <label v-if="type === 'sentence-completion'"><span>空格前文本</span><input :value="String(modelValue.beforeBlank ?? '')" @input="update('beforeBlank', ($event.target as HTMLInputElement).value)" /></label>
      <label v-if="type === 'sentence-completion'"><span>空格后文本</span><input :value="String(modelValue.afterBlank ?? '')" @input="update('afterBlank', ($event.target as HTMLInputElement).value)" /></label>
      <label v-if="type === 'diagram-label'" class="editor-span"><span>图示位置说明</span><textarea rows="2" :value="String(modelValue.diagramDescription ?? '')" @input="update('diagramDescription', ($event.target as HTMLTextAreaElement).value)" /></label>
      <label><span>原文章节（从 0 开始）</span><input type="number" min="0" :value="sourceRef.sectionIndex" @input="updateSource('sectionIndex', Number(($event.target as HTMLInputElement).value))" /></label>
      <label><span>原文段落（从 0 开始）</span><input type="number" min="0" :value="sourceRef.paragraphIndex" @input="updateSource('paragraphIndex', Number(($event.target as HTMLInputElement).value))" /></label>
      <label class="editor-span"><span>答案解析</span><textarea rows="3" :value="String(modelValue.explanation ?? '')" @input="update('explanation', ($event.target as HTMLTextAreaElement).value)" /></label>
    </div>
  </article>
</template>
