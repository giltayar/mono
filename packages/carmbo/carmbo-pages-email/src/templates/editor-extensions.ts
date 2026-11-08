import {mergeAttributes, type Extensions} from '@tiptap/core'
import {cloneElement, isValidElement} from 'react'
import {html} from 'htm/react'
import {EmailNode} from '@react-email/editor/core'
import {Container, StarterKit} from '@react-email/editor/extensions'
import {EmailTheming} from '@react-email/editor/plugins'
import type {TemplateLanguage} from './schema.ts'

// Shared by the browser editor and the server export, so it is JSX-free (`htm`) and DOM-free.

const ContentContainer = EmailNode.create({
  ...Container.config,
  addAttributes() {
    return {
      contentStyle: {
        default: '',
        parseHTML: (element: HTMLElement) => element.dataset.templateContentStyle ?? '',
        renderHTML: (attributes: Record<string, string>) => ({
          'data-template-content-style': attributes.contentStyle,
        }),
      },
    }
  },
  renderHTML({HTMLAttributes}) {
    return [
      'div',
      mergeAttributes(
        {'data-type': 'container', class: 'node-container'},
        this.options.HTMLAttributes,
        HTMLAttributes,
        {style: HTMLAttributes['data-template-content-style']},
      ),
      0,
    ]
  },
  renderToReactEmail(props) {
    return Container.config.renderToReactEmail({
      ...props,
      children: props.node.attrs?.contentStyle
        ? html`<div data-template-content="" style=${inlineStyle(props.node.attrs.contentStyle)}>
            ${props.children}
          </div>`
        : props.children,
    })
  },
})

const Image = EmailNode.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: {default: ''},
      alt: {default: ''},
      width: {default: '100%'},
      height: {default: null},
      style: {default: ''},
    }
  },
  parseHTML() {
    return [{tag: 'img[src]'}]
  },
  renderHTML({HTMLAttributes}) {
    return ['img', mergeAttributes(HTMLAttributes)]
  },
  renderToReactEmail({node, style}) {
    return html`<img
      src=${node.attrs?.src}
      alt=${node.attrs?.alt}
      width=${node.attrs?.width}
      height=${node.attrs?.height}
      style=${{...style, ...inlineStyle(node.attrs?.style), maxWidth: '100%'}}
    />`
  },
})

export function inlineStyle(value: string | undefined): Record<string, string> {
  const style: Record<string, string> = {}
  for (const declaration of splitDeclarations(value ?? '')) {
    const colon = declaration.indexOf(':')
    if (colon <= 0) continue
    const property = declaration.slice(0, colon).trim().toLowerCase()
    const propertyValue = declaration
      .slice(colon + 1)
      .replace(/\s*!important\s*$/i, '')
      .trim()
    if (!/^-?-?[a-z][a-z0-9-]*$/.test(property) || !propertyValue) continue
    style[
      property.startsWith('--')
        ? property
        : property.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())
    ] = propertyValue
  }
  return style
}

function splitDeclarations(source: string): string[] {
  const declarations: string[] = []
  let depth = 0
  let quote = ''
  let start = 0
  for (let index = 0; index < source.length; index++) {
    const char = source[index]
    if (quote) {
      if (char === '\\') index++
      else if (char === quote) quote = ''
    } else if (char === '"' || char === "'") quote = char
    else if (char === '(') depth++
    else if (char === ')') depth = Math.max(0, depth - 1)
    else if (char === ';' && depth === 0) {
      declarations.push(source.slice(start, index))
      start = index + 1
    }
  }
  declarations.push(source.slice(start))
  return declarations
}

const TemplateDirective = EmailNode.create({
  name: 'templateDirective',
  group: 'block',
  atom: true,
  addAttributes() {
    return {expression: {default: ''}}
  },
  parseHTML() {
    return [{tag: 'div[data-template-expression]'}]
  },
  renderHTML({node}) {
    return [
      'div',
      {'data-template-expression': node.attrs.expression, contenteditable: 'false', dir: 'ltr'},
      node.attrs.expression,
    ]
  },
  renderToReactEmail({node}) {
    return node.attrs?.expression ?? ''
  },
})

export function editorExtensions(language: TemplateLanguage): Extensions {
  const serializer = EmailTheming.options.serializerPlugin
  return [
    StarterKit.configure({
      Container: false,
      Link: {
        openOnClick: false,
        isAllowedUri: (url, context) => url.includes('{{') || context.defaultValidate(url),
      },
    }),
    ContentContainer,
    Image,
    TemplateDirective,
    EmailTheming.configure({
      serializerPlugin: {
        ...serializer,
        BaseTemplate(props) {
          const direction = language === 'he' ? 'rtl' : 'ltr'
          const element = serializer.BaseTemplate({
            ...props,
            children: html`<div
              lang=${language}
              dir=${direction}
              style=${{direction, textAlign: 'start'}}
            >
              ${props.children}
            </div>`,
          })
          if (!isValidElement<{lang: string; dir: string}>(element)) {
            throw new Error('Email theme did not return an HTML element')
          }
          return cloneElement(element, {lang: language, dir: direction})
        },
      },
    }),
  ]
}
