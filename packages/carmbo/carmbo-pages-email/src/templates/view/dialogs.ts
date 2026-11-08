import {html} from '@giltayar/carmbo-commons/commons/html-templates'
import {labels} from './labels.ts'
import {editorDocumentVals} from './create-update.ts'

export const RECIPIENT_COOKIE = 'carmbo-template-preview-recipient'

// Opened by htmx when swapped into `#template-dialog-slot`, and removed when closed.
function Dialog({
  title,
  preview = false,
  children,
}: {
  title: string
  preview?: boolean
  children: unknown
}): string | string[] {
  return html`<dialog
    class=${`template-dialog ${preview ? 'template-preview-dialog' : ''}`}
    aria-labelledby="template-dialog-title"
    hx-on::load="this.showModal()"
    hx-on:close="this.remove()"
    hx-on:cancel="if (this.querySelector('.template-busy.htmx-request')) event.preventDefault()"
    hx-on:template-sent="this.close()"
  >
    <h5 id="template-dialog-title" class="border-bottom pb-2 mb-3">${title}</h5>
    ${children}
  </dialog>`
}

function CloseButton(): string | string[] {
  return html`<div class="d-flex justify-content-end mt-3">
    <button type="button" class="btn btn-secondary" onclick="this.closest('dialog').close()">
      ${labels().close}
    </button>
  </div>`
}

function Alert({message}: {message: string | undefined}): string | string[] {
  return message ? html`<p class="alert alert-danger" role="alert">${message}</p>` : ''
}

export function renderPreviewDialog(
  result: {subject: string; html: string; text: string} | {error: string},
): string | string[] {
  const t = labels()
  return html`<${Dialog} title=${t.preview} preview=${true}>
    ${
      'error' in result
        ? html`<${Alert} message=${result.error} />`
        : html`
            <p class="template-preview-subject" dir="auto">${result.subject}</p>
            <iframe
              title=${t.preview}
              sandbox=""
              referrerpolicy="no-referrer"
              srcdoc=${`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">${result.html}`}
            ></iframe>
            <details class="mt-3">
              <summary>${t.text}</summary>
              <pre class="mt-2" dir="auto">${result.text}</pre>
            </details>
          `
    }
    <${CloseButton} />
  </${Dialog}>`
}

export function renderRawHtmlDialog(result: {html: string} | {error: string}): string | string[] {
  const t = labels()
  return html`<${Dialog} title=${t.rawHtml} preview=${true}>
    ${
      'error' in result
        ? html`<${Alert} message=${result.error} />`
        : html`<textarea
            class="form-control font-monospace"
            aria-label=${t.rawHtml}
            dir="ltr"
            rows="18"
            readonly
            spellcheck="false"
          >
${result.html}</textarea>`
    }
    <${CloseButton} />
  </${Dialog}>`
}

export function renderSendDialog({
  path,
  recipient,
  requestId,
  error,
}: {
  path: string
  recipient: string
  requestId: string
  error: string | undefined
}): string | string[] {
  const t = labels()
  return html`<${Dialog} title=${t.sendPreview}>
    <form
      hx-post=${`${path}/send-preview`}
      hx-include="#template-form"
      hx-vals=${editorDocumentVals}
      hx-target="closest dialog"
      hx-swap="outerHTML"
      hx-indicator="#template-send-busy"
      hx-disabled-elt="find fieldset"
    >
      <${Alert} message=${error} />
      <p id="template-send-busy" class="template-busy" role="status">${t.busy}</p>
      <input type="hidden" name="requestId" value=${requestId} />
      <fieldset>
      <div class="form-floating">
        <input
          id="template-recipient"
          name="to"
          class="form-control"
          placeholder=" "
          type="email"
          required
          autofocus
          dir="ltr"
          value=${recipient}
          hx-on:input=${`document.cookie = '${RECIPIENT_COOKIE}=' + encodeURIComponent(this.value) + '; path=/emails/templates; samesite=strict; max-age=' + (this.value ? 31536000 : 0)`}
        />
        <label for="template-recipient">${t.to}</label>
      </div>
      <div class="d-flex justify-content-end gap-2 mt-3">
        <button type="button" class="btn btn-secondary" onclick="this.closest('dialog').close()">
          ${t.cancel}
        </button>
        <button type="submit" class="btn btn-primary">${t.send}</button>
      </div>
      </fieldset>
    </form>
  </${Dialog}>`
}
