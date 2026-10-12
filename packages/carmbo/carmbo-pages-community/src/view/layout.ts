import {html} from '@giltayar/carmbo-commons/commons/html-templates'

export function Layout({children}: {children: string | string[]}) {
  return html`
    <script src="/communities/scripts.js" defer></script>
    <link rel="stylesheet" href="/communities/style.css" />
    <div class="communities-view">${children}</div>
  `
}
