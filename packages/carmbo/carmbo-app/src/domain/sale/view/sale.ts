import {html} from '../../../commons/html-templates.ts'
import {getFixedT} from 'i18next'
import type {Sale, SaleHistory, SaleWithHistoryInfo} from '../model/model.ts'
import {SalesFormFields} from './form.ts'
import {SaleHistoryList} from './history.ts'
import {Tabs} from './layout.ts'

export function SaleUpdateView({
  sale,
  history,
}: {
  sale: SaleWithHistoryInfo
  history: SaleHistory[]
}) {
  const isReadOnlySale = sale.isActive || sale.cardcomRefundTransactionId
  const t = getFixedT(null, 'sale')

  return html`
    <div class="sale-title border-bottom col-md-6 mt-3">
      <h2>
        ${!isReadOnlySale ? t('createUpdate.updateSale') : t('createUpdate.sale')}
        ${` ${sale.saleNumber}`}
        ${sale.historyOperation === 'delete'
          ? html` <small class="text-body-secondary">${t('createUpdate.archived')}</small>`
          : ''}
        <div class="operation-spinner spinner-border mr-1" role="status"></div>
      </h2>
      <${SaleStatus} sale=${sale} />
    </div>
    <${Tabs} saleNumber=${sale.saleNumber} activeTab="details" />
    <form
      hx-put="/sales/${sale.saleNumber}"
      hx-target="form"
      class="col-md-6 mt-3"
      hx-indicator=".operation-spinner"
    >
      <input name="saleNumber" type="hidden" value=${sale.saleNumber} />
      <div class="ms-auto" style="width: fit-content">
        <section class="btn-group" aria-label="Form actions">
          ${isReadOnlySale
            ? sale.historyOperation !== 'delete'
              ? html`<button
                  class="btn btn-primary"
                  type="button"
                  hx-put="/sales/${sale.saleNumber}/notes"
                  hx-include="#sale-notes"
                  hx-indicator=".operation-spinner"
                >
                  ${t('createUpdate.update')}
                </button>`
              : undefined
            : sale.historyOperation === 'delete'
              ? html`
                  <button
                    class="btn btn-danger"
                    type="Submit"
                    hx-delete=""
                    name="operation"
                    value="restore"
                  >
                    ${t('createUpdate.restore')}
                  </button>
                `
              : html`
                  <button class="btn btn-secondary discard" type="Submit" value="discard">
                    ${t('createUpdate.discard')}
                  </button>
                  <button
                    class="btn btn-danger"
                    type="Submit"
                    hx-delete=""
                    name="operation"
                    value="delete"
                  >
                    ${t('createUpdate.archive')}
                  </button>
                  <button class="btn btn-primary" type="Submit" value="save">
                    ${t('createUpdate.update')}
                  </button>
                `}
          <button class="button btn-primary" hx-post="/sales/${sale.saleNumber}/connect">
            ${!sale.isConnected ? t('createUpdate.connect') : t('createUpdate.reconnect')}
          </button>
          ${sale.isActive &&
          !sale.cardcomRefundTransactionId &&
          (sale.finalSaleRevenue ?? 0) > 0 &&
          !sale.isStandingOrder
            ? html`<button
                class="button"
                hx-post="/sales/${sale.saleNumber}/refund"
                hx-confirm=${sale.manualSaleType === 'manual'
                  ? 'This sale is manual! You MUST process the refund in Cardcom. Are you sure you want to proceed?'
                  : undefined}
              >
                ${t('createUpdate.refund')}
              </button>`
            : undefined}
          ${sale.isConnected
            ? html`<button class="button" hx-post="/sales/${sale.saleNumber}/disconnect">
                ${t('createUpdate.disconnect')}
              </button>`
            : undefined}
        </section>
      </div>
      <div class="mt-3">
        <${SalesFormFields}
          sale=${sale}
          operation=${sale.historyOperation === 'delete' ? 'read' : 'write'}
          saleNumber=${sale.saleNumber}
        />
      </div>
    </form>
    <div
      id="student-search-dialog-container"
      hx-on::after-swap="this.querySelector('dialog')?.showModal()"
    ></div>
    <${SaleHistoryList} sale=${sale} history=${history} />
  `
}

function SaleStatus({sale}: {sale: Sale}) {
  const t = getFixedT(null, 'sale')
  return html`
    <div>
      ${sale.isStandingOrder
        ? html`${t('createUpdate.subscription')}${!sale.isActive
            ? ' ' + t('createUpdate.unsubscribed')
            : ''}`
        : t('createUpdate.regularSale')}
      ${sale.cardcomRefundTransactionId ? html` | ${t('createUpdate.refunded')}` : ''}
      ${sale.isConnected
        ? ' | ' + t('createUpdate.connectedToProviders')
        : ' | ' + t('createUpdate.disconnectedFromProviders')}
    </div>
  `
}
