import {html} from '../../../commons/html-templates.ts'
import {getFixedT} from 'i18next'
import type {SaleWithPayments} from '../model/model.ts'
import {Tabs} from './layout.ts'

export function SalePaymentsView({sale}: {sale: SaleWithPayments}) {
  const t = getFixedT(null, 'sale')
  return html`
    <h2 class="border-bottom col-md-6 mt-3">
      ${t('payments.salePayments', {saleNumber: sale.saleNumber})}
    </h2>
    <${Tabs} saleNumber=${sale.saleNumber} activeTab="payments" />
    <table class="table mt-3">
      <thead>
        <tr>
          <th>${t('payments.date')}</th>
          <th>${t('payments.amount')}</th>
          <th>${t('payments.resolution')}</th>
          <th>${t('payments.invoiceDocumentNumber')}</th>
        </tr>
      </thead>
      <tbody>
        ${sale.payments.map(
          (payment) => html`
            <tr>
              <td>
                <span class="d-block ms-auto" title=${payment.timestamp.toLocaleTimeString('he-IL')}
                  >${payment.timestamp.toLocaleDateString('he-IL')}</span
                >
              </td>
              <td>${payment.amount}</td>
              <td>
                ${payment.resolution}${payment.cardcomStatus !== 'SUCCESSFUL'
                  ? ` (${payment.cardcomStatus})`
                  : ''}
              </td>
              <td>
                ${payment.invoiceDocumentNumber
                  ? html`<a href=${payment.invoiceDocumentUrl} target="_blank"
                      >${payment.invoiceDocumentNumber}</a
                    >`
                  : t('payments.na')}
              </td>
            </tr>
          `,
        )}
      </tbody>
    </table>
  `
}
