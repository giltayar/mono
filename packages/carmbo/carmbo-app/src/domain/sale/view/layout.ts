import {html} from '../../../commons/html-templates.ts'
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
  return html`
    <ul class="nav nav-tabs col-md-6">
      <li class="nav-item">
        <a
          class="nav-link"
          aria-current=${activeTab === 'details' ? 'page' : undefined}
          href=${`/sales/${saleNumber}`}
          >Details</a
        >
      </li>
      <li class="nav-item">
        <a
          class="nav-link"
          aria-current=${activeTab === 'payments' ? 'page' : undefined}
          href=${`/sales/${saleNumber}/payments`}
          >Payments</a
        >
      </li>
      <li class="nav-item">
        <a
          class="nav-link"
          aria-current=${activeTab === 'providers' ? 'page' : undefined}
          href=${`/sales/${saleNumber}/providers`}
          >External Providers</a
        >
      </li>
    </ul>
  `
}
