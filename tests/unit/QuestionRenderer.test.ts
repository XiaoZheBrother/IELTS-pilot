import { mount } from '@vue/test-utils'
import QuestionRenderer from '../../src/components/QuestionRenderer.vue'
import type { ReadingQuestion } from '../../src/domain/models'

const sourceRef = { sectionIndex: 0, paragraphIndex: 0 }
const common = { acceptedAnswers: ['A'], explanation: 'Supported by the passage.', sourceRef }

describe('QuestionRenderer', () => {
  it('renders a single-choice question and emits an answer array', async () => {
    const question: ReadingQuestion = { id: 'choice-1', type: 'multiple-choice', prompt: 'Choose the best answer.', options: [{ key: 'A', label: 'First' }, { key: 'B', label: 'Second' }], ...common }
    const wrapper = mount(QuestionRenderer, { props: { question, modelValue: [] } })
    await wrapper.get('input[value="B"]').setValue(true)
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['B']])
  })

  it('renders multi-select checkboxes and respects the selection limit', async () => {
    const question: ReadingQuestion = { id: 'multi-1', type: 'multiple-select', prompt: 'Choose two.', options: [{ key: 'A', label: 'First' }, { key: 'B', label: 'Second' }, { key: 'C', label: 'Third' }], selectLimit: 2, acceptedAnswers: [['A', 'C']], explanation: 'A and C.', sourceRef }
    const wrapper = mount(QuestionRenderer, { props: { question, modelValue: ['A', 'B'] } })
    expect(wrapper.get('input[value="C"]').attributes('disabled')).toBeDefined()
    await wrapper.get('input[value="A"]').setValue(false)
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['B']])
  })

  it.each([
    ['true-false-not-given', 'True'],
    ['yes-no-not-given', 'Yes'],
  ] as const)('renders judgment controls for %s', (type, expected) => {
    const question: ReadingQuestion = { id: `judge-${type}`, type, prompt: 'Judge this statement.', acceptedAnswers: [expected], explanation: 'Evidence.', sourceRef }
    const wrapper = mount(QuestionRenderer, { props: { question, modelValue: [] } })
    expect(wrapper.get('fieldset').text()).toContain(expected)
    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(3)
  })

  it.each([
    ['matching-headings', 'Heading i'],
    ['matching-information', 'Paragraph A'],
    ['matching-features', 'Researcher A'],
    ['matching-sentence-endings', 'ending A'],
    ['summary-word-bank', 'climate'],
  ] as const)('renders a select control for %s', (type, optionLabel) => {
    const question: ReadingQuestion = { id: `select-${type}`, type, prompt: 'Choose a match.', options: [{ key: 'A', label: optionLabel }], acceptedAnswers: ['A'], explanation: 'Evidence.', sourceRef }
    const wrapper = mount(QuestionRenderer, { props: { question, modelValue: [] } })
    expect(wrapper.get('select').text()).toContain(optionLabel)
  })

  it.each([
    ['short-answer', {}],
    ['sentence-completion', { beforeBlank: 'The result was', afterBlank: '.' }],
    ['diagram-label', { diagramDescription: 'A text-only cross-section of the cooling roof.' }],
  ] as const)('renders a text answer for %s', async (type, extra) => {
    const question = { id: `text-${type}`, type, prompt: 'Complete the label.', acceptedAnswers: ['cool'], wordLimit: 2, explanation: 'Evidence.', sourceRef, ...extra } as ReadingQuestion
    const wrapper = mount(QuestionRenderer, { props: { question, modelValue: [] } })
    await wrapper.get('input[type="text"]').setValue('cool')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['cool']])
  })
})

