import {html} from '../../../commons/html-templates.ts'

export function Layout({children}: {children: string | string[]}) {
  return html`
    <script src="/src/domain/sales-event/view/js/scripts.js" type="module"></script>
    <link rel="stylesheet" href="/src/domain/sales-event/view/style/style.css" />
    <div class="sales-events-view">${children}</div>
  `
}
