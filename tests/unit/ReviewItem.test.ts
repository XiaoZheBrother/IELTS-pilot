import { mount } from '@vue/test-utils'
import ReviewItem from '../../src/components/ReviewItem.vue'
import { practiceSets } from '../../src/data/practiceSets'
import type { ReadingItemResult } from '../../src/domain/models'

const practiceSet = practiceSets[0]!
const question = practiceSet.questions[0]!
const result: ReadingItemResult = { questionId: question.id, questionType: question.type, isCorrect: false, givenAnswer: ['A'], acceptedAnswers: question.acceptedAnswers, explanation: question.explanation, sourceRef: question.sourceRef }

describe('ReviewItem', () => {
  it('expands the cited source paragraph and explanation', async () => {
    const wrapper = mount(ReviewItem, { props: { index: 0, question, result, practiceSet } })
    expect(wrapper.find('[data-testid="source-excerpt"]').exists()).toBe(false)
    await wrapper.get('button[aria-expanded]').trigger('click')
    expect(wrapper.get('[data-testid="source-excerpt"]').text()).toContain(practiceSet.passage.sections[question.sourceRef.sectionIndex]!.paragraphs[question.sourceRef.paragraphIndex]!.slice(0, 40))
    expect(wrapper.text()).toContain(question.explanation)
  })

  it('toggles a question favorite from review', async () => {
    const wrapper = mount(ReviewItem, { props: { index: 0, question, result, practiceSet } })
    await wrapper.get('[data-testid="favorite-question"]').trigger('click')
    expect(wrapper.emitted('toggle-favorite')?.[0]).toEqual([question.id])
  })
})

