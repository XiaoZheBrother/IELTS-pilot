import { flushPromises, mount } from '@vue/test-utils'
import WritingStudioView from '../../src/views/WritingStudioView.vue'
import { WRITING_VIEW_KEY, type WritingViewDependencies } from '../../src/platform/writingViewDependencies'
import { createWritingRepository } from '../../src/storage/writingRepository'
import { writingTasks } from '../../src/data/writingTasks'

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return { get length() { return values.size }, clear: () => values.clear(), getItem: (key) => values.get(key) ?? null, key: (index) => [...values.keys()][index] ?? null, removeItem: (key) => values.delete(key), setItem: (key, value) => values.set(key, value) }
}

const modelContent = JSON.stringify({
  summary: 'A balanced and clearly organised response.',
  criteria: [
    { criterion: 'task-response', band: 7, rationale: 'Both views and a position are developed.' },
    { criterion: 'coherence-cohesion', band: 6.5, rationale: 'Paragraphing is logical and linking is controlled.' },
    { criterion: 'lexical-resource', band: 7, rationale: 'Vocabulary is varied and mostly precise.' },
    { criterion: 'grammatical-range-accuracy', band: 7.5, rationale: 'A wide range is used with strong accuracy.' },
  ],
  strengths: ['Clear position', 'Relevant support', 'Accurate sentences'],
  priorities: ['Deepen one example', 'Reduce repetition', 'Sharpen the conclusion'],
  evidence: [{ criterion: 'task-response', quote: 'The best policy is consequently a balanced one.', observation: 'This is a direct thesis.', revision: 'Preview both policy dimensions here.' }],
})

function setup(overrides: Partial<WritingViewDependencies> = {}) {
  const repository = createWritingRepository(memoryStorage())
  const navigate = vi.fn(async () => {})
  const client = {
    checkAvailability: vi.fn(async () => ({ available: true as const, mode: 'gateway' as const, model: 'demo-model' })),
    evaluate: vi.fn(async () => ({ content: modelContent, model: 'demo-model', requestId: 'req-demo' })),
  }
  const dependencies: WritingViewDependencies = {
    repository, client, desktop: false, now: () => new Date('2026-08-12T08:00:00.000Z'),
    createId: () => 'writing-demo-report', navigate, ...overrides,
  }
  const wrapper = mount(WritingStudioView, { global: { provide: { [WRITING_VIEW_KEY as symbol]: dependencies }, stubs: { RouterLink: true } } })
  return { wrapper, dependencies, repository, client, navigate }
}

describe('WritingStudioView', () => {
  it('switches tasks, loads a demonstration essay and autosaves the draft with word count', async () => {
    const { wrapper, repository } = setup()
    await flushPromises()
    expect(wrapper.text()).toContain('AI 写作工作室')
    await wrapper.get('[data-testid="writing-task-2"]').trigger('click')
    await wrapper.get('[data-testid="load-demo-essay"]').trigger('click')
    expect(wrapper.get('[data-testid="writing-editor"]').element).toHaveProperty('value', writingTasks[1]!.demoEssay)
    expect(Number(wrapper.get('[data-testid="writing-word-count"]').text())).toBeGreaterThanOrEqual(250)
    expect(repository.getDraft(writingTasks[1]!.id)?.essay).toBe(writingTasks[1]!.demoEssay)
  })

  it('requires explicit send consent, validates model output, saves the report and navigates', async () => {
    const { wrapper, repository, client, navigate } = setup()
    await wrapper.get('[data-testid="writing-task-2"]').trigger('click')
    await wrapper.get('[data-testid="load-demo-essay"]').trigger('click')
    await wrapper.get('[data-testid="request-writing-assessment"]').trigger('click')
    expect(wrapper.get('[data-testid="writing-consent-dialog"]').text()).toContain('仅发送题目与作文正文')
    expect(client.evaluate).not.toHaveBeenCalled()
    await wrapper.get('[data-testid="confirm-writing-assessment"]').trigger('click')
    await flushPromises()
    expect(client.evaluate).toHaveBeenCalledTimes(1)
    expect(repository.getReport('writing-demo-report')).toMatchObject({ overallBand: 7, model: 'demo-model', promptVersion: 'writing-v1' })
    expect(navigate).toHaveBeenCalledWith('/writing/report/writing-demo-report')
  })

  it('preserves the essay and announces a recoverable service failure', async () => {
    const { wrapper } = setup({ client: { checkAvailability: vi.fn(async () => ({ available: false as const, mode: 'gateway' as const, reason: 'unavailable' as const })), evaluate: vi.fn(async () => { throw new Error('评分服务暂时不可用') }) } })
    await wrapper.get('[data-testid="writing-task-2"]').trigger('click')
    await wrapper.get('[data-testid="load-demo-essay"]').trigger('click')
    await wrapper.get('[data-testid="request-writing-assessment"]').trigger('click')
    await wrapper.get('[data-testid="confirm-writing-assessment"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('评分服务暂时不可用')
    expect((wrapper.get('[data-testid="writing-editor"]').element as HTMLTextAreaElement).value).toBe(writingTasks[1]!.demoEssay)
  })
})
