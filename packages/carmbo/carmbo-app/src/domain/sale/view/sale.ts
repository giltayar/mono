import {html} from '../../../commons/html-templates.ts'
import type {SaleHistory, SaleWithHistoryInfo} from '../model/model.ts'
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
  const isConnectedSale = sale.cardcomInvoiceDocumentUrl || sale.isNoInvoiceOrder

  return html`
    <h2 class="border-bottom col-md-6 mt-3">
      ${!isConnectedSale ? 'Update' : ''} Sale ${sale.saleNumber}
      ${sale.historyOperation === 'delete'
        ? html` <small class="text-body-secondary">(archived)</small>`
        : ''}
      <div class="operation-spinner spinner-border mr-1" role="status"></div>
    </h2>
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
          ${!isConnectedSale
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
            ${!isConnectedSale ? 'Connect' : 'Reconnect'}
          </button>
          ${sale.isActive && !sale.cardcomRefundTransactionId
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
