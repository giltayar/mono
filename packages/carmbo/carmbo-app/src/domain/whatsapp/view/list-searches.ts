import {html} from '../../../commons/html-templates.ts'
import {generateItemTitle} from '../../../commons/view-commons.ts'

export function renderWhatsappGroupOptions(groups: {id: string; name: string}[]) {
  return html`${groups.map(
    (group) =>
      html`<option data-id=${group.id}>${generateItemTitle(group.id, group.name)}</option>`,
  )}`
}
