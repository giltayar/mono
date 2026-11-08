import type {JSONContent} from '@tiptap/core'

type Token = {start: number; end: number; source: string}

function tokens(source: string): Token[] {
  const result: Token[] = []
  for (let start = source.indexOf('{{'); start >= 0; start = source.indexOf('{{', start)) {
    const braces = source.startsWith('{{{{', start) ? 4 : source.startsWith('{{{', start) ? 3 : 2
    const comment = source.startsWith('{{!--', start)
    const closing = comment ? '--}}' : '}'.repeat(braces)
    let quote = ''
    let end = start + braces
    for (; end < source.length; end++) {
      const char = source[end]
      if (!quote && source.startsWith(closing, end)) break
      if (comment) continue
      if (char === '\\' && quote) {
        end++
        continue
      }
      if (quote === char) quote = ''
      else if (!quote && (char === '"' || char === "'")) quote = char
    }
    if (end === source.length) break
    end += closing.length
    result.push({start, end, source: source.slice(start, end)})
    start = end
  }
  return result
}

// React escapes text and attributes. Protect only template syntax, never decode arbitrary HTML.
export function protectTemplateTokens(document: JSONContent): {
  document: JSONContent
  restore: (html: string) => string
} {
  const replacements = new Map<string, string>()
  const prefix = `CARMBOTEMPLATE${crypto.randomUUID().replaceAll('-', '')}TOKEN`
  function protect(source: string): string {
    let result = ''
    let last = 0
    for (const token of tokens(source)) {
      const key = `${prefix}${replacements.size}END`
      replacements.set(key, token.source)
      result += source.slice(last, token.start) + key
      last = token.end
    }
    return result + source.slice(last)
  }
  function protectAttributes(value: unknown): unknown {
    if (typeof value === 'string') return protect(value)
    if (Array.isArray(value)) return value.map(protectAttributes)
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, protectAttributes(item)]),
      )
    }
    return value
  }
  function visit(node: JSONContent): JSONContent {
    const copy = structuredClone(node)
    if (copy.attrs) {
      copy.attrs = Object.fromEntries(
        Object.entries(copy.attrs).map(([key, value]) => [key, protectAttributes(value)]),
      )
    }
    if (copy.marks)
      copy.marks = copy.marks.map((mark) => ({
        ...mark,
        attrs:
          mark.attrs &&
          Object.fromEntries(
            Object.entries(mark.attrs).map(([key, value]) => [key, protectAttributes(value)]),
          ),
      }))
    if (copy.text) copy.text = protect(copy.text)
    if (node.content) {
      const content: JSONContent[] = []
      for (let i = 0; i < node.content.length;) {
        const child = node.content[i]
        if (child.type !== 'text') {
          content.push(visit(child))
          i++
          continue
        }
        const run: JSONContent[] = []
        while (i < node.content.length && node.content[i].type === 'text')
          run.push(node.content[i++])
        const combined = run.map((item) => item.text ?? '').join('')
        const ranges = tokens(combined)
        let offset = 0
        let consumed = 0
        for (const item of run) {
          const end = offset + (item.text?.length ?? 0)
          let start = Math.max(offset, consumed)
          for (const token of ranges.filter(
            (token) => token.start >= offset && token.start < end,
          )) {
            if (start < token.start)
              content.push(visit({...item, text: combined.slice(start, token.start)}))
            content.push(visit({...item, text: token.source}))
            consumed = token.end
            start = token.end
          }
          if (start < end) content.push(visit({...item, text: combined.slice(start, end)}))
          offset = end
        }
      }
      copy.content = content
    }
    return copy
  }
  return {
    document: visit(document),
    restore: (html) =>
      html.replace(new RegExp(`${prefix}\\d+END`, 'g'), (key) => replacements.get(key)!),
  }
}
