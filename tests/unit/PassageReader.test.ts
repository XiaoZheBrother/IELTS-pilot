import { mount } from '@vue/test-utils'
import PassageReader from '../../src/components/PassageReader.vue'
import type { PassageAnnotation, PracticeSet, ReaderPreferences } from '../../src/domain/models'

const practiceSet = {
  id: 'set-1', passage: { title: 'A useful passage', deck: 'Deck', sections: [{ heading: 'First', paragraphs: ['Safe passage text.'] }] },
  provenance: { note: 'Original sample.' },
} as PracticeSet
const preferences: ReaderPreferences = { theme: 'paper', fontScale: 1, lineHeight: 1.72, readingWidth: 780, defaultTimedPractice: true }
const annotation: PassageAnnotation = {
  id: 'a1', setId: 'set-1', sectionIndex: 0, paragraphIndex: 0, startOffset: 5, endOffset: 12,
  selectedText: 'passage', color: 'amber', note: 'Review this', createdAt: '2026-08-12T00:00:00.000Z', updatedAt: '2026-08-12T00:00:00.000Z',
}

describe('PassageReader', () => {
  it('renders source-linked highlights and exposes notes for editing or deletion', async () => {
    const wrapper = mount(PassageReader, { props: { practiceSet, annotations: [annotation], preferences } })
    expect(wrapper.get('mark').text()).toBe('passage')
    expect(wrapper.get('mark').attributes('data-color')).toBe('amber')
    await wrapper.get('mark').trigger('click')
    expect(wrapper.text()).toContain('Review this')
    await wrapper.get('[data-testid="delete-annotation"]').trigger('click')
    expect(wrapper.emitted('remove')?.[0]).toEqual(['a1'])
  })
})
