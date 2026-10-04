import {html} from '@giltayar/carmbo-common/commons/html-templates'
import {getVersion} from '@giltayar/carmbo-common/commons/version'

export function Layout({children}: {children: string | string[]}) {
  return html`
    <script src=${`/src/${getVersion()}/domain/product/view/js/scripts.js`} type="module"></script>
    <link rel="stylesheet" href=${`/src/${getVersion()}/domain/product/view/style/style.css`} />
    <div class="products-view">${children}</div>
  `
}
