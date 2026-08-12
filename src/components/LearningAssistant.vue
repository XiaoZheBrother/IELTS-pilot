<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  buildAssistantMessages,
  buildCoachOverview,
  buildLearningSnapshot,
  type AssistantConversationMessage,
} from '../domain/learningAssistant'
import type { AssistantAvailability } from '../platform/learningAssistantClient'
import type { AssistantStoredMessage } from '../storage/assistantConversationRepository'
import { containsSensitiveCredential } from '../domain/sensitiveText'
import { createLearningAssistantDependencies, LEARNING_ASSISTANT_KEY } from './learningAssistantDependencies'

const dependencies = inject(LEARNING_ASSISTANT_KEY, null) ?? createLearningAssistantDependencies()
const open = ref(false)
const busy = ref(false)
const error = ref('')
const draft = ref('')
const availability = ref<AssistantAvailability | null>(null)
const messages = ref<AssistantStoredMessage[]>(dependencies.conversation.list())
const orb = ref<HTMLButtonElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
const input = ref<HTMLTextAreaElement | null>(null)

const snapshot = ref(buildLearningSnapshot(
  dependencies.practice.listAttempts(),
  dependencies.practice.listMasteredErrorKeys(),
  dependencies.writing.listReports(),
))
const overview = computed(() => buildCoachOverview(snapshot.value))
const isAvailable = computed(() => availability.value?.available === true)
const quickQuestions = ['分析我最近的学习状态', '我现在最应该练什么？', '帮我制定下一次练习计划']

function messageId(role: 'user' | 'assistant'): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  return `${role}-${dependencies.now().getTime()}-${random}`
}

async function refreshAvailability(): Promise<void> {
  availability.value = await dependencies.client.checkAvailability(dependencies.settings.get())
}

async function toggle(): Promise<void> {
  open.value = !open.value
  error.value = ''
  if (open.value) {
    snapshot.value = buildLearningSnapshot(
      dependencies.practice.listAttempts(),
      dependencies.practice.listMasteredErrorKeys(),
      dependencies.writing.listReports(),
    )
    void refreshAvailability()
    await nextTick()
    closeButton.value?.focus()
  } else {
    orb.value?.focus()
  }
}

function close(): void {
  if (!open.value) return
  open.value = false
  error.value = ''
  nextTick(() => orb.value?.focus())
}

function persist(next: AssistantStoredMessage[]): void {
  messages.value = next.slice(-40)
  dependencies.conversation.save(messages.value)
}

async function send(question = draft.value): Promise<void> {
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

  error.value = ''
  draft.value = ''
  const userMessage: AssistantStoredMessage = {
    id: messageId('user'), role: 'user', content: content.slice(0, 2_000), createdAt: dependencies.now().toISOString(),
  }
  const history: AssistantConversationMessage[] = messages.value.map(({ role, content: messageContent }) => ({ role, content: messageContent }))
  persist([...messages.value, userMessage])
  busy.value = true
  try {
    const response = await dependencies.client.chat(
      { messages: buildAssistantMessages(snapshot.value, content, history) },
      dependencies.settings.get(),
    )
    persist([...messages.value, {
      id: messageId('assistant'), role: 'assistant', content: response.content, createdAt: dependencies.now().toISOString(),
    }])
  } catch (cause) {
    draft.value = content
    error.value = `${cause instanceof Error ? cause.message : 'AI 暂时没有回应。'} 问题已恢复，可以直接再次发送重试。`
  } finally {
    busy.value = false
    await nextTick()
    input.value?.focus()
  }
}

function clearConversation(): void {
  dependencies.conversation.clear()
  messages.value = []
  error.value = ''
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') close()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="learning-assistant" :class="{ 'learning-assistant--open': open }">
    <section v-if="open" class="assistant-panel" role="dialog" aria-label="IELTS Pilot 学习助手">
      <header class="assistant-panel__header">
        <div>
          <span class="assistant-eyebrow">LEARNING COPILOT / MVP</span>
          <h2>IELTS Pilot</h2>
          <p>基于你的本地练习记录，判断状态并给出下一步。</p>
        </div>
        <button ref="closeButton" class="assistant-icon-button" type="button" aria-label="关闭 IELTS Pilot" @click="close">×</button>
      </header>

      <div class="assistant-panel__body">
        <div class="assistant-overview" aria-label="学习诊断">
          <article v-for="(insight, index) in overview" :key="insight.id" class="assistant-insight">
            <div class="assistant-insight__title">
              <span>0{{ index + 1 }}</span>
              <h3>{{ insight.title }}</h3>
              <small :data-confidence="insight.confidence">{{ insight.confidence === 'high' ? '高可信' : insight.confidence === 'medium' ? '可参考' : '样本不足' }}</small>
            </div>
            <p>{{ insight.body }}</p>
            <dl>
              <div v-for="evidence in insight.evidence" :key="`${insight.id}-${evidence.label}`">
                <dt>{{ evidence.label }}</dt><dd>{{ evidence.value }}</dd>
              </div>
            </dl>
          </article>
        </div>

        <div class="assistant-conversation">
          <div class="assistant-conversation__heading">
            <div><span class="assistant-status-dot" :data-online="isAvailable" />AI 对话</div>
            <button v-if="messages.length" type="button" @click="clearConversation">清空记录</button>
          </div>

          <div v-if="availability && !availability.available" class="assistant-unavailable">
            <strong>本地诊断仍可使用</strong>
            <p>AI 对话当前不可用。完成配置后，可结合上面的证据继续追问。</p>
            <RouterLink to="/settings" @click="close">前往设置 →</RouterLink>
          </div>

          <div v-if="messages.length" class="assistant-messages" aria-live="polite">
            <article v-for="message in messages" :key="message.id" :class="`assistant-message assistant-message--${message.role}`">
              <span>{{ message.role === 'user' ? '你' : 'IELTS Pilot' }}</span>
              <p>{{ message.content }}</p>
            </article>
          </div>

          <div v-else class="assistant-quick-list">
            <span>你可以这样问</span>
            <button
              v-for="(question, index) in quickQuestions"
              :key="question"
              type="button"
              :data-testid="index === 0 ? 'assistant-quick-question' : undefined"
              :disabled="busy"
              @click="send(question)"
            >{{ question }} <b aria-hidden="true">↗</b></button>
          </div>

          <p v-if="error" class="assistant-error" role="alert">{{ error }}</p>
          <form class="assistant-composer" @submit.prevent="send()">
            <textarea ref="input" v-model="draft" rows="2" maxlength="2000" placeholder="追问你的进度、问题或下一步……" aria-label="给 IELTS Pilot 发消息" />
            <button type="submit" :disabled="busy || !draft.trim()">{{ busy ? '思考中…' : '发送' }}</button>
          </form>
          <p class="assistant-disclaimer">建议基于你的本地记录生成，不代表官方 IELTS 评分或诊断。</p>
        </div>
      </div>
    </section>

    <button
      ref="orb"
      class="assistant-orb"
      data-testid="assistant-orb"
      type="button"
      :aria-expanded="open"
      :aria-label="open ? '关闭 IELTS Pilot' : '打开 IELTS Pilot'"
      @click="toggle"
    >
      <span class="assistant-orb__mark" aria-hidden="true">P</span>
      <span class="assistant-orb__label"><b>IELTS</b><small>PILOT</small></span>
    </button>
  </div>
</template>
