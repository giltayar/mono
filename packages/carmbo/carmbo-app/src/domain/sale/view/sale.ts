import {html} from '../../../commons/html-templates.ts'
import type {SaleHistory, SaleWithHistoryInfo} from '../model.ts'
import {SalesFormFields} from './form.ts'
import {SaleHistoryList} from './history.ts'

export function SaleUpdateView({
  sale,
  history,
}: {
  sale: SaleWithHistoryInfo
  history: SaleHistory[]
}) {
  const isUnconnectedSale = !sale.cardcomInvoiceDocumentUrl

  return html`
    <h2 class="border-bottom col-md-6 mt-3">
      ${isUnconnectedSale ? 'Update' : ''} Sale ${sale.saleNumber}
      ${sale.historyOperation === 'delete'
        ? html` <small class="text-body-secondary">(archived)</small>`
        : ''}
      <div class="spinner-border mr-1" role="status"></div>
    </h2>
    <form
      hx-put="/sales/${sale.saleNumber}"
      hx-target="form"
      class="col-md-6 mt-3"
      hx-indicator="h2"
    >
      <input name="saleNumber" type="hidden" value=${sale.saleNumber} />
      <div class="ms-auto" style="width: fit-content">
        <section class="btn-group" aria-label="Form actions">
          ${isUnconnectedSale
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
          <button
            class="button btn-primary"
            hx-post="/sales/${sale.saleNumber}/connect-manual-sale"
          >
            ${!sale.cardcomInvoiceDocumentUrl ? 'Connect' : 'Reconnect'}
          </button>
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
