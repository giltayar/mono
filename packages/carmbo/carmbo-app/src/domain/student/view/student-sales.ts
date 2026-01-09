import {html} from '../../../commons/html-templates.ts'
import {MainLayout} from '../../../layout/main-view.ts'
import type {StudentSaleForGrid} from '../model.ts'
import {Layout, Tabs} from './layout.ts'

export function renderStudentSalesPage(studentNumber: number, sales: StudentSaleForGrid[]) {
  return html`
    <${MainLayout} title="Students" activeNavItem="students">
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
    <h2 class="border-bottom col-md-6 mt-3">Student ${studentNumber} Sales</h2>
    <${Tabs} studentNumber=${studentNumber} activeTab="sales" />
    <table class="table mt-3 col-md-6">
      <thead>
        <tr>
          <th>Sale #</th>
          <th>Sales Event</th>
          <th>Products</th>
          <th>Date</th>
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
  return new Intl.DateTimeFormat('en-IL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-IL', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
