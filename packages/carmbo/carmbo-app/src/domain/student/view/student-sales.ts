import {html} from '../../../commons/html-templates.ts'
import {MainLayout} from '../../../layout/main-view.ts'
import type {StudentSaleForGrid} from '../model.ts'
import {Layout, Tabs} from './layout.ts'
import {getFixedT, default as i18next} from 'i18next'

const t = getFixedT(null, 'student')

export function renderStudentSalesPage(studentNumber: number, sales: StudentSaleForGrid[]) {
  return html`
    <${MainLayout} title=${t('list.students')} activeNavItem="students">
      <${Layout}>
        <${StudentSalesView} studentNumber=${studentNumber} sales=${sales} />
      </${Layout}>
    </${MainLayout}>
  `
}

function StudentSalesView({
  studentNumber,
  sales,
}: {
  studentNumber: number
  sales: StudentSaleForGrid[]
}) {
  return html`
    <h2 class="border-bottom col-md-6 mt-3">${t('studentSales.studentSales', {studentNumber})}</h2>
    <${Tabs} studentNumber=${studentNumber} activeTab="sales" />
    <table class="table mt-3 col-md-6">
      <thead>
        <tr>
          <th>${t('studentSales.saleNumber')}</th>
          <th>${t('studentSales.salesEvent')}</th>
          <th>${t('studentSales.products')}</th>
          <th>${t('studentSales.date')}</th>
        </tr>
      </thead>
      <tbody>
        ${sales.map(
          (sale) => html`
            <tr>
              <td>
                <a class="btn btn-light btn-sm" role="button" href="/sales/${sale.saleNumber}"
                  >${sale.saleNumber}</a
                >
              </td>
              <td>
                <a href="/sales-events/${sale.salesEventNumber}">${sale.salesEventName}</a>
              </td>
              <td>
                ${sale.products.map(
                  (product, index) =>
                    html`${index > 0 ? ', ' : ''}<a href="/products/${product.productNumber}"
                        >${product.productName}</a
                      >`,
                )}
              </td>
              <td title="${formatTime(sale.timestamp)}">${formatDate(sale.timestamp)}</td>
            </tr>
          `,
        )}
      </tbody>
    </table>
  `
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(`${i18next.language}-IL`, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat(`${i18next.language}-IL`, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
