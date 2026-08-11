import { mount } from '@vue/test-utils'
import QuestionRenderer from '../../src/components/QuestionRenderer.vue'
import type { ReadingQuestion } from '../../src/domain/models'

describe('QuestionRenderer', () => {
  it('renders accessible multiple-choice options and emits the selected key', async () => {
    const question: ReadingQuestion = {
      id: 'choice-1',
      type: 'multiple-choice',
      prompt: 'Choose the best answer.',
      options: [
        { key: 'A', label: 'First answer' },
        { key: 'B', label: 'Second answer' },
      ],
      acceptedAnswers: ['B'],
      explanation: 'B is supported by the passage.',
    }
    const wrapper = mount(QuestionRenderer, { props: { question, modelValue: '' } })

    expect(wrapper.get('fieldset').attributes('aria-labelledby')).toBe('question-choice-1')
    await wrapper.get('input[value="B"]').setValue(true)
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['B'])
  })

  it('shows the word limit for a short answer and emits typed text', async () => {
    const question: ReadingQuestion = {
      id: 'short-1',
      type: 'short-answer',
      prompt: 'Name the material.',
      acceptedAnswers: ['paper'],
      wordLimit: 2,
      explanation: 'The passage says paper.',
    }
    const wrapper = mount(QuestionRenderer, { props: { question, modelValue: '' } })

    expect(wrapper.text()).toContain('不超过 2 个英文单词')
    await wrapper.get('input[type="text"]').setValue('paper')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['paper'])
  })
})
