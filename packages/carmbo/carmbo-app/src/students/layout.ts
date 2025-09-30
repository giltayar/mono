import {html} from '../commons/html-templates.ts'

export function Layout({children}: {children: string | string[]}) {
  return html`
    <script src="/public/students/scripts.js" defer></script>
    <link rel="stylesheet" href="/public/students/style/style.css" />
    <div class="students-view">${children}</div>
  `
}
