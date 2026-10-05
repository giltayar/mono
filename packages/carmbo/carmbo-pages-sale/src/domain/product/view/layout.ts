import {html} from '@giltayar/carmbo-commons/commons/html-templates'

export function Layout({children}: {children: string | string[]}) {
  return html`
    <script src="/sale-assets/product/view/js/scripts.js" type="module"></script>
    <link rel="stylesheet" href="/sale-assets/product/view/style/style.css" />
    <div class="products-view">${children}</div>
  `
}
