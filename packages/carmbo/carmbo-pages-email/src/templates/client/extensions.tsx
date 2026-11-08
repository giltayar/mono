import {Editor, mergeAttributes, type Extensions, type JSONContent} from '@tiptap/core'
import {cloneElement, isValidElement} from 'react'
import {composeReactEmail, EmailNode} from '@react-email/editor/core'
import {Container, StarterKit} from '@react-email/editor/extensions'
import {EmailTheming} from '@react-email/editor/plugins'
import {protectTemplateTokens} from '../tokens.ts'
import type {TemplateLanguage} from '../schema.ts'

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
      children: props.node.attrs?.contentStyle ? (
        <div data-template-content="" style={inlineStyle(props.node.attrs.contentStyle)}>
          {props.children}
        </div>
      ) : (
        props.children
      ),
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
    return (
      <img
        src={node.attrs?.src}
        alt={node.attrs?.alt}
        width={node.attrs?.width}
        height={node.attrs?.height}
        style={{...style, ...inlineStyle(node.attrs?.style), maxWidth: '100%'}}
      />
    )
  },
})

function inlineStyle(value: string | undefined): Record<string, string> {
  const style = document.createElement('span').style
  style.cssText = value ?? ''
  return Object.fromEntries(
    Array.from(style).map((property) => [
      property.startsWith('--')
        ? property
        : property.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase()),
      style.getPropertyValue(property),
    ]),
  )
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
            children: (
              <div lang={language} dir={direction} style={{direction, textAlign: 'start'}}>
                {props.children}
              </div>
            ),
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

export async function exportEmail(
  content: JSONContent,
  language: TemplateLanguage,
): Promise<string> {
  const protectedContent = protectTemplateTokens(content)
  const snapshot = new Editor({
    element: document.createElement('div'),
    extensions: editorExtensions(language),
    content: protectedContent.document,
    editable: false,
  })
  try {
    const {html} = await composeReactEmail({editor: snapshot, pretty: false})
    return protectedContent.restore(html)
  } finally {
    snapshot.destroy()
  }
}
