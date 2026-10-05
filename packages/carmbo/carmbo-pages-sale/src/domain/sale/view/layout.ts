import {html} from '@giltayar/carmbo-commons/commons/html-templates'
import {getFixedT} from 'i18next'

export function Layout({children}: {children: string | string[]}) {
  return html`
    <script src="/sale-assets/sale/view/js/scripts.js" type="module"></script>
    <link rel="stylesheet" href="/sale-assets/sale/view/style/style.css" />
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
