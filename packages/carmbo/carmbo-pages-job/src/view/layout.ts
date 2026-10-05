import {html} from '@giltayar/carmbo-commons/commons/html-templates'

export function Layout({children}: {children: string | string[]}): string | string[] {
  return html`
    <link rel="stylesheet" href="/jobs/style.css" />
    <div class="jobs-view">${children}</div>
  `
}
