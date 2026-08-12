import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterLink } from 'vue-router'
import LearningAssistant from '../../src/components/LearningAssistant.vue'
import { LEARNING_ASSISTANT_KEY, type LearningAssistantDependencies } from '../../src/components/learningAssistantDependencies'
import type { Attempt } from '../../src/domain/models'
import type { WritingAssessmentReport } from '../../src/domain/writingAssessment'
import { practiceSets } from '../../src/data/practiceSets'
import { writingTasks } from '../../src/data/writingTasks'

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
      getDraft: () => null,
      getAttempt: () => null,
    },
    writing: { listReports: () => [], getDraft: () => null, getReport: () => null },
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
      exportBackup: () => ({ version: 2, activeConversationId: 'fixture', conversations: [{ id: 'fixture', title: '新对话', createdAt: '2026-08-12T02:00:00.000Z', updatedAt: '2026-08-12T02:00:00.000Z', messages }] }),
      inspectBackup: () => ({ ok: true, conversations: 1, messages: messages.length }),
      importBackup: () => ({ ok: true, conversations: 1, messages: messages.length }),
    },
    client: {
      checkAvailability: async () => ({ available: true, mode: 'gateway', model: 'coach-model' }),
      chat: async () => ({ content: JSON.stringify({
        schemaVersion: 1,
        conclusion: { text: '先集中练习标题配对，并复盘干扰项。', confidence: 'high', evidenceIds: ['reading.weakest_type'] },
        facts: [{ text: '标题配对当前正确率为 40%。', evidenceIds: ['reading.weakest_type'] }],
        inferences: [], actions: [{ id: 'errors', title: '复盘错题', reason: '处理当前错误', kind: 'errors' }],
      }), model: 'coach-model', requestId: 'assistant-1' }),
      chatStream: async (_request, _settings, options) => {
        const response = await dependencies().client.chat({ messages: [] }, { endpoint: '', model: '' })
        options.onDelta(response.content)
        return response
      },
      testConnection: async () => ({ ok: true }), saveCredential: async () => undefined, clearCredential: async () => undefined,
    },
    plan: {
      get: () => storedPlan, save: (value) => { storedPlan = value }, clear: () => { storedPlan = null },
      inspectBackup: () => ({ ok: true, items: storedPlan?.items.length ?? 0 }),
      importBackup: () => ({ ok: true, items: storedPlan?.items.length ?? 0 }),
    },
    now: () => new Date('2026-08-12T02:00:00.000Z'),
    ...overrides,
  }
}

async function mountAssistant(deps = dependencies(), path = '/') {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/', component: { template: '<main />' } },
    { path: '/settings', component: { template: '<main />' } },
    { path: '/practice/:testId', name: 'practice', component: { template: '<main />' } },
    { path: '/writing', name: 'writing', component: { template: '<main />' } },
    { path: '/writing/report/:reportId', name: 'writing-report', component: { template: '<main />' } },
  ] })
  await router.push(path)
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
    const deps = dependencies({ practice: {
      listAttempts: () => attempts, listMasteredErrorKeys: () => [], listImportedSets: () => [],
      getDraft: () => null, getAttempt: () => null,
    } })
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
    deps.client.chatStream = async () => { chatCalls += 1; return { content: '', model: '', requestId: '' } }
    const wrapper = await mountAssistant(deps)
    await openChat(wrapper)
    await wrapper.get('[aria-label="给 IELTS Pilot 发消息"]').setValue('请使用 sk-proj-abcdefghijklmnopqrstuvwxyz123456')
    await wrapper.get('.assistant-composer').trigger('submit')

    expect(wrapper.text()).toContain('疑似敏感凭据')
    expect(deps.conversation.list()).toHaveLength(0)
    expect(chatCalls).toBe(0)
  })

  it('rejects a credential embedded in imported reading material before persistence or egress', async () => {
    const source = practiceSets[0]!
    const sensitiveSet = {
      ...source, id: 'sensitive-import', title: 'Sensitive import', passage: {
        ...source.passage,
        sections: source.passage.sections.map((section, index) => index === 0
          ? { ...section, paragraphs: ['sk-proj-abcdefghijklmnopqrstuvwxyz123456', ...section.paragraphs.slice(1)] }
          : section),
      },
    }
    let chatCalls = 0
    const deps = dependencies({ practice: {
      listAttempts: () => [], listMasteredErrorKeys: () => [], listImportedSets: () => [sensitiveSet],
      getDraft: () => null, getAttempt: () => null,
    } })
    deps.client.chatStream = async () => { chatCalls += 1; return { content: '', model: '', requestId: '' } }
    const wrapper = await mountAssistant(deps, '/practice/sensitive-import')
    await openChat(wrapper)
    await wrapper.get('[data-testid="assistant-page-context"] button').trigger('click')

    expect(wrapper.text()).toContain('当前材料或学习数据含疑似敏感凭据')
    expect(deps.conversation.list()).toHaveLength(0)
    expect(chatCalls).toBe(0)
  })

  it('rejects a credential embedded in a writing draft before persistence or egress', async () => {
    const task = writingTasks[0]!
    let chatCalls = 0
    const deps = dependencies({ writing: {
      listReports: () => [], getReport: () => null,
      getDraft: () => ({ taskId: task.id, essay: 'Draft token: sk-proj-abcdefghijklmnopqrstuvwxyz123456', elapsedSeconds: 30, updatedAt: '2026-08-12T02:00:00.000Z' }),
    } })
    deps.client.chatStream = async () => { chatCalls += 1; return { content: '', model: '', requestId: '' } }
    const wrapper = await mountAssistant(deps, `/writing?task=${task.id}`)
    await openChat(wrapper)
    await wrapper.get('[data-testid="assistant-page-context"] button').trigger('click')

    expect(wrapper.text()).toContain('当前材料或学习数据含疑似敏感凭据')
    expect(deps.conversation.list()).toHaveLength(0)
    expect(chatCalls).toBe(0)
  })

  it('rejects a credential embedded in a writing report before persistence or egress', async () => {
    const report: WritingAssessmentReport = {
      id: 'sensitive-report', taskId: writingTasks[0]!.id, taskType: writingTasks[0]!.type,
      essay: 'Report manuscript sk-proj-abcdefghijklmnopqrstuvwxyz123456', wordCount: 4, overallBand: 6,
      summary: 'Fixture summary.', criteria: [
        { criterion: 'task-response', band: 6, rationale: 'Fixture.' },
        { criterion: 'coherence-cohesion', band: 6, rationale: 'Fixture.' },
        { criterion: 'lexical-resource', band: 6, rationale: 'Fixture.' },
        { criterion: 'grammatical-range-accuracy', band: 6, rationale: 'Fixture.' },
      ], strengths: [], priorities: [], evidence: [], model: 'fixture', promptVersion: 'writing-v1', generatedAt: '2026-08-12T02:00:00.000Z',
    }
    let chatCalls = 0
    const deps = dependencies({ writing: { listReports: () => [report], getDraft: () => null, getReport: () => report } })
    deps.client.chatStream = async () => { chatCalls += 1; return { content: '', model: '', requestId: '' } }
    const wrapper = await mountAssistant(deps, `/writing/report/${report.id}`)
    await openChat(wrapper)
    await wrapper.get('[data-testid="assistant-page-context"] button').trigger('click')

    expect(wrapper.text()).toContain('当前材料或学习数据含疑似敏感凭据')
    expect(deps.conversation.list()).toHaveLength(0)
    expect(chatCalls).toBe(0)
  })

  it('restores a failed question for an explicit retry', async () => {
    const deps = dependencies()
    deps.client.chatStream = async () => { throw new Error('网络暂时不可用') }
    const wrapper = await mountAssistant(deps)
    await openChat(wrapper)
    await wrapper.get('[data-testid="assistant-quick-question"]').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect((wrapper.get('[aria-label="给 IELTS Pilot 发消息"]').element as HTMLTextAreaElement).value).toBe('分析我最近的学习状态')
    expect(wrapper.text()).toContain('可以直接再次发送重试')
  })

  it('records that a plan recommendation was opened', async () => {
    const deps = dependencies()
    const wrapper = await mountAssistant(deps)
    await wrapper.get('[data-testid="assistant-orb"]').trigger('click')
    const planTab = wrapper.findAll('[role="tab"]').find((item) => item.text().includes('计划'))!
    await planTab.trigger('click')
    await wrapper.get('.plan-go').trigger('click')
    expect(deps.plan.get()?.items.some(({ status }) => status === 'started')).toBe(true)
  })

  it('shows real stream deltas, then records prompt and token metadata', async () => {
    const deps = dependencies()
    let finish!: () => void
    deps.client.chatStream = async (_request, _settings, options) => {
      options.onDelta('{"conclusion":{"text":"正在读取本地证据')
      await new Promise<void>((resolve) => { finish = resolve })
      return {
        content: JSON.stringify({
          schemaVersion: 1,
          conclusion: { text: '先补足同题型样本。', confidence: 'high', evidenceIds: ['reading.weakest_type'] },
          facts: [], inferences: [], actions: [],
        }), model: 'stream-model', requestId: 'stream-1', usage: { promptTokens: 80, completionTokens: 20, totalTokens: 100 },
      }
    }
    const wrapper = await mountAssistant(deps)
    await openChat(wrapper)
    await wrapper.get('[data-testid="assistant-quick-question"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('正在读取本地证据')
    expect(wrapper.text()).toContain('实时接收')

    finish()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(wrapper.text()).toContain('assistant-v3')
    expect(wrapper.text()).toContain('100 tokens')
    expect(wrapper.text()).toContain('上下文 2/6 条')
  })

  it('shows a writing summary, evidence deep link, next task and rewrite exercise', async () => {
    const report: WritingAssessmentReport = {
      id: 'report-1', taskId: 'academic-task-2-library-balance', taskType: 'task-2', essay: 'Libraries support learners.', wordCount: 4,
      overallBand: 6, summary: '立场清晰，但例证展开不足。', criteria: [
        { criterion: 'task-response', band: 5.5, rationale: 'Examples need development.' },
        { criterion: 'coherence-cohesion', band: 6, rationale: 'Logical.' },
        { criterion: 'lexical-resource', band: 6.5, rationale: 'Suitable.' },
        { criterion: 'grammatical-range-accuracy', band: 6, rationale: 'Mostly accurate.' },
      ], strengths: [], priorities: ['Develop examples'],
      evidence: [{ criterion: 'task-response', quote: 'Libraries support learners.', observation: 'The claim lacks a concrete example.', revision: 'Libraries support learners by offering quiet study space.' }],
      model: 'fixture', promptVersion: 'writing-v1', generatedAt: '2026-08-12T08:00:00.000Z',
    }
    const wrapper = await mountAssistant(dependencies({ writing: { listReports: () => [report], getDraft: () => null, getReport: () => null } }))
    await wrapper.get('[data-testid="assistant-orb"]').trigger('click')
    expect(wrapper.text()).toContain('立场清晰，但例证展开不足')
    expect(wrapper.text()).toContain('下一篇')
    expect(wrapper.text()).toContain('改写练习')
    expect(wrapper.get('[data-testid="writing-evidence-link"]').attributes('href')).toBe('/writing/report/report-1#evidence-1')
  })

  it('injects the active reading material only when the learner sends a question', async () => {
    const set = practiceSets[0]!
    let requestContent = ''
    const deps = dependencies({
      practice: {
        listAttempts: () => [], listMasteredErrorKeys: () => [], listImportedSets: () => [], getAttempt: () => null,
        getDraft: () => ({
          testId: set.id, answers: { [set.questions[0]!.id]: ['FALSE'] }, currentIndex: 0,
          remainingSeconds: 1_200, updatedAt: '2026-08-12T02:00:00.000Z',
        }),
      },
    })
    deps.client.chatStream = async (request, _settings, options) => {
      requestContent = request.messages.at(-1)?.content ?? ''
      const content = JSON.stringify({
        schemaVersion: 1,
        conclusion: { text: '原文定位句直接支持标准答案。', confidence: 'high', evidenceIds: ['context.reading.answer_key'] },
        facts: [{ text: '当前答案与标准答案不一致。', evidenceIds: ['context.reading.user_answer', 'context.reading.answer_key'] }],
        inferences: [], actions: [],
      })
      options.onDelta(content)
      return { content, model: 'coach-model', requestId: 'context-1' }
    }

    const wrapper = await mountAssistant(deps, `/practice/${set.id}`)
    await openChat(wrapper)
    expect(wrapper.get('[data-testid="assistant-page-context"]').text()).toContain(set.title)
    expect(requestContent).toBe('')

    await wrapper.get('[data-testid="assistant-page-context"] button').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(requestContent).toContain('ActivePageContext')
    expect(requestContent).toContain(set.passage.title)
    expect(requestContent).toContain(set.questions[0]!.explanation)
    expect(deps.conversation.list()[1]?.evidence?.some(({ id }) => id === 'context.reading.answer_key')).toBe(true)
  })
})
