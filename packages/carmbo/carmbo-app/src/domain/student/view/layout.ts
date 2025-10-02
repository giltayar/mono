import {html} from '../../../commons/html-templates.ts'

export function Layout({children}: {children: string | string[]}) {
  return html`
    <script src="/src/domain/student/view/js/scripts.js" defer></script>
    <link rel="stylesheet" href="/src/domain/student/view/style/style.css" />
    <div class="students-view">${children}</div>
  `
}
