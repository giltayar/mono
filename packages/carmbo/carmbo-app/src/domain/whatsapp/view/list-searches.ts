import {html} from '@giltayar/carmbo-commons/commons/html-templates'
import {generateItemTitle} from '@giltayar/carmbo-commons/commons/view-commons'

export function renderWhatsappGroupOptions(groups: {id: string; name: string}[]) {
  return html`${groups.map(
    (group) =>
      html`<option data-id=${group.id}>${generateItemTitle(group.id, group.name)}</option>`,
  )}`
}
