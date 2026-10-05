import {html} from '@giltayar/carmbo-commons/commons/html-templates'

export function Layout({children}: {children: string | string[]}) {
  return html`
    <script src="/sale-assets/sales-event/view/js/scripts.js" type="module"></script>
    <link rel="stylesheet" href="/sale-assets/sales-event/view/style/style.css" />
    <div class="sales-events-view">${children}</div>
  `
}
