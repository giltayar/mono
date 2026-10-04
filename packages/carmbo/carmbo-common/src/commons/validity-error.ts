import {html} from './html-templates.ts'

export function ValidityError({
  valid,
  elementId,
  errorMessage,
}: {
  valid: boolean | (() => boolean)
  elementId: string
  errorMessage: string
}) {
  const isValid = typeof valid === 'function' ? valid() : valid

  if (!isValid) {
    const escapedMessage = errorMessage.replaceAll("'", "\\'")
    const scriptContent = `{
          const element = document.getElementById('${elementId}')
          element.setCustomValidity('${escapedMessage}')
          element.reportValidity()
        }`
    return html`<script dangerouslySetInnerHTML=${{__html: scriptContent}}></script>`
  } else {
    return ''
  }
}
