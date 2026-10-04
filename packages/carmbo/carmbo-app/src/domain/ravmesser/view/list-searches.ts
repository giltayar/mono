import {html} from '@giltayar/carmbo-common/commons/html-templates'
import {generateItemTitle} from '@giltayar/carmbo-common/commons/view-commons'

export function renderRavmesserListOptions(lists: {id: number; name: string}[]) {
  return html`${lists.map(
    (list) => html`<option data-id=${list.id}>${generateItemTitle(list.id, list.name)}</option>`,
  )}`
}
