import {html} from '@giltayar/carmbo-commons/commons/html-templates'
import {generateItemTitle} from '@giltayar/carmbo-commons/commons/view-commons'

export function renderProductListOptions(products: {productNumber: number; name: string}[]) {
  return html`${products.map(
    (product) =>
      html`<option data-id=${product.productNumber}>
        ${generateItemTitle(product.productNumber, product.name)}
      </option>`,
  )}`
}
