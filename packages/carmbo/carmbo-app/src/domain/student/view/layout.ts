import {html} from '../../../commons/html-templates.ts'
import {version} from '../../../commons/version.ts'
import {getFixedT} from 'i18next'

const t = getFixedT(null, 'student')

export function Layout({children}: {children: string | string[]}) {
  return html`
    <script src=${`/src/${version}/domain/student/view/js/scripts.js`} defer></script>
    <link rel="stylesheet" href=${`/src/${version}/domain/student/view/style/style.css`} />
    <div class="students-view">${children}</div>
  `
}

export function Tabs({
  studentNumber,
  activeTab,
}: {
  studentNumber: number
  activeTab: 'details' | 'sales'
}) {
  return html`
    <ul class="nav nav-tabs col-md-6">
      <li class="nav-item">
        <a
          class="nav-link"
          aria-current=${activeTab === 'details' ? 'page' : undefined}
          href=${`/students/${studentNumber}`}
          >${t('layout.details')}</a
        >
      </li>
      <li class="nav-item">
        <a
          class="nav-link"
          aria-current=${activeTab === 'sales' ? 'page' : undefined}
          href=${`/students/${studentNumber}/sales`}
          >${t('layout.sales')}</a
        >
      </li>
    </ul>
  `
}
