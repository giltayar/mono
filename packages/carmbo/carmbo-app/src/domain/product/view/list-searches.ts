import {html} from '../../../commons/html-templates.ts'
import {generateItemTitle} from '../../../commons/view-commons.ts'

export function renderProductListOptions(products: {productNumber: number; name: string}[]) {
  return html`${products.map(
    (product) =>
      html`<option data-id=${product.productNumber}>
        ${generateItemTitle(product.productNumber, product.name)}
      </option>`,
  )}`
}
