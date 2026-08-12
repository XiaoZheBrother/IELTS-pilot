<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { practiceSets } from '../data/practiceSets'
import { buildLocalCoachAnswer, formatCoachAnswer, parseCoachAnswer, type CoachAnswer } from '../domain/coachAnswer'
import {
  buildAssistantMessages, buildCoachOverview, buildEvidenceCatalog, buildLearningSnapshot,
  type AssistantConversationMessage,
} from '../domain/learningAssistant'
import { buildLearningPlan, refreshLearningPlan, resolveCoachActions, togglePlanItem } from '../domain/learningPlan'
import { containsSensitiveCredential } from '../domain/sensitiveText'
import type { AssistantAvailability } from '../platform/learningAssistantClient'
import type { AssistantConversation, AssistantStoredMessage } from '../storage/assistantConversationRepository'
import CoachAnswerView from './CoachAnswerView.vue'
import ConversationHistory from './ConversationHistory.vue'
import LearningPlanView from './LearningPlanView.vue'
import { createLearningAssistantDependencies, LEARNING_ASSISTANT_KEY } from './learningAssistantDependencies'

type AssistantView = 'diagnosis' | 'plan' | 'chat'

const dependencies = inject(LEARNING_ASSISTANT_KEY, null) ?? createLearningAssistantDependencies()
const open = ref(false)
const view = ref<AssistantView>('diagnosis')
const busy = ref(false)
const error = ref('')
const draft = ref('')
const failedQuestion = ref('')
const copiedId = ref('')
const availability = ref<AssistantAvailability | null>(null)
const messages = ref<AssistantStoredMessage[]>(dependencies.conversation.list())
const conversations = ref<AssistantConversation[]>(dependencies.conversation.listConversations())
const activeConversationId = ref(dependencies.conversation.activeConversationId())
const orb = ref<HTMLButtonElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
const input = ref<HTMLTextAreaElement | null>(null)
const messageList = ref<HTMLDivElement | null>(null)
let controller: AbortController | null = null

const attempts = ref(dependencies.practice.listAttempts())
const reports = ref(dependencies.writing.listReports())
const sets = ref([...practiceSets, ...dependencies.practice.listImportedSets()])
const snapshot = ref(buildLearningSnapshot(attempts.value, dependencies.practice.listMasteredErrorKeys(), reports.value))
const catalog = computed(() => buildEvidenceCatalog(snapshot.value))
const overview = computed(() => buildCoachOverview(snapshot.value))
const isAvailable = computed(() => availability.value?.available === true)
const quickQuestions = ['分析我最近的学习状态', '我现在最应该练什么？', '帮我制定下一次练习计划']
const localDiagnosis = computed(() => buildLocalCoachAnswer(catalog.value))
const localActions = computed(() => resolveCoachActions(localDiagnosis.value, snapshot.value, sets.value, reports.value))
const plan = ref(dependencies.plan.get() ?? buildLearningPlan(snapshot.value, sets.value, reports.value, attempts.value, dependencies.now()))

function refreshLocalData(): void {
  attempts.value = dependencies.practice.listAttempts()
  reports.value = dependencies.writing.listReports()
  sets.value = [...practiceSets, ...dependencies.practice.listImportedSets()]
  snapshot.value = buildLearningSnapshot(attempts.value, dependencies.practice.listMasteredErrorKeys(), reports.value)
  if (!dependencies.plan.get()) dependencies.plan.save(plan.value)
}

function messageId(role: 'user' | 'assistant'): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  return `${role}-${dependencies.now().getTime()}-${random}`
}

function syncConversationUi(): void {
  messages.value = dependencies.conversation.list()
  conversations.value = dependencies.conversation.listConversations()
  activeConversationId.value = dependencies.conversation.activeConversationId()
}

async function refreshAvailability(): Promise<void> {
  availability.value = await dependencies.client.checkAvailability(dependencies.settings.get())
}

async function toggle(): Promise<void> {
  open.value = !open.value
  error.value = ''
  if (open.value) {
    refreshLocalData()
    void refreshAvailability()
    await nextTick()
    closeButton.value?.focus()
  } else orb.value?.focus()
}

function close(): void {
  if (!open.value) return
  open.value = false
  error.value = ''
  nextTick(() => orb.value?.focus())
}

function persist(next: AssistantStoredMessage[]): void {
  dependencies.conversation.save(next.slice(-40))
  syncConversationUi()
}

function resolvedActions(answer: CoachAnswer) {
  return resolveCoachActions(answer, snapshot.value, sets.value, reports.value)
}

async function scrollToLatest(): Promise<void> {
  await nextTick()
  if (messageList.value) messageList.value.scrollTop = messageList.value.scrollHeight
}

async function send(question = draft.value, replaceAssistantId = ''): Promise<void> {
  const content = question.trim()
  if (!content || busy.value) return
  if (containsSensitiveCredential(content)) {
    error.value = '检测到疑似敏感凭据。请删除 API Key 或令牌后再发送；该内容不会保存或发送。'
    return
  }
  if (!isAvailable.value) {
    error.value = 'AI 对话尚未配置；本地诊断仍可使用。'
    return
  }
  error.value = ''; failedQuestion.value = ''; draft.value = ''
  const replacing = Boolean(replaceAssistantId)
  const previous = replacing ? messages.value.filter(({ id }) => id !== replaceAssistantId) : messages.value
  const existingLastUser = previous[previous.length - 1]?.role === 'user' && previous[previous.length - 1]?.content === content
  const userMessage: AssistantStoredMessage = existingLastUser ? previous[previous.length - 1]! : {
    id: messageId('user'), role: 'user', content: content.slice(0, 2_000), createdAt: dependencies.now().toISOString(),
  }
  const base = existingLastUser ? previous : [...previous, userMessage]
  const history: AssistantConversationMessage[] = previous.map(({ role, content: messageContent }) => ({ role, content: messageContent }))
  persist(base)
  busy.value = true
  controller = new AbortController()
  await scrollToLatest()
  try {
    const response = await dependencies.client.chat(
      { messages: buildAssistantMessages(snapshot.value, content, history) },
      dependencies.settings.get(), { signal: controller.signal },
    )
    let answer: CoachAnswer
    try {
      answer = parseCoachAnswer(response.content, catalog.value)
      if (!answer.actions.length) answer = { ...answer, actions: buildLocalCoachAnswer(catalog.value).actions }
    } catch {
      answer = buildLocalCoachAnswer(catalog.value)
      error.value = 'AI 返回格式未通过证据校验，已改用本地可验证建议。'
    }
    persist([...base, {
      id: messageId('assistant'), role: 'assistant', content: formatCoachAnswer(answer), answer,
      createdAt: dependencies.now().toISOString(),
    }])
  } catch (cause) {
    const aborted = cause && typeof cause === 'object' && 'code' in cause && cause.code === 'ABORTED'
    failedQuestion.value = content
    if (!aborted) draft.value = content
    error.value = aborted ? '已停止生成，你可以重新发送这个问题。'
      : `${cause instanceof Error ? cause.message : 'AI 暂时没有回应。'} 问题已恢复，可以直接再次发送重试。`
  } finally {
    controller = null; busy.value = false
    await scrollToLatest(); input.value?.focus()
  }
}

function stop(): void { controller?.abort() }

function clearConversation(): void {
  dependencies.conversation.clear(); syncConversationUi(); error.value = ''; failedQuestion.value = ''
}

function createConversation(): void {
  dependencies.conversation.create(); syncConversationUi(); error.value = ''; draft.value = ''; nextTick(() => input.value?.focus())
}

function switchConversation(id: string): void {
  if (dependencies.conversation.switchTo(id)) syncConversationUi()
}

function removeConversation(id: string): void {
  dependencies.conversation.remove(id); syncConversationUi()
}

function deleteMessage(id: string): void {
  dependencies.conversation.deleteMessage(id); syncConversationUi()
}

async function copyMessage(message: AssistantStoredMessage): Promise<void> {
  try { await navigator.clipboard?.writeText(message.content) } catch { /* clipboard feedback still allows manual fallback */ }
  copiedId.value = message.id
  window.setTimeout(() => { if (copiedId.value === message.id) copiedId.value = '' }, 1_500)
}

function regenerate(messageIndex: number, assistantId: string): void {
  const question = [...messages.value.slice(0, messageIndex)].reverse().find(({ role }) => role === 'user')?.content
  if (question) void send(question, assistantId)
}

function refreshPlan(): void {
  plan.value = refreshLearningPlan(plan.value, snapshot.value, sets.value, reports.value, attempts.value, dependencies.now())
  dependencies.plan.save(plan.value)
}

function togglePlan(id: string): void {
  plan.value = togglePlanItem(plan.value, id, dependencies.now())
  dependencies.plan.save(plan.value)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') close()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => { controller?.abort(); window.removeEventListener('keydown', onKeydown) })
</script>

<template>
  <div class="learning-assistant" :class="{ 'learning-assistant--open': open }">
    <section v-if="open" class="assistant-panel" role="dialog" aria-modal="false" aria-label="IELTS Pilot 学习助手">
      <header class="assistant-panel__header">
        <div><span class="assistant-eyebrow">IELTS PILOT / 0.95</span><h2>Learning cockpit</h2><p>读懂进度，解释判断，把下一步变成可完成的练习。</p></div>
        <button ref="closeButton" class="assistant-icon-button" type="button" aria-label="关闭 IELTS Pilot" @click="close">×</button>
      </header>

      <nav class="assistant-view-tabs" role="tablist" aria-label="助手视图">
        <button role="tab" type="button" :aria-selected="view === 'diagnosis'" @click="view = 'diagnosis'">诊断</button>
        <button role="tab" type="button" :aria-selected="view === 'plan'" @click="view = 'plan'">计划 <small>{{ plan.items.filter(({ status }) => status === 'completed').length }}/{{ plan.items.length }}</small></button>
        <button role="tab" type="button" :aria-selected="view === 'chat'" @click="view = 'chat'">对话 <i :data-online="isAvailable" /></button>
      </nav>

      <div class="assistant-panel__body">
        <section v-if="view === 'diagnosis'" class="assistant-diagnosis" role="tabpanel">
          <div class="assistant-diagnosis__summary">
            <span>READING SIGNAL</span><strong>Band {{ snapshot.reading.averageBand.toFixed(1) }}</strong>
            <small>{{ snapshot.reading.attemptCount }} 次练习 · {{ snapshot.reading.focusMinutes }} 分钟</small>
          </div>
          <div class="assistant-overview" aria-label="学习诊断">
            <article v-for="(insight, index) in overview" :key="insight.id" class="assistant-insight">
              <div class="assistant-insight__title"><span>0{{ index + 1 }}</span><h3>{{ insight.title }}</h3><small :data-confidence="insight.confidence">{{ insight.confidence === 'high' ? '高可信' : insight.confidence === 'medium' ? '可参考' : '样本不足' }}</small></div>
              <p>{{ insight.body }}</p>
              <dl><div v-for="evidence in insight.evidence" :key="`${insight.id}-${evidence.label}`"><dt>{{ evidence.label }}</dt><dd>{{ evidence.value }}</dd></div></dl>
            </article>
          </div>
          <div v-if="snapshot.writing.reportCount" class="assistant-writing-signal">
            <span>WRITING TREND</span><strong>Band {{ snapshot.writing.latestBand?.toFixed(1) }}</strong><small>{{ snapshot.writing.trend === 'improving' ? '上升' : snapshot.writing.trend === 'declining' ? '下降' : snapshot.writing.trend === 'stable' ? '平稳' : '样本不足' }} · {{ snapshot.writing.reportCount }} 份报告</small>
            <p v-if="snapshot.writing.repeatedPriorities[0]">重复优先项：{{ snapshot.writing.repeatedPriorities[0].text }}</p>
          </div>
          <CoachAnswerView :answer="localDiagnosis" :catalog="catalog" :actions="localActions" @navigate="close" @show-plan="view = 'plan'" />
        </section>

        <LearningPlanView v-else-if="view === 'plan'" role="tabpanel" :plan="plan" :attempts="attempts" @toggle="togglePlan" @refresh="refreshPlan" @navigate="close" />

        <section v-else class="assistant-conversation" role="tabpanel">
          <div class="assistant-conversation__heading">
            <ConversationHistory :conversations="conversations" :active-id="activeConversationId" @select="switchConversation" @create="createConversation" @remove="removeConversation" />
            <button v-if="messages.length" type="button" @click="clearConversation">清空</button>
          </div>
          <div v-if="availability && !availability.available" class="assistant-unavailable">
            <strong>本地诊断仍可使用</strong><p>AI 对话当前不可用。完成配置后，可结合证据继续追问。</p><RouterLink to="/settings" @click="close">前往设置 →</RouterLink>
          </div>
          <div v-if="messages.length" ref="messageList" class="assistant-messages" aria-live="polite">
            <article v-for="(message, index) in messages" :key="message.id" :class="`assistant-message assistant-message--${message.role}`">
              <header><span>{{ message.role === 'user' ? '你' : 'IELTS Pilot' }}</span><div>
                <button type="button" :aria-label="`复制${message.role === 'user' ? '问题' : '回答'}`" @click="copyMessage(message)">{{ copiedId === message.id ? '已复制' : '复制' }}</button>
                <button v-if="message.role === 'assistant'" type="button" aria-label="重新生成回答" :disabled="busy" @click="regenerate(index, message.id)">重生成</button>
                <button type="button" aria-label="删除消息" @click="deleteMessage(message.id)">删除</button>
              </div></header>
              <CoachAnswerView v-if="message.answer" :answer="message.answer" :catalog="catalog" :actions="resolvedActions(message.answer)" @navigate="close" @show-plan="view = 'plan'" />
              <p v-else>{{ message.content }}</p>
            </article>
          </div>
          <div v-else class="assistant-quick-list"><span>从一个具体问题开始</span><button v-for="(question, index) in quickQuestions" :key="question" type="button" :data-testid="index === 0 ? 'assistant-quick-question' : undefined" :disabled="busy" @click="send(question)">{{ question }} <b aria-hidden="true">↗</b></button></div>
          <div v-if="busy" class="assistant-thinking" aria-live="polite"><i /><span>正在核对本地证据并组织回答</span><button type="button" @click="stop">停止</button></div>
          <p v-if="error" class="assistant-error" role="alert">{{ error }} <button v-if="failedQuestion && !busy" type="button" @click="send(failedQuestion)">重试</button></p>
          <form class="assistant-composer" @submit.prevent="send()"><textarea ref="input" v-model="draft" rows="2" maxlength="2000" placeholder="追问进度、问题或下一步……" aria-label="给 IELTS Pilot 发消息" /><button type="submit" :disabled="busy || !draft.trim()">发送</button></form>
          <p class="assistant-disclaimer">回答基于本地记录，不代表官方 IELTS 评分。API Key 不进入对话历史。</p>
        </section>
      </div>
    </section>
    <button ref="orb" class="assistant-orb" data-testid="assistant-orb" type="button" :aria-expanded="open" :aria-label="open ? '关闭 IELTS Pilot' : '打开 IELTS Pilot'" @click="toggle"><span class="assistant-orb__mark" aria-hidden="true">P</span><span class="assistant-orb__label"><b>IELTS</b><small>PILOT</small></span></button>
  </div>
</template>
