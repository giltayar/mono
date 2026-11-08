import Handlebars from 'handlebars'
import {parse, type DefaultTreeAdapterMap} from 'parse5'
import {z} from 'zod'
import {TemplateSchema, type Template} from './schema.ts'
import {isSafeUrl} from './urls.ts'

export class TemplateError extends Error {
  readonly code: 'notFound' | 'archived' | 'invalidTemplate' | 'unsafeHtml' | 'sendFailed'

  constructor(code: TemplateError['code'], options: ErrorOptions | undefined) {
    super(code, options)
    this.name = 'TemplateError'
    this.code = code
  }
}

const handlebars = Handlebars.create()
const helpers = new Set(['if', 'unless', 'each', 'with', 'lookup', 'log'])

export function validateTemplates(template: Template): void {
  for (const source of [template.subject, template.text, template.html]) {
    try {
      const ast = handlebars.parse(source)
      function visit(value: unknown): void {
        if (!value || typeof value !== 'object') return
        if (Array.isArray(value)) {
          value.forEach(visit)
          return
        }
        const node = value as Record<string, unknown>
        if (
          node.type === 'PartialStatement' ||
          node.type === 'PartialBlockStatement' ||
          node.type === 'Decorator' ||
          node.type === 'DecoratorBlock'
        ) {
          throw new Error('Partials and decorators are not supported')
        }
        if (
          node.type === 'PathExpression' &&
          Array.isArray(node.parts) &&
          node.parts.some((part) =>
            ['__proto__', 'prototype', 'constructor'].includes(String(part)),
          )
        ) {
          throw new Error('Prototype paths are not supported')
        }
        if (
          (node.type === 'MustacheStatement' ||
            node.type === 'BlockStatement' ||
            node.type === 'SubExpression') &&
          Array.isArray(node.params) &&
          node.params.length
        ) {
          const path = node.path as {original: string}
          if (!helpers.has(path.original)) throw new Error('Unknown helper')
        }
        Object.values(node).forEach(visit)
      }
      visit(ast)
    } catch (cause) {
      throw new TemplateError('invalidTemplate', {cause})
    }
  }
}

export function validateRenderedHtml(html: string): void {
  const forbidden = new Set([
    'script',
    'iframe',
    'object',
    'embed',
    'form',
    'input',
    'svg',
    'math',
    'base',
  ])
  function visit(node: DefaultTreeAdapterMap['node']): void {
    if ('tagName' in node) {
      if (forbidden.has(node.tagName)) throw new TemplateError('unsafeHtml', undefined)
      for (const {name, value} of node.attrs) {
        if (
          name.startsWith('on') ||
          name === 'srcdoc' ||
          (node.tagName === 'meta' && name === 'http-equiv' && value.toLowerCase() === 'refresh') ||
          (['href', 'src', 'background', 'action', 'poster', 'xlink:href'].includes(name) &&
            !isSafeUrl(value, name !== 'href')) ||
          name === 'srcset'
        ) {
          throw new TemplateError('unsafeHtml', undefined)
        }
      }
    }
    if ('childNodes' in node) node.childNodes.forEach(visit)
  }
  visit(parse(html))
}

export function renderTemplate(input: Template): {subject: string; text: string; html: string} {
  const template = TemplateSchema.parse(input)
  validateTemplates(template)
  try {
    const render = (source: string, noEscape: boolean) =>
      handlebars.compile(source, {noEscape})(template.previewValues, {
        allowProtoMethodsByDefault: false,
        allowProtoPropertiesByDefault: false,
        // Avoid printing preview data through the built-in logging helper.
        helpers: {log: () => ''},
      })
    const result = {
      subject: render(template.subject, true),
      text: render(template.text, true),
      html: render(template.html, false),
    }
    z.string()
      .trim()
      .min(1)
      .max(1000)
      .regex(/^[^\r\n]*$/)
      .parse(result.subject)
    validateRenderedHtml(result.html)
    return result
  } catch (cause) {
    if (cause instanceof TemplateError) throw cause
    throw new TemplateError('invalidTemplate', {cause})
  }
}
