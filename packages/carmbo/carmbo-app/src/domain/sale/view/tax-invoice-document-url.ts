import {finalHtml} from '../../../commons/controller-result.ts'
import {html} from '../../../commons/html-templates.ts'

export function renderInvoiceDocumentUrlLink(url: string) {
  return finalHtml(InvoiceDocumentUrlLink(url))
}

export function InvoiceDocumentUrlLink(url: string) {
  return html`<a href=${url}>View Document</a>`
}
