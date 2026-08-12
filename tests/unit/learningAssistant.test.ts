import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterLink } from 'vue-router'
import LearningAssistant from '../../src/components/LearningAssistant.vue'
import { LEARNING_ASSISTANT_KEY, type LearningAssistantDependencies } from '../../src/components/learningAssistantDependencies'
import type { Attempt } from '../../src/domain/models'

const attempt: Attempt = {
  id: 'demo-attempt', testId: 'set-1', mode: 'practice', answers: { q1: ['B'], q2: ['A'], q3: ['B'], q4: ['A'], q5: ['B'] },
  submittedAt: '2026-08-12T01:00:00.000Z', durationSeconds: 1_200, submissionReason: 'manual',
  score: {
    correct: 2, total: 5, percentage: 40, normalizedRaw40: 16, approximateBand: 5.5, scoringVersion: 'reading-v2',
    items: ['q1', 'q2', 'q3', 'q4', 'q5'].map((questionId, index) => ({
      questionId, questionType: 'matching-headings' as const, isCorrect: index === 1 || index === 3,
      givenAnswer: [index === 1 || index === 3 ? 'A' : 'B'], acceptedAnswers: ['A'], explanation: 'Local.', sourceRef: { sectionIndex: 0, paragraphIndex: 0 },
    })),
  },
}

function dependencies(overrides: Partial<LearningAssistantDependencies> = {}): LearningAssistantDependencies {
  let messages: LearningAssistantDependencies['conversation']['list'] extends () => infer R ? R : never = []
  let storedPlan: ReturnType<LearningAssistantDependencies['plan']['get']> = null
  return {
    practice: {
      listAttempts: () => [attempt],
      listMasteredErrorKeys: () => [],
      listImportedSets: () => [],
    },
    writing: { listReports: () => [] },
    settings: { get: () => ({ endpoint: 'https://api.example.com/v1/chat/completions', model: 'coach-model' }) },
    conversation: {
      list: () => messages,
      save: (value) => { messages = value },
      clear: () => { messages = [] },
      listConversations: () => [],
      activeConversationId: () => 'fixture',
      create: () => ({ id: 'fixture', title: '新对话', createdAt: '2026-08-12T02:00:00.000Z', updatedAt: '2026-08-12T02:00:00.000Z', messages: [] }),
      switchTo: () => true,
      remove: () => undefined,
      deleteMessage: (id) => { messages = messages.filter((message) => message.id !== id) },
    },
    client: {
      checkAvailability: async () => ({ available: true, mode: 'gateway', model: 'coach-model' }),
      chat: async () => ({ content: JSON.stringify({
        schemaVersion: 1,
        conclusion: { text: '先集中练习标题配对，并复盘干扰项。', confidence: 'high', evidenceIds: ['reading.weakest_type'] },
        facts: [{ text: '标题配对当前正确率为 40%。', evidenceIds: ['reading.weakest_type'] }],
        inferences: [], actions: [{ id: 'errors', title: '复盘错题', reason: '处理当前错误', kind: 'errors' }],
      }), model: 'coach-model', requestId: 'assistant-1' }),
      testConnection: async () => ({ ok: true }), saveCredential: async () => undefined, clearCredential: async () => undefined,
    },
    plan: { get: () => storedPlan, save: (value) => { storedPlan = value }, clear: () => { storedPlan = null } },
    now: () => new Date('2026-08-12T02:00:00.000Z'),
    ...overrides,
  }
}

async function mountAssistant(deps = dependencies()) {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/', component: { template: '<main />' } },
    { path: '/settings', component: { template: '<main />' } },
  ] })
  await router.push('/')
  await router.isReady()
  return mount(LearningAssistant, { global: { plugins: [router], provide: { [LEARNING_ASSISTANT_KEY as symbol]: deps }, stubs: { RouterLink } } })
}

async function openChat(wrapper: Awaited<ReturnType<typeof mountAssistant>>): Promise<void> {
  await wrapper.get('[data-testid="assistant-orb"]').trigger('click')
  await new Promise((resolve) => setTimeout(resolve, 0))
  const tab = wrapper.findAll('[role="tab"]').find((item) => item.text().includes('对话'))!
  await tab.trigger('click')
}

describe('LearningAssistant', () => {
  it('opens an accessible dialog with local diagnoses and lightweight evidence', async () => {
    const wrapper = await mountAssistant()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    await wrapper.get('[data-testid="assistant-orb"]').trigger('click')

    expect(wrapper.get('[role="dialog"]').attributes('aria-label')).toBe('IELTS Pilot 学习助手')
    expect(wrapper.text()).toContain('当前状态')
    expect(wrapper.text()).toContain('主要问题')
    expect(wrapper.text()).toContain('提高方向')
    expect(wrapper.text()).toContain('题型正确率')
    expect(wrapper.text()).toContain('40%')
  })

  it('sends an explicit question and persists the reply', async () => {
    const deps = dependencies()
    const wrapper = await mountAssistant(deps)
    await openChat(wrapper)
    await wrapper.get('[data-testid="assistant-quick-question"]').trigger('click')

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(wrapper.text()).toContain('先集中练习标题配对')
    expect(deps.conversation.list()).toHaveLength(2)
  })

  it('keeps local diagnosis available when AI is not configured', async () => {
    const deps = dependencies({ client: { ...dependencies().client, checkAvailability: async () => ({ available: false, mode: 'gateway', reason: 'unavailable' }) } })
    const wrapper = await mountAssistant(deps)
    await openChat(wrapper)

    expect(wrapper.text()).toContain('本地诊断仍可使用')
    expect(wrapper.text()).toContain('前往设置')
  })

  it('closes on Escape', async () => {
    const wrapper = await mountAssistant()
    await wrapper.get('[data-testid="assistant-orb"]').trigger('click')
    await window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('refreshes the local snapshot each time it opens', async () => {
    let attempts: Attempt[] = []
    const deps = dependencies({ practice: { listAttempts: () => attempts, listMasteredErrorKeys: () => [], listImportedSets: () => [] } })
    const wrapper = await mountAssistant(deps)
    await wrapper.get('[data-testid="assistant-orb"]').trigger('click')
    expect(wrapper.text()).toContain('还没有足够的练习记录')
    await wrapper.get('[aria-label="关闭 IELTS Pilot"]').trigger('click')

    attempts = [attempt]
    await wrapper.get('[data-testid="assistant-orb"]').trigger('click')
    expect(wrapper.text()).toContain('已完成 1 次练习')
  })

  it('rejects credential-like input without persisting or sending it', async () => {
    const deps = dependencies()
    let chatCalls = 0
    deps.client.chat = async () => { chatCalls += 1; return { content: '', model: '', requestId: '' } }
    const wrapper = await mountAssistant(deps)
    await openChat(wrapper)
    await wrapper.get('[aria-label="给 IELTS Pilot 发消息"]').setValue('请使用 sk-proj-abcdefghijklmnopqrstuvwxyz123456')
    await wrapper.get('.assistant-composer').trigger('submit')

    expect(wrapper.text()).toContain('疑似敏感凭据')
    expect(deps.conversation.list()).toHaveLength(0)
    expect(chatCalls).toBe(0)
  })

  it('restores a failed question for an explicit retry', async () => {
    const deps = dependencies()
    deps.client.chat = async () => { throw new Error('网络暂时不可用') }
    const wrapper = await mountAssistant(deps)
    await openChat(wrapper)
    await wrapper.get('[data-testid="assistant-quick-question"]').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect((wrapper.get('[aria-label="给 IELTS Pilot 发消息"]').element as HTMLTextAreaElement).value).toBe('分析我最近的学习状态')
    expect(wrapper.text()).toContain('可以直接再次发送重试')
  })
})
