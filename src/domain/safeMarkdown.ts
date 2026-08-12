export interface SafeMarkdownSpan {
  type: 'text' | 'strong' | 'emphasis' | 'code' | 'link'
  text: string
  href?: string
}

export interface SafeMarkdownBlock {
  type: 'heading' | 'paragraph' | 'list' | 'code'
  level?: number
  ordered?: boolean
  spans?: SafeMarkdownSpan[]
  items?: SafeMarkdownSpan[][]
  text?: string
}

function safeHref(value: string): string | undefined {
  const href = value.trim()
  if (href.startsWith('/') && !href.startsWith('//')) return href
  try {
    const url = new URL(href)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined
  } catch { return undefined }
}

function inline(content: string): SafeMarkdownSpan[] {
  const spans: SafeMarkdownSpan[] = []
  const pattern = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\n]+\)|\*[^*\n]+\*)/gu
  let cursor = 0
  for (const match of content.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > cursor) spans.push({ type: 'text', text: content.slice(cursor, index) })
    const token = match[0]
    if (token.startsWith('**')) spans.push({ type: 'strong', text: token.slice(2, -2) })
    else if (token.startsWith('`')) spans.push({ type: 'code', text: token.slice(1, -1) })
    else if (token.startsWith('*')) spans.push({ type: 'emphasis', text: token.slice(1, -1) })
    else {
      const parts = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/u)
      const href = parts?.[2] ? safeHref(parts[2]) : undefined
      spans.push(href ? { type: 'link', text: parts![1]!, href } : { type: 'text', text: parts?.[1] ?? token })
    }
    cursor = index + token.length
  }
  if (cursor < content.length) spans.push({ type: 'text', text: content.slice(cursor) })
  return spans.length ? spans : [{ type: 'text', text: content }]
}

export function parseSafeMarkdown(content: string): SafeMarkdownBlock[] {
  const lines = content.replace(/\r\n?/gu, '\n').slice(0, 12_000).split('\n')
  const blocks: SafeMarkdownBlock[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index] ?? ''
    if (!line.trim()) { index += 1; continue }
    if (line.startsWith('```')) {
      const code: string[] = []
      index += 1
      while (index < lines.length && !lines[index]!.startsWith('```')) { code.push(lines[index]!); index += 1 }
      if (index < lines.length) index += 1
      blocks.push({ type: 'code', text: code.join('\n') })
      continue
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/u)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1]!.length, spans: inline(heading[2]!) })
      index += 1
      continue
    }
    const list = line.match(/^\s*(?:(\d+)\.|([-*]))\s+(.+)$/u)
    if (list) {
      const ordered = Boolean(list[1])
      const items: SafeMarkdownSpan[][] = []
      while (index < lines.length) {
        const item = lines[index]!.match(/^\s*(?:(\d+)\.|([-*]))\s+(.+)$/u)
        if (!item || Boolean(item[1]) !== ordered) break
        items.push(inline(item[3]!))
        index += 1
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }
    const paragraph = [line.trim()]
    index += 1
    while (index < lines.length && lines[index]!.trim()
      && !/^(?:#{1,3}\s+|```|\s*(?:\d+\.|[-*])\s+)/u.test(lines[index]!)) {
      paragraph.push(lines[index]!.trim())
      index += 1
    }
    blocks.push({ type: 'paragraph', spans: inline(paragraph.join(' ')) })
  }
  return blocks
}
