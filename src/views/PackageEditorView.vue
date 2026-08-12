<script setup lang="ts">
import { reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import QuestionEditor from '../components/QuestionEditor.vue'
import { validateContentPackage, type ContentPackageV2 } from '../domain/contentPackage'
import type { PracticeSet, ReadingQuestion } from '../domain/models'
import { createBrowserPracticeRepository } from '../storage/practiceRepository'

const repository = createBrowserPracticeRepository()
const timestamp = new Date().toISOString()
const draftId = `author-${Date.now()}`

function defaultQuestion(index: number): ReadingQuestion {
  return { id: `local_q${index + 1}`, type: 'short-answer', prompt: 'What key idea is stated in the paragraph?', acceptedAnswers: ['sample answer'], wordLimit: 2, explanation: 'Explain how the cited paragraph supports the answer.', sourceRef: { sectionIndex: 0, paragraphIndex: 0 } }
}
function defaultSet(index: number): PracticeSet {
  return {
    id: `local-set-${index + 1}`, sequence: `L${index + 1}`, eyebrow: 'Local author', title: 'Untitled reading passage', summary: 'Describe the learning focus.', level: 'B2', durationMinutes: 20,
    topics: ['general'], difficulty: 'medium', estimatedBand: 6, passage: { title: 'Untitled passage', deck: 'Add a short introduction.', sections: [{ heading: 'Section A', paragraphs: ['Replace this paragraph with original or authorized passage text.'] }] },
    provenance: { kind: 'original', author: 'Local author', note: 'Created locally by the user.', license: 'All rights reserved' }, questions: [defaultQuestion(0)],
  }
}

const content = reactive<ContentPackageV2>({
  schemaVersion: 2, packageId: `local-pack-${Date.now()}`, version: '1.0.0', name: 'Untitled Reading Pack', description: 'A locally authored reading practice package.',
  owner: 'Local author', license: 'All rights reserved', note: 'Created locally. Confirm rights before sharing.', createdAt: timestamp, updatedAt: timestamp,
  minimumAppVersion: '0.5.0', changelog: 'Initial local draft.', sets: [defaultSet(0)],
})
const activeSetIndex = ref(0)
const feedback = ref('')
const activeSet = () => content.sets[activeSetIndex.value]!
const topicsText = () => activeSet().topics.join(', ')

function setTopics(value: string): void { activeSet().topics = value.split(',').map((item) => item.trim()).filter(Boolean) }
function addSet(): void { content.sets.push(defaultSet(content.sets.length)); activeSetIndex.value = content.sets.length - 1 }
function removeSet(): void { if (content.sets.length === 1) return; content.sets.splice(activeSetIndex.value, 1); activeSetIndex.value = Math.max(activeSetIndex.value - 1, 0) }
function addSection(): void { activeSet().passage.sections.push({ heading: `Section ${String.fromCharCode(65 + activeSet().passage.sections.length)}`, paragraphs: ['New paragraph.'] }) }
function addParagraph(sectionIndex: number): void { activeSet().passage.sections[sectionIndex]!.paragraphs.push('New paragraph.') }
function addQuestion(): void { activeSet().questions.push(defaultQuestion(activeSet().questions.length)) }
function updateQuestion(index: number, value: Record<string, unknown>): void { activeSet().questions[index] = value as unknown as ReadingQuestion }
function removeQuestion(index: number): void { if (activeSet().questions.length > 1) activeSet().questions.splice(index, 1) }
function saveDraft(): void {
  content.updatedAt = new Date().toISOString()
  repository.saveAuthorDraft({ id: draftId, name: content.name, updatedAt: content.updatedAt, package: JSON.parse(JSON.stringify(content)) as Record<string, unknown> })
  feedback.value = '草稿已保存到当前设备。'
}
function validate(): boolean {
  const result = validateContentPackage(content)
  feedback.value = result.ok ? '内容包校验通过，可以安全导出。' : `校验失败：${result.errors.join('；')}`
  return result.ok
}
function exportPackage(): void {
  if (!validate()) return
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${content.packageId}-${content.version}.json`; anchor.click(); URL.revokeObjectURL(url)
}
</script>

<template>
  <main class="package-editor-page page-shell">
    <header class="page-intro"><div><p class="section-kicker">Local authoring studio</p><h1>创建题库包</h1></div><p>只使用原创、公共领域或明确获授权内容。导出文件会经过与安装流程相同的结构校验。</p></header>
    <div class="editor-actions"><RouterLink to="/library/packages">← 返回题库包</RouterLink><span aria-live="polite">{{ feedback }}</span><button data-testid="save-author-draft" type="button" @click="saveDraft">保存草稿</button><button data-testid="validate-package" type="button" @click="validate">校验内容</button><button class="signal-action" type="button" @click="exportPackage">导出 JSON</button></div>
    <section class="editor-panel"><header><p class="section-kicker">Package metadata</p><h2>内容包信息</h2></header><div class="editor-grid">
      <label><span>内容包 ID</span><input v-model.trim="content.packageId" /></label><label><span>版本</span><input v-model.trim="content.version" /></label>
      <label class="editor-span"><span>名称</span><input v-model.trim="content.name" name="package-name" /></label><label class="editor-span"><span>简介</span><textarea v-model.trim="content.description" rows="2" /></label>
      <label><span>作者 / 权利人</span><input v-model.trim="content.owner" /></label><label><span>许可证</span><input v-model.trim="content.license" /></label>
      <label class="editor-span"><span>来源链接（可选）</span><input v-model.trim="content.sourceUrl" type="url" /></label><label class="editor-span"><span>授权与来源说明</span><textarea v-model.trim="content.note" rows="2" /></label><label class="editor-span"><span>版本变更</span><input v-model.trim="content.changelog" /></label>
    </div></section>
    <nav class="set-tabs" aria-label="练习切换"><button v-for="(set, index) in content.sets" :key="set.id" :class="{ active: activeSetIndex === index }" @click="activeSetIndex = index">{{ set.sequence }} · {{ set.title }}</button><button @click="addSet">＋ 新练习</button></nav>
    <section class="editor-panel"><header><div><p class="section-kicker">Practice set</p><h2>练习与文章</h2></div><button :disabled="content.sets.length === 1" @click="removeSet">删除当前练习</button></header><div class="editor-grid">
      <label><span>练习 ID</span><input v-model.trim="activeSet().id" /></label><label><span>编号</span><input v-model.trim="activeSet().sequence" /></label><label class="editor-span"><span>标题</span><input v-model.trim="activeSet().title" /></label>
      <label><span>难度</span><select v-model="activeSet().difficulty"><option value="foundation">基础</option><option value="medium">中等</option><option value="advanced">进阶</option></select></label><label><span>建议分钟</span><input v-model.number="activeSet().durationMinutes" type="number" min="5" /></label>
      <label class="editor-span"><span>主题（逗号分隔）</span><input :value="topicsText()" @input="setTopics(($event.target as HTMLInputElement).value)" /></label><label class="editor-span"><span>文章标题</span><input v-model.trim="activeSet().passage.title" /></label><label class="editor-span"><span>文章导语</span><textarea v-model.trim="activeSet().passage.deck" rows="2" /></label>
    </div>
    <div class="section-editors"><article v-for="(section, sectionIndex) in activeSet().passage.sections" :key="sectionIndex" class="section-editor"><header><strong>SECTION {{ sectionIndex + 1 }}</strong><input v-model.trim="section.heading" aria-label="章节标题" /></header><label v-for="(_, paragraphIndex) in section.paragraphs" :key="paragraphIndex"><span>段落 {{ paragraphIndex + 1 }}</span><textarea v-model.trim="section.paragraphs[paragraphIndex]" rows="5" /></label><button type="button" @click="addParagraph(sectionIndex)">＋ 添加段落</button></article><button type="button" class="add-section" @click="addSection">＋ 添加章节</button></div>
    </section>
    <section class="editor-panel"><header><div><p class="section-kicker">Questions</p><h2>题目与解析</h2></div><button data-testid="add-question" type="button" @click="addQuestion">＋ 添加题目</button></header><QuestionEditor v-for="(question, index) in activeSet().questions" :key="String(question.id)" :model-value="question as unknown as Record<string, unknown>" :question-index="index" @update:model-value="updateQuestion(index, $event)" @remove="removeQuestion(index)" /></section>
  </main>
</template>
