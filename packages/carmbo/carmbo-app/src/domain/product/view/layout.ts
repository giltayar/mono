import {html} from '../../../commons/html-templates.ts'
import {version} from '../../../commons/version.ts'

export function Layout({children}: {children: string | string[]}) {
  return html`
    <script src=${`/src/${version}/domain/product/view/js/scripts.js`} type="module"></script>
    <link rel="stylesheet" href=${`/src/${version}/domain/product/view/style/style.css`} />
    <div class="products-view">${children}</div>
  `
}
