import {html} from '@giltayar/carmbo-commons/commons/html-templates'
import {generateItemTitle} from '@giltayar/carmbo-commons/commons/view-commons'

export function renderSmooveListOptions(lists: {id: number; name: string}[]) {
  return html`${lists.map(
    (list) => html`<option data-id=${list.id}>${generateItemTitle(list.id, list.name)}</option>`,
  )}`
}
