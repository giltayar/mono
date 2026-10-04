import {html} from '@giltayar/carmbo-common/commons/html-templates'
import {generateItemTitle} from '@giltayar/carmbo-common/commons/view-commons'

export function renderWhatsappGroupOptions(groups: {id: string; name: string}[]) {
  return html`${groups.map(
    (group) =>
      html`<option data-id=${group.id}>${generateItemTitle(group.id, group.name)}</option>`,
  )}`
}
