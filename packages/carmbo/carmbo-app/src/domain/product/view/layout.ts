import {html} from '../../../commons/html-templates.ts'

export function Layout({children}: {children: string | string[]}) {
  return html`
    <script src="/src/domain/product/view/js/scripts.js" type="module"></script>
    <link rel="stylesheet" href="/src/domain/product/view/style/style.css" />
    <div class="products-view">${children}</div>
  `
}
