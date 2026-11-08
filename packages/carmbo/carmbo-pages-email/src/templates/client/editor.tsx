import {useEffect, useState, type ReactElement} from 'react'
import {createRoot, type Root} from 'react-dom/client'
import type {Editor, JSONContent} from '@tiptap/core'
import {EditorContent, EditorContext, useEditor} from '@tiptap/react'
import {editorExtensions} from '../editor-extensions.ts'
import {labelsFor} from '../labels.ts'
import type {TemplateLanguage} from '../schema.ts'
import {EditorControls} from './controls.tsx'
import {EditorInspector} from './inspector.tsx'
import '@react-email/editor/themes/default.css'
import './style.css'

// The only client-side code of the template page: the rest is server-rendered htmx.

declare global {
  interface Window {
    // Called synchronously by `hx-vals` when htmx builds a request.
    templateEditorDocument: () => string
  }
}

const editors = new Map<HTMLElement, Editor>()

window.templateEditorDocument = () => {
  const editor = [...editors].find(([element]) => element.isConnected)?.[1]

  if (!editor) throw new Error('The email template editor is not ready')

  return JSON.stringify(editor.getJSON())
}

function TemplateEditor({
  element,
  initialDocument,
  initialLanguage,
  readOnly,
}: {
  element: HTMLElement
  initialDocument: JSONContent
  initialLanguage: TemplateLanguage
  readOnly: boolean
}): ReactElement {
  const t = labelsFor(document.documentElement.lang)
  const [language, setLanguage] = useState(initialLanguage)
  const [error, setError] = useState('')
  const editor = useEditor({
    extensions: editorExtensions(initialLanguage),
    content: initialDocument,
    editable: !readOnly,
    onUpdate: () => {
      setError('')
      element.dispatchEvent(new Event('template-changed', {bubbles: true}))
    },
    editorProps: {
      attributes: {role: 'textbox', 'aria-label': t.editor, 'aria-multiline': 'true'},
      handleDOMEvents: {
        paste: (_view, event) => {
          if (!event.clipboardData?.files.length) return false
          event.preventDefault()
          setError(t.fileUnsupported)
          return true
        },
        drop: (_view, event) => {
          if (!event.dataTransfer?.files.length) return false
          event.preventDefault()
          setError(t.fileUnsupported)
          return true
        },
      },
    },
  })
  useEffect(() => {
    if (!editor) return
    editors.set(element, editor)
    document
      .querySelectorAll<HTMLButtonElement>('button[data-editor-required]')
      .forEach((button) => {
        button.disabled = false
      })
    return () => {
      editors.delete(element)
    }
  }, [editor, element])
  useEffect(() => {
    const select = element.closest('form')?.querySelector<HTMLSelectElement>('[name=language]')
    if (!select) return

    const change = () => setLanguage(select.value === 'he' ? 'he' : 'en')
    select.addEventListener('change', change)

    return () => select.removeEventListener('change', change)
  }, [element])

  return (
    <>
      {error && (
        <p className="alert alert-danger" role="alert">
          {error}
        </p>
      )}
      <EditorContext.Provider value={{editor}}>
        {editor && !readOnly && (
          <EditorControls editor={editor} t={t} onError={setError} disabled={false} />
        )}
        <div className="template-editor-layout">
          <div className="template-content" dir={language === 'he' ? 'rtl' : 'ltr'}>
            <EditorContent editor={editor} />
          </div>
          {editor && !readOnly && <EditorInspector editor={editor} t={t} onError={setError} />}
        </div>
      </EditorContext.Provider>
    </>
  )
}

const roots = new Map<HTMLElement, Root>()

function mount(): void {
  document.querySelectorAll<HTMLElement>('[data-template-editor]').forEach((element) => {
    if (roots.has(element)) return
    const root = createRoot(element, {
      onUncaughtError: (error) => {
        console.error('email-template-editor-failed', error)
        element.textContent = labelsFor(document.documentElement.lang).loadingError
        element.setAttribute('role', 'alert')
      },
    })
    roots.set(element, root)
    root.render(
      <TemplateEditor
        element={element}
        initialDocument={JSON.parse(element.dataset.document!)}
        initialLanguage={element.dataset.language === 'he' ? 'he' : 'en'}
        readOnly={element.dataset.readonly === 'true'}
      />,
    )
  })
}

document.addEventListener('htmx:beforeCleanupElement', (event) => {
  const target = event.target
  if (!(target instanceof Element)) return
  for (const [element, root] of roots) {
    if (target === element || target.contains(element)) {
      root.unmount()
      roots.delete(element)
    }
  }
})
document.addEventListener('htmx:load', mount)
mount()
