import {html} from '../../../commons/html-templates.ts'
import {version} from '../../../commons/version.ts'

export function Layout({children}: {children: string | string[]}) {
  return html`
    <link rel="stylesheet" href=${`/src/${version}/domain/job/view/style/style.css`} />
    <div class="jobs-view">${children}</div>
  `
}
