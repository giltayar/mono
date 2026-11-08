// Keeps Handlebars expressions intact when the editor document is exported to email HTML.
//
// The export renders the document through React (`composeReactEmail`), and React escapes text and
// attribute values. That breaks expressions: `{{lookup this "name"}}` would become
// `{{lookup this &quot;name&quot;}}`, and `https://x/{{pic}}?a=1&b=2` would get `&amp;`.
// So before rendering, every expression is swapped for an alphanumeric placeholder that React
// leaves untouched, and after rendering the placeholders are swapped back for the original text.

import type {JSONContent} from '@tiptap/core'

// An expression's position in a string (`end` is exclusive) and its exact source text.
type Token = {start: number; end: number; source: string}

// Finds the Handlebars expressions in `source`. A scanner rather than a regex, because:
// - `{{x}}`, `{{{raw}}}` and `{{{{raw-block}}}}` close with as many braces as they open with.
// - Comments (`{{!-- … --}}`) end only at `--}}`, so a `}}` inside them does not end them.
// - A `}}` inside a quoted string (`{{lookup this "a}}b"}}`) does not end the expression, and
//   backslash escapes inside quotes are skipped.
// An unterminated expression stops the scan; the rest of the text is left as is.
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

// Returns a copy of `document` with every expression replaced by a placeholder, plus `restore`,
// which puts the original expressions back into the rendered HTML. `document` is not modified.
// Placeholders are `CARMBOTEMPLATE<random uuid>TOKEN<n>END`: letters and digits only, so React does
// not escape them, and the random UUID keeps user text from colliding with them. `restore` replaces
// only those placeholders; it never decodes any other HTML.
export function protectTemplateTokens(document: JSONContent): {
  document: JSONContent
  restore: (html: string) => string
} {
  const replacements = new Map<string, string>()
  const prefix = `CARMBOTEMPLATE${crypto.randomUUID().replaceAll('-', '')}TOKEN`
  // Replaces each expression in a string with a new placeholder, remembering the original.
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
  // Protects every string inside an attribute value, including nested arrays and objects.
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
  // Protects a node's attributes, its marks' attributes, its text and its children.
  //
  // The editor splits text into separate text nodes wherever formatting changes, so bolding part
  // of an expression turns `{{name}}` into `{{na` + bold `me}}`, and no single node contains the
  // whole expression. So each run of adjacent text nodes is joined, its expressions are found in
  // the joined text, and the run is split again: text around an expression keeps its original
  // formatting, while each expression becomes one text node with the formatting of the node where
  // it starts. Formatting inside an expression is dropped so the exported expression stays whole.
  // `consumed` marks the end of the last expression, so its remaining characters in later nodes
  // are not emitted twice.
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
