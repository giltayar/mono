import {useEffect, useRef, useState, type ReactElement} from 'react'
import {createRoot, type Root} from 'react-dom/client'
import {EditorContent, EditorContext, useEditor} from '@tiptap/react'
import {z} from 'zod'
import {discoverVariables, type Template} from '../schema.ts'
import type {EditorPage} from '../view.ts'
import {editorExtensions, exportEmail} from './extensions.tsx'
import {EditorControls} from './controls.tsx'
import {EditorInspector} from './inspector.tsx'
import '@react-email/editor/themes/default.css'
import './style.css'

const responseSchema = z.object({
  error: z.string().optional(),
  message: z.string().optional(),
  redirect: z.string().optional(),
  subject: z.string().optional(),
  html: z.string().optional(),
  text: z.string().optional(),
})

class TemplateActionError extends Error {}

const previewRecipientKey = 'carmbo.email-template.preview-recipient'

function TemplateEditor({initial}: {initial: EditorPage}): ReactElement {
  const t = initial.labels
  const [template, setTemplate] = useState(initial.template)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [to, setTo] = useState(() => {
    try {
      return window.localStorage.getItem(previewRecipientKey) ?? ''
    } catch (cause) {
      if (!(cause instanceof DOMException)) throw cause
      console.error('email-template-recipient-storage-failed', {name: cause.name})
      return ''
    }
  })
  const [dialog, setDialog] = useState<'preview' | 'send' | 'html' | undefined>(undefined)
  const [rawHtml, setRawHtml] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const recipientRef = useRef<HTMLInputElement>(null)
  const dialogTrigger = useRef<HTMLButtonElement | null>(null)
  const [preview, setPreview] = useState<
    {subject: string; html: string; text: string} | undefined
  >()
  const [documentText, setDocumentText] = useState(JSON.stringify(initial.template.editorDocument))
  const sending = useRef(false)
  const attempt = useRef<{payload: string; id: string} | undefined>(undefined)
  const mounted = useRef(true)
  const path = `/emails/templates/${initial.number ?? 'new'}`
  const editor = useEditor({
    extensions: editorExtensions(initial.template.language),
    content: initial.template.editorDocument,
    editable: !initial.readOnly,
    onCreate: () => setReady(true),
    onUpdate: ({editor}) => setDocumentText(JSON.stringify(editor.getJSON())),
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
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    editor?.setEditable(!initial.readOnly && !busy)
  }, [editor, initial.readOnly, busy])
  useEffect(() => {
    if (dialog) {
      dialogRef.current?.showModal()
      if (dialog === 'send') recipientRef.current?.focus()
    } else {
      dialogRef.current?.close()
    }
  }, [dialog])

  function openDialog(kind: 'preview' | 'send' | 'html', trigger: HTMLButtonElement): void {
    dialogTrigger.current = trigger
    setError('')
    setMessage('')
    setDialog(kind)
    if (kind === 'preview') {
      setPreview(undefined)
      void act('preview')
    } else if (kind === 'html') {
      setRawHtml('')
      void act('html')
    }
  }

  function closeDialog(): void {
    setError('')
    setDialog(undefined)
  }

  function updateRecipient(value: string): void {
    setTo(value)
    try {
      if (value) window.localStorage.setItem(previewRecipientKey, value)
      else window.localStorage.removeItem(previewRecipientKey)
    } catch (cause) {
      if (!(cause instanceof DOMException)) throw cause
      console.error('email-template-recipient-storage-failed', {name: cause.name})
    }
  }

  function update<K extends keyof Template>(key: K, value: Template[K]): void {
    setTemplate((current) => ({...current, [key]: value}))
  }
  const variables = [
    ...new Set([
      ...discoverVariables([template.subject, template.text, documentText]),
      ...Object.keys(template.previewValues),
    ]),
  ]

  async function act(
    action: 'save' | 'preview' | 'send' | 'archive' | 'restore' | 'html',
  ): Promise<void> {
    if (sending.current || !editor || !ready) return
    sending.current = true
    setBusy(true)
    setError('')
    setMessage('')
    editor.setEditable(false)
    try {
      if (action === 'html') {
        const html = initial.readOnly
          ? template.html
          : await exportEmail(editor.getJSON(), template.language)
        if (mounted.current) setRawHtml(html)
        return
      }
      const archive = action === 'archive' || action === 'restore'
      let payload: unknown
      if (!archive) {
        const editorDocument = editor.getJSON()
        const snapshot = {
          ...template,
          editorDocument,
          html: await exportEmail(editorDocument, template.language),
        }
        if (action === 'send') {
          const serialized = JSON.stringify({template: snapshot, to})
          if (attempt.current?.payload !== serialized) {
            attempt.current = {payload: serialized, id: crypto.randomUUID()}
          }
          payload = {template: snapshot, to, requestId: attempt.current.id}
        } else payload = snapshot
      }
      const url = archive
        ? `${path}?delete-operation=${action === 'archive' ? 'delete' : 'restore'}`
        : action === 'save'
          ? initial.number === undefined
            ? '/emails/templates/'
            : path
          : `${path}/${action === 'send' ? 'send-preview' : 'preview'}`
      const response = await fetch(url, {
        method: archive
          ? 'DELETE'
          : action === 'save' && initial.number !== undefined
            ? 'PUT'
            : 'POST',
        headers: archive ? undefined : {'Content-Type': 'application/json'},
        body: archive ? undefined : JSON.stringify(payload),
      })
      if (response.status === 401) {
        window.location.reload()
        return
      }
      const result = responseSchema.parse(await response.json())
      if (!response.ok) throw new TemplateActionError(result.error ?? t.invalidTemplate)
      if (!mounted.current) return
      if (action === 'save' || archive) {
        const {redirect} = z
          .object({redirect: z.string().regex(/^\/emails\/templates\/\d+$/)})
          .parse(result)
        window.location.assign(redirect)
      } else if (action === 'preview') {
        setPreview(
          z.object({subject: z.string(), html: z.string(), text: z.string()}).parse(result),
        )
      } else if (action === 'send') {
        setMessage(z.object({message: z.string().min(1)}).parse(result).message)
        attempt.current = undefined
        setDialog(undefined)
      }
    } catch (cause) {
      if (mounted.current) {
        if (!(cause instanceof TemplateActionError)) {
          console.error('email-template-action-failed', {
            name: cause instanceof Error ? cause.name : 'unknown',
          })
        }
        setError(cause instanceof TemplateActionError ? cause.message : t.unexpected)
      }
    } finally {
      sending.current = false
      if (mounted.current) {
        setBusy(false)
        editor.setEditable(!initial.readOnly)
      }
    }
  }

  return (
    <div className="email-template">
      {error && !dialog && (
        <p className="alert alert-danger" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="alert alert-success" role="status">
          {message}
        </p>
      )}
      {busy && !dialog && <p role="status">{t.busy}</p>}
      <div className="template-actions col-md-6 mt-3 d-flex justify-content-end">
        <div className="btn-group">
          {!initial.readOnly && (
            <>
              <a className="btn btn-secondary" href={path}>
                {t.discard}
              </a>
              {initial.number !== undefined && (
                <button
                  className="btn btn-danger"
                  disabled={busy || !ready}
                  onClick={() => void act('archive')}>
                  {t.archive}
                </button>
              )}
              <button
                className="btn btn-primary"
                disabled={busy || !ready}
                onClick={() => void act('save')}>
                {t.save}
              </button>
            </>
          )}
          {initial.archived && !initial.historical && (
            <button
              className="btn btn-danger"
              disabled={busy || !ready}
              onClick={() => void act('restore')}>
              {t.restore}
            </button>
          )}
        </div>
      </div>
      <fieldset disabled={busy || initial.readOnly}>
        <div className="template-fields card col-md-6 mt-3">
          <div className="card-body d-grid gap-3">
            <div className="form-floating">
              <input
                id="template-name"
                className="form-control"
                placeholder=" "
                value={template.name}
                onChange={(e) => update('name', e.target.value)}
              />
              <label htmlFor="template-name">{t.name}</label>
            </div>
            <div className="form-floating">
              <textarea
                id="template-description"
                className="form-control template-description"
                placeholder=" "
                value={template.description}
                onChange={(e) => update('description', e.target.value)}
              />
              <label htmlFor="template-description">{t.description}</label>
            </div>
            <div className="form-floating">
              <select
                id="template-language"
                className="form-select"
                value={template.language}
                onChange={(e) => update('language', e.target.value === 'he' ? 'he' : 'en')}>
                <option value="en">{t.english}</option>
                <option value="he">{t.hebrew}</option>
              </select>
              <label htmlFor="template-language">{t.language}</label>
            </div>
            <div className="form-floating">
              <input
                id="template-subject"
                className="form-control"
                placeholder=" "
                dir="auto"
                value={template.subject}
                onChange={(e) => update('subject', e.target.value)}
              />
              <label htmlFor="template-subject">{t.subject}</label>
            </div>
            <div className="form-floating">
              <textarea
                id="template-text"
                className="form-control template-text"
                placeholder=" "
                dir={template.language === 'he' ? 'rtl' : 'ltr'}
                value={template.text}
                onChange={(e) => update('text', e.target.value)}
              />
              <label htmlFor="template-text">{t.text}</label>
            </div>
          </div>
        </div>
        <section className="mt-4" aria-label={t.html}>
          <h5 className="border-bottom">{t.html}</h5>
          <div className="card">
            <div className="card-body">
              <EditorContext.Provider value={{editor}}>
                {editor && !initial.readOnly && (
                  <EditorControls
                    editor={editor}
                    t={t}
                    onError={setError}
                    disabled={busy || !ready}
                  />
                )}
                <div className="template-editor-layout">
                  <div
                    className="template-content"
                    dir={template.language === 'he' ? 'rtl' : 'ltr'}>
                    <EditorContent editor={editor} />
                  </div>
                  {editor && !initial.readOnly && (
                    <EditorInspector editor={editor} t={t} onError={setError} />
                  )}
                </div>
              </EditorContext.Provider>
            </div>
          </div>
        </section>
        <section className="col-md-6 mt-4" aria-label={t.samples}>
          <h5 className="border-bottom">{t.samples}</h5>
          <p className="text-body-secondary small">{t.samplesHelp}</p>
          {variables.length > 0 && (
            <div className="card">
              <div className="card-body d-grid gap-3">
                {variables.map((name) => (
                  <div className="form-floating" key={name}>
                    <input
                      id={`template-sample-${name}`}
                      className="form-control"
                      placeholder=" "
                      value={template.previewValues[name] ?? ''}
                      onChange={(e) =>
                        update('previewValues', {...template.previewValues, [name]: e.target.value})
                      }
                    />
                    <label htmlFor={`template-sample-${name}`}>{name}</label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </fieldset>
      <section className="col-md-6 mt-4" aria-label={t.preview}>
        <h5 className="border-bottom">{t.preview}</h5>
        <div className="d-flex flex-wrap gap-2">
          <button
            className="btn btn-outline-primary"
            disabled={busy || !ready}
            onClick={(event) => openDialog('html', event.currentTarget)}>
            {t.rawHtml}
          </button>
          {!initial.readOnly && (
            <>
              <button
                className="btn btn-outline-primary"
                disabled={busy || !ready}
                onClick={(event) => openDialog('preview', event.currentTarget)}>
                {t.preview}
              </button>
              <button
                className="btn btn-outline-primary"
                disabled={busy || !ready}
                onClick={(event) => openDialog('send', event.currentTarget)}>
                {t.sendPreview}
              </button>
            </>
          )}
        </div>
      </section>
      <dialog
        ref={dialogRef}
        className={`template-dialog ${dialog === 'send' ? '' : 'template-preview-dialog'}`}
        aria-labelledby="template-dialog-title"
        aria-modal="true"
        aria-busy={busy}
        onCancel={(event) => {
          if (busy) event.preventDefault()
          else setError('')
        }}
        onClose={() => {
          if (dialogRef.current?.open) return
          setDialog(undefined)
          dialogTrigger.current?.focus()
        }}>
        <h5 id="template-dialog-title" className="border-bottom pb-2 mb-3">
          {dialog === 'html' ? t.rawHtml : dialog === 'preview' ? t.preview : t.sendPreview}
        </h5>
        {error && (
          <p className="alert alert-danger" role="alert">
            {error}
          </p>
        )}
        {busy && <p role="status">{t.busy}</p>}
        {(dialog === 'preview' || dialog === 'html') && (
          <>
            {dialog === 'html' && (
              <textarea
                className="form-control font-monospace"
                aria-label={t.rawHtml}
                dir="ltr"
                rows={18}
                readOnly
                spellCheck={false}
                value={rawHtml}
              />
            )}
            {dialog === 'preview' && preview && (
              <>
                <p className="template-preview-subject" dir="auto">
                  {preview.subject}
                </p>
                <iframe
                  title={t.preview}
                  sandbox=""
                  referrerPolicy="no-referrer"
                  srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">${preview.html}`}
                />
                <details className="mt-3">
                  <summary>{t.text}</summary>
                  <pre className="mt-2" dir="auto">
                    {preview.text}
                  </pre>
                </details>
              </>
            )}
            <div className="d-flex justify-content-end mt-3">
              <button className="btn btn-secondary" disabled={busy} onClick={closeDialog}>
                {t.close}
              </button>
            </div>
          </>
        )}
        {dialog === 'send' && (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void act('send')
            }}>
            <div className="form-floating">
              <input
                ref={recipientRef}
                id="template-recipient"
                className="form-control"
                placeholder=" "
                type="email"
                required
                dir="ltr"
                disabled={busy}
                value={to}
                onChange={(event) => updateRecipient(event.target.value)}
              />
              <label htmlFor="template-recipient">{t.to}</label>
            </div>
            <div className="d-flex justify-content-end gap-2 mt-3">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={closeDialog}>
                {t.cancel}
              </button>
              <button className="btn btn-primary" disabled={busy || !ready}>
                {t.send}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  )
}

const roots = new Map<HTMLElement, Root>()
function mount(): void {
  document.querySelectorAll<HTMLElement>('[data-template-page]').forEach((element) => {
    if (roots.has(element)) return
    const initial: EditorPage = JSON.parse(element.dataset.templateState!)
    const root = createRoot(element, {
      onUncaughtError: (error) => {
        console.error('email-template-editor-failed', error)
        element.textContent = initial.labels.loadingError
        element.setAttribute('role', 'alert')
      },
    })
    roots.set(element, root)
    root.render(<TemplateEditor initial={initial} />)
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
