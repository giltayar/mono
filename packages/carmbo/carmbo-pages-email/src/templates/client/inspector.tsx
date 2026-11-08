import {useCallback, useEffect, useState, type ReactElement} from 'react'
import type {Editor} from '@tiptap/core'
import {useEditorState} from '@tiptap/react'
import {useEditorFocusScope} from '@react-email/editor/ui'
import {setCurrentTheme, useEmailTheming} from '@react-email/editor/plugins'
import type {Labels} from '../view.ts'

const textProperties = ['color', 'fontSize', 'backgroundColor'] as const
const borderProperties = ['borderColor', 'borderWidth', 'borderRadius'] as const
const paragraphProperties = [
  ...textProperties,
  ...borderProperties,
  'paddingLeft',
  'paddingRight',
  'marginLeft',
  'marginRight',
] as const
const containerProperties = [
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'marginLeft',
  'marginRight',
  'marginTop',
  'backgroundColor',
  ...borderProperties,
] as const
type Property = (typeof paragraphProperties)[number] | (typeof containerProperties)[number]
type Target = {mode: 'span' | 'paragraph' | 'container'; position: number}
const sections: {
  name: keyof Labels['inspectorSections']
  properties: readonly Property[]
}[] = [
  {name: 'text', properties: ['color', 'fontSize']},
  {name: 'padding', properties: ['paddingLeft', 'paddingRight', 'paddingTop']},
  {name: 'margin', properties: ['marginLeft', 'marginRight', 'marginTop']},
  {name: 'border', properties: borderProperties},
  {name: 'background', properties: ['backgroundColor']},
]

function targetFor(editor: Editor, containerMode: boolean): Target {
  const {selection, doc} = editor.state
  if (!containerMode && editor.isFocused) {
    if (!selection.empty && doc.textBetween(selection.from, selection.to).length)
      return {mode: 'span', position: selection.from}
    for (let depth = selection.$from.depth; depth > 0; depth--) {
      if (selection.$from.node(depth).isTextblock)
        return {mode: 'paragraph', position: selection.$from.before(depth)}
    }
  }
  for (let depth = selection.$from.depth; depth > 0; depth--) {
    if (selection.$from.node(depth).type.name === 'container')
      return {mode: 'container', position: selection.$from.before(depth)}
  }
  let position = -1
  doc.descendants((node, pos) => {
    if (position < 0 && node.type.name === 'container') position = pos
    return position < 0
  })
  if (position < 0) throw new Error('Email document has no content container')
  return {mode: 'container', position}
}

function elementFor(editor: Editor, target: Target): HTMLElement {
  const node =
    target.mode === 'span'
      ? editor.view.domAtPos(Math.min(target.position + 1, editor.state.selection.to)).node
      : editor.view.nodeDOM(target.position)
  const element = node instanceof HTMLElement ? node : node?.parentElement
  if (!element) throw new Error('Inspector target has no rendered element')
  return element
}

function colorValue(element: HTMLElement, property: Property): string {
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    const color = getComputedStyle(current)[property]
    if (color === 'transparent' || color === 'rgba(0, 0, 0, 0)') continue
    const components = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (components)
      return `#${components
        .slice(1, 4)
        .map((part) => Number(part).toString(16).padStart(2, '0'))
        .join('')}`
  }
  return '#ffffff'
}

function changeStyle(style: string | undefined, property: Property, value: string): string {
  const declaration = document.createElement('span').style
  declaration.cssText = style ?? ''
  declaration[property] = value
  if (property === 'borderWidth') {
    declaration.borderStyle = value && Number.parseFloat(value) > 0 ? 'solid' : ''
  }
  return declaration.cssText
}

function applyStyle(editor: Editor, target: Target, property: Property, value: string): void {
  const {doc, selection, schema, tr} = editor.state
  if (target.mode === 'span') {
    // Merge each run independently so existing colors, links and formatting survive mixed selections.
    const type = schema.marks.preservedStyle
    doc.nodesBetween(selection.from, selection.to, (node, position) => {
      if (!node.isText) return
      const current = type.isInSet(node.marks)
      const style = changeStyle(current?.attrs.style, property, value)
      const from = Math.max(position, selection.from)
      const to = Math.min(position + node.nodeSize, selection.to)
      if (style) tr.addMark(from, to, type.create({style}))
      else tr.removeMark(from, to, type)
    })
  } else {
    const node = doc.nodeAt(target.position)
    if (!node) throw new Error('Inspector target no longer exists')
    const attribute = target.mode === 'container' ? 'contentStyle' : 'style'
    tr.setNodeMarkup(target.position, undefined, {
      ...node.attrs,
      [attribute]: changeStyle(node.attrs[attribute], property, value),
    })
  }
  editor.view.dispatch(tr)
}

export function EditorInspector({
  editor,
  t,
  onError,
}: {
  editor: Editor
  t: Labels
  onError: (message: string) => void
}): ReactElement {
  const [containerMode, setContainerMode] = useState(true)
  const {registerScope, unregisterScope} = useEditorFocusScope()
  const focusRef = useCallback(
    (element: HTMLElement | null) => {
      if (!element) return
      registerScope(element)
      return () => unregisterScope(element)
    },
    [registerScope, unregisterScope],
  )
  useEditorState({editor, selector: ({transactionNumber}) => transactionNumber})
  const theming = useEmailTheming(editor)
  useEffect(() => {
    const dom = editor.view.dom
    const activate = () => setContainerMode(false)
    const select = () => {
      if (!editor.state.selection.empty) activate()
    }
    const pointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return
      if (
        event.target.closest(
          '.template-inspector, .template-toolbar, .template-menu, .template-popover',
        )
      )
        return
      if (editor.view.dom.contains(event.target)) {
        const position = editor.state.doc.resolve(editor.view.posAtDOM(event.target, 0))
        let paragraph = false
        for (let depth = position.depth; depth > 0; depth--)
          paragraph ||= position.node(depth).isTextblock
        setContainerMode(!paragraph)
      } else setContainerMode(true)
    }
    document.addEventListener('pointerdown', pointerDown, true)
    dom.addEventListener('keydown', activate)
    editor.on('selectionUpdate', select)
    return () => {
      document.removeEventListener('pointerdown', pointerDown, true)
      dom.removeEventListener('keydown', activate)
      editor.off('selectionUpdate', select)
    }
  }, [editor])
  if (!theming) throw new Error('Inspector requires email theming')
  const target = targetFor(editor, containerMode)
  const element = elementFor(editor, target)
  const styles = getComputedStyle(element)
  const properties: readonly Property[] =
    target.mode === 'span'
      ? textProperties
      : target.mode === 'paragraph'
        ? paragraphProperties
        : containerProperties

  function change(property: Property, value: string): void {
    try {
      applyStyle(editor, target, property, value)
    } catch (cause) {
      console.error('email-template-style-failed', {
        name: cause instanceof Error ? cause.name : 'unknown',
      })
      onError(t.unexpected)
    }
  }

  return (
    <aside ref={focusRef} className="template-inspector" aria-label={t.inspector}>
      <label className="d-grid gap-2 mb-3">
        {t.theme}
        <select
          className="form-select form-select-sm"
          value={theming.theme}
          onChange={(event) =>
            setCurrentTheme(editor, event.target.value === 'minimal' ? 'minimal' : 'basic')
          }>
          <option value="basic">{t.basic}</option>
          <option value="minimal">{t.minimal}</option>
        </select>
      </label>
      <h6 data-inspector-mode={target.mode}>{t.inspectorModes[target.mode]}</h6>
      <div className="template-style-sections">
        {sections.map((section) => {
          const fields = section.properties.filter((property) => properties.includes(property))
          if (!fields.length) return null
          return (
            <fieldset key={section.name} className="template-style-section">
              <legend>{t.inspectorSections[section.name]}</legend>
              <div className="template-style-fields">
                {fields.map((property) => {
                  const color = property === 'color' || property.endsWith('Color')
                  const number = Number.parseFloat(styles[property])
                  return (
                    <label key={property} className="template-style-field">
                      <span>{t.inspectorFields[property]}</span>
                      <input
                        aria-label={t.styles[property]}
                        type={color ? 'color' : 'number'}
                        className={
                          color ? 'form-control form-control-color' : 'form-control form-control-sm'
                        }
                        dir="ltr"
                        step="1"
                        min={
                          property.startsWith('margin') || color
                            ? undefined
                            : property === 'fontSize'
                              ? 1
                              : 0
                        }
                        value={
                          color
                            ? colorValue(element, property)
                            : Number.isFinite(number)
                              ? number
                              : ''
                        }
                        onChange={(event) => {
                          if (!event.currentTarget.validity.valid) {
                            event.currentTarget.reportValidity()
                            return
                          }
                          const value = event.currentTarget.value
                          change(property, color || !value ? value : `${value}px`)
                        }}
                      />
                    </label>
                  )
                })}
              </div>
            </fieldset>
          )
        })}
      </div>
    </aside>
  )
}
