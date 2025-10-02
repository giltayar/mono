import {html} from '../commons/html-templates.ts'

export function Layout({children}: {children: string | string[]}) {
  return html`
    <script src="/src/students/scripts.js" defer></script>
    <link rel="stylesheet" href="/src/students/style/style.css" />
    <div class="students-view">${children}</div>
  `
}
