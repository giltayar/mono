import {html} from '../../../commons/html-templates.ts'
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
  return html`
    <div class="sale-title border-bottom col-md-6 mt-3">
      <h2>
        ${!sale.isConnected ? 'Update' : ''} Sale ${sale.saleNumber}
        ${sale.historyOperation === 'delete'
          ? html` <small class="text-body-secondary">(archived)</small>`
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
          ${!sale.isConnected
            ? sale.historyOperation === 'delete'
              ? html`
                  <button
                    class="btn btn-danger"
                    type="Submit"
                    hx-delete=""
                    name="operation"
                    value="restore"
                  >
                    Restore
                  </button>
                `
              : html`
                  <button class="btn btn-secondary discard" type="Submit" value="discard">
                    Discard
                  </button>
                  <button
                    class="btn btn-danger"
                    type="Submit"
                    hx-delete=""
                    name="operation"
                    value="delete"
                  >
                    Archive
                  </button>
                  <button class="btn btn-primary" type="Submit" value="save">Update</button>
                `
            : undefined}
          <button class="button btn-primary" hx-post="/sales/${sale.saleNumber}/connect">
            ${!sale.isConnected ? 'Connect' : 'Reconnect'}
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
                Refund
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
    <${SaleHistoryList} sale=${sale} history=${history} />
  `
}

function SaleStatus({sale}: {sale: Sale}) {
  return html`
    <div>
      ${sale.isStandingOrder
        ? html`Subscription${!sale.isActive ? ' (unsubscribed)' : ''}`
        : 'Regular Sale'}
      ${sale.cardcomRefundTransactionId ? html` | Refunded` : ''}
      ${sale.isConnected
        ? ' | Connected to External Providers'
        : ' | Disconnected from External Providers'}
    </div>
  `
}
