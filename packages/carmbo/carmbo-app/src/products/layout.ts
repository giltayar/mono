import {html} from '../commons/html-templates.ts'

export function Layout({children}: {children: string | string[]}) {
  return html`
    <script src="/public/products/scripts.js" type="module"></script>
    <link rel="stylesheet" href="/public/products/style/style.css" />
    <div class="products-view">${children}</div>
  `
}
