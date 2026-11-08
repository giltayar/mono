// Browser replacement for `hast-util-from-html`, which @react-email/editor uses only to split
// Prism's highlighted HTML into class-annotated text runs. The browser's HTML parser does that
// without bundling parse5 and its entity tables.
type HastNode =
  | {type: 'text'; value: string}
  | {
      type: 'element'
      tagName: string
      properties: {className: string[]}
      children: HastNode[]
    }

export function fromHtml(
  html: string,
  _options?: {fragment?: boolean},
): {type: 'root'; children: HastNode[]} {
  const template = document.createElement('template')
  template.innerHTML = html
  return {type: 'root', children: [...template.content.childNodes].flatMap(toHast)}
}

function toHast(node: Node): HastNode[] {
  if (node instanceof Text) return [{type: 'text', value: node.data}]
  if (!(node instanceof Element)) return []
  return [
    {
      type: 'element',
      tagName: node.localName,
      properties: {className: [...node.classList]},
      children: [...node.childNodes].flatMap(toHast),
    },
  ]
}
