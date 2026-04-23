import {html} from '../../../commons/html-templates.ts'
import {getFixedT} from 'i18next'
import {MainLayout} from '../../../layout/main-view.ts'
import {Layout} from './layout.ts'
import type {RevenueSummary} from '../model/model.ts'

export function renderRevenuePage(revenue: RevenueSummary) {
  const t = getFixedT(null, 'sale')

  return html`
    <${MainLayout} title=${t('revenue.title')} activeNavItem="sales">
      <${Layout}>
        <div class="mt-3">
          <div class="d-flex flex-row border-bottom align-items-baseline">
            <h2>${t('revenue.title')}</h2>
            <a class="btn btn-outline-secondary btn-sm ms-auto" href="/sales"
              >${t('revenue.backToSales')}</a
            >
          </div>
          <table class="table mt-3">
            <thead>
              <tr>
                <th>${t('revenue.period')}</th>
                <th>${t('revenue.totalRevenue')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${t('revenue.week')}</td>
                <td>${formatRevenue(revenue.week)}</td>
              </tr>
              <tr>
                <td>${t('revenue.month')}</td>
                <td>${formatRevenue(revenue.month)}</td>
              </tr>
              <tr>
                <td>${t('revenue.ytd')}</td>
                <td>${formatRevenue(revenue.ytd)}</td>
              </tr>
              <tr>
                <td>${t('revenue.year')}</td>
                <td>${formatRevenue(revenue.year)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </${Layout}>
    </${MainLayout}>
  `
}

function formatRevenue(amount: number): string {
  return `₪${amount.toLocaleString('he-IL', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
}
