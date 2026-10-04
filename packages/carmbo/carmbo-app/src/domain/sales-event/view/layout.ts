import {html} from '@giltayar/carmbo-common/commons/html-templates'
import {getVersion} from '@giltayar/carmbo-common/commons/version'

export function Layout({children}: {children: string | string[]}) {
  return html`
    <script
      src=${`/src/${getVersion()}/domain/sales-event/view/js/scripts.js`}
      type="module"
    ></script>
    <link rel="stylesheet" href=${`/src/${getVersion()}/domain/sales-event/view/style/style.css`} />
    <div class="sales-events-view">${children}</div>
  `
}
