import {html} from '../../../commons/html-templates.ts'
import {getFixedT} from 'i18next'
import {version} from '../../../commons/version.ts'

export function Layout({children}: {children: string | string[]}) {
  return html`
    <script src=${`/src/${version}/domain/sale/view/js/scripts.js`} type="module"></script>
    <link rel="stylesheet" href=${`/src/${version}/domain/sale/view/style/style.css`} />
    <div class="sales-view">${children}</div>
  `
}

export function Tabs({
  saleNumber,
  activeTab,
}: {
  saleNumber: number
  activeTab: 'details' | 'payments' | 'providers'
}) {
  const t = getFixedT(null, 'sale')
  return html`
    <ul class="nav nav-tabs col-md-6">
      <li class="nav-item">
        <a
          class="nav-link"
          aria-current=${activeTab === 'details' ? 'page' : undefined}
          href=${`/sales/${saleNumber}`}
          >${t('layout.details')}</a
        >
      </li>
      <li class="nav-item">
        <a
          class="nav-link"
          aria-current=${activeTab === 'payments' ? 'page' : undefined}
          href=${`/sales/${saleNumber}/payments`}
          >${t('layout.payments')}</a
        >
      </li>
      <li class="nav-item">
        <a
          class="nav-link"
          aria-current=${activeTab === 'providers' ? 'page' : undefined}
          href=${`/sales/${saleNumber}/providers`}
          >${t('layout.externalProviders')}</a
        >
      </li>
    </ul>
  `
}
