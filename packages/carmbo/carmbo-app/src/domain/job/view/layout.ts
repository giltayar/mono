import {html} from '@giltayar/carmbo-common/commons/html-templates'
import {getVersion} from '@giltayar/carmbo-common/commons/version'

export function Layout({children}: {children: string | string[]}) {
  return html`
    <link rel="stylesheet" href=${`/src/${getVersion()}/domain/job/view/style/style.css`} />
    <div class="jobs-view">${children}</div>
  `
}
