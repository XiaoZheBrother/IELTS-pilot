<script setup lang="ts">
import { computed, ref } from 'vue'
import { createPassageAnnotation, segmentParagraph } from '../domain/annotations'
import type { AnnotationColor, PassageAnnotation, PracticeSet, ReaderPreferences } from '../domain/models'

const props = defineProps<{ practiceSet: PracticeSet; annotations: PassageAnnotation[]; preferences: ReaderPreferences }>()
const emit = defineEmits<{ add: [annotation: PassageAnnotation]; update: [annotation: PassageAnnotation]; remove: [id: string] }>()
const pending = ref<{ sectionIndex: number; paragraphIndex: number; paragraph: string; startOffset: number; endOffset: number } | null>(null)
const activeId = ref<string | null>(null)
const noteDraft = ref('')
const activeAnnotation = computed(() => props.annotations.find(({ id }) => id === activeId.value) ?? null)

function paragraphAnnotations(sectionIndex: number, paragraphIndex: number): PassageAnnotation[] {
  return props.annotations.filter((item) => item.sectionIndex === sectionIndex && item.paragraphIndex === paragraphIndex)
}

function captureSelection(event: MouseEvent): void {
  const paragraphElement = (event.target as HTMLElement).closest<HTMLElement>('[data-passage-paragraph]')
  const selection = window.getSelection()
  if (!paragraphElement || !selection || selection.rangeCount === 0 || selection.isCollapsed) { pending.value = null; return }
  const range = selection.getRangeAt(0)
  if (!paragraphElement.contains(range.commonAncestorContainer)) { pending.value = null; return }
  const before = range.cloneRange()
  before.selectNodeContents(paragraphElement)
  before.setEnd(range.startContainer, range.startOffset)
  const startOffset = before.toString().length
  const selectedText = range.toString()
  if (!selectedText.trim()) { pending.value = null; return }
  pending.value = {
    sectionIndex: Number(paragraphElement.dataset.sectionIndex), paragraphIndex: Number(paragraphElement.dataset.paragraphIndex),
    paragraph: paragraphElement.textContent ?? '', startOffset, endOffset: startOffset + selectedText.length,
  }
}

function addHighlight(color: AnnotationColor): void {
  if (!pending.value) return
  emit('add', createPassageAnnotation({ setId: props.practiceSet.id, ...pending.value, color }))
  pending.value = null
  window.getSelection()?.removeAllRanges()
}

function openAnnotation(annotation: PassageAnnotation): void {
  activeId.value = annotation.id
  noteDraft.value = annotation.note
}

function saveNote(): void {
  if (!activeAnnotation.value) return
  emit('update', { ...activeAnnotation.value, note: noteDraft.value.trim(), updatedAt: new Date().toISOString() })
  activeId.value = null
}
</script>

<template>
  <article class="exam-passage passage-reader" :data-theme="preferences.theme" @mouseup="captureSelection">
    <header><p class="section-kicker">Reading passage</p><h1>{{ practiceSet.passage.title }}</h1><p>{{ practiceSet.passage.deck }}</p></header>
    <div v-if="pending" class="selection-toolbar" role="toolbar" aria-label="文本标注">
      <span>标记选中文本</span>
      <button v-for="color in (['signal', 'sage', 'amber'] as AnnotationColor[])" :key="color" type="button" :data-color="color" :aria-label="`使用 ${color} 颜色标记`" @click="addHighlight(color)" />
    </div>
    <section v-for="(section, sectionIndex) in practiceSet.passage.sections" :key="section.heading" class="passage-block">
      <span>{{ String.fromCharCode(65 + sectionIndex) }}</span>
      <div><h2>{{ section.heading }}</h2>
        <p v-for="(paragraph, paragraphIndex) in section.paragraphs" :key="paragraphIndex" data-passage-paragraph :data-section-index="sectionIndex" :data-paragraph-index="paragraphIndex">
          <template v-for="(segment, segmentIndex) in segmentParagraph(paragraph, paragraphAnnotations(sectionIndex, paragraphIndex))" :key="segmentIndex">
            <mark v-if="segment.annotation" :data-color="segment.annotation.color" :title="segment.annotation.note || '点击编辑标注'" tabindex="0" @click.stop="openAnnotation(segment.annotation)" @keydown.enter.stop="openAnnotation(segment.annotation)">{{ segment.text }}</mark><template v-else>{{ segment.text }}</template>
          </template>
        </p>
      </div>
    </section>
    <footer>{{ practiceSet.provenance.note }}</footer>
    <aside v-if="activeAnnotation" class="annotation-editor" aria-label="标注笔记">
      <strong>{{ activeAnnotation.selectedText }}</strong>
      <p v-if="activeAnnotation.note">{{ activeAnnotation.note }}</p>
      <textarea v-model="noteDraft" rows="3" placeholder="为这段文字添加笔记" />
      <div><button type="button" @click="activeId = null">取消</button><button data-testid="delete-annotation" type="button" @click="emit('remove', activeAnnotation.id); activeId = null">删除</button><button type="button" class="signal-action" @click="saveNote">保存笔记</button></div>
    </aside>
  </article>
</template>
