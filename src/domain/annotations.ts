import type { AnnotationColor, PassageAnnotation } from './models'

export interface CreateAnnotationInput {
  setId: string
  sectionIndex: number
  paragraphIndex: number
  paragraph: string
  startOffset: number
  endOffset: number
  color: AnnotationColor
  note?: string
  now?: () => Date
  createId?: () => string
}

export interface ParagraphSegment {
  text: string
  annotation: PassageAnnotation | null
}

export function validateAnnotationRange(paragraph: string, annotation: PassageAnnotation): boolean {
  return annotation.startOffset >= 0
    && annotation.endOffset > annotation.startOffset
    && annotation.endOffset <= paragraph.length
    && paragraph.slice(annotation.startOffset, annotation.endOffset) === annotation.selectedText
}

export function createPassageAnnotation(input: CreateAnnotationInput): PassageAnnotation {
  const start = Math.min(input.startOffset, input.endOffset)
  const end = Math.max(input.startOffset, input.endOffset)
  const selectedText = input.paragraph.slice(start, end)
  if (!selectedText.trim()) throw new Error('请选择有效文本。')
  const timestamp = (input.now ?? (() => new Date()))().toISOString()
  return {
    id: (input.createId ?? (() => crypto.randomUUID()))(), setId: input.setId,
    sectionIndex: input.sectionIndex, paragraphIndex: input.paragraphIndex,
    startOffset: start, endOffset: end, selectedText, color: input.color,
    note: input.note?.trim() ?? '', createdAt: timestamp, updatedAt: timestamp,
  }
}

export function segmentParagraph(paragraph: string, annotations: PassageAnnotation[]): ParagraphSegment[] {
  const valid = annotations.filter((item) => validateAnnotationRange(paragraph, item)).sort((a, b) => a.startOffset - b.startOffset || a.endOffset - b.endOffset)
  const segments: ParagraphSegment[] = []
  let cursor = 0
  valid.forEach((annotation) => {
    if (annotation.startOffset < cursor) return
    if (annotation.startOffset > cursor) segments.push({ text: paragraph.slice(cursor, annotation.startOffset), annotation: null })
    segments.push({ text: annotation.selectedText, annotation })
    cursor = annotation.endOffset
  })
  if (cursor < paragraph.length) segments.push({ text: paragraph.slice(cursor), annotation: null })
  return segments.length ? segments : [{ text: paragraph, annotation: null }]
}
