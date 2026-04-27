import {html} from '../../../commons/html-templates.ts'
import {generateItemTitle} from '../../../commons/view-commons.ts'

export function renderSmooveListOptions(lists: {id: number; name: string}[]) {
  return html`${lists.map(
    (list) => html`<option data-id=${list.id}>${generateItemTitle(list.id, list.name)}</option>`,
  )}`
}
