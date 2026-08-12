import { createPassageAnnotation, segmentParagraph, validateAnnotationRange } from '../../src/domain/annotations'
import type { PassageAnnotation } from '../../src/domain/models'

const annotation: PassageAnnotation = {
  id: 'a1', setId: 'set-1', sectionIndex: 0, paragraphIndex: 0, startOffset: 5, endOffset: 12,
  selectedText: 'passage', color: 'signal', note: '', createdAt: '2026-08-12T00:00:00.000Z', updatedAt: '2026-08-12T00:00:00.000Z',
}

describe('passage annotations', () => {
  it('validates exact text ranges and rejects stale offsets', () => {
    expect(validateAnnotationRange('Safe passage text.', annotation)).toBe(true)
    expect(validateAnnotationRange('Changed text.', annotation)).toBe(false)
  })

  it('segments a paragraph into plain and marked spans', () => {
    expect(segmentParagraph('Safe passage text.', [annotation])).toEqual([
      { text: 'Safe ', annotation: null }, { text: 'passage', annotation }, { text: ' text.', annotation: null },
    ])
  })

  it('creates normalized annotations and rejects empty selection', () => {
    expect(createPassageAnnotation({ setId: 'set-1', sectionIndex: 0, paragraphIndex: 0, paragraph: 'Safe passage text.', startOffset: 5, endOffset: 12, color: 'sage', note: 'Remember', now: () => new Date('2026-08-12T00:00:00.000Z'), createId: () => 'fixed' })).toMatchObject({ id: 'fixed', selectedText: 'passage', color: 'sage', note: 'Remember' })
    expect(() => createPassageAnnotation({ setId: 'set-1', sectionIndex: 0, paragraphIndex: 0, paragraph: 'Safe passage text.', startOffset: 4, endOffset: 4, color: 'sage' })).toThrow('有效文本')
  })
})
