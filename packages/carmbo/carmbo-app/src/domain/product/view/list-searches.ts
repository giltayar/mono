import {html} from '@giltayar/carmbo-common/commons/html-templates'
import {generateItemTitle} from '@giltayar/carmbo-common/commons/view-commons'

export function renderProductListOptions(products: {productNumber: number; name: string}[]) {
  return html`${products.map(
    (product) =>
      html`<option data-id=${product.productNumber}>
        ${generateItemTitle(product.productNumber, product.name)}
      </option>`,
  )}`
}
