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
  return html`
    <h2 class="border-bottom col-md-6 mt-3">
      Update Sale ${sale.saleNumber}
      ${sale.historyOperation === 'delete'
        ? html` <small class="text-body-secondary">(archived)</small>`
        : ''}
    </h2>
    <form hx-put="/sales/${sale.saleNumber}" hx-target="form" class="col-md-6 mt-3">
      <input name="saleNumber" type="hidden" value=${sale.saleNumber} />
      <input
        name="delete-operation"
        type="hidden"
        value=${sale.historyOperation === 'delete' ? 'restore' : 'delete'}
      />
      <div class="ms-auto" style="width: fit-content">
        <section class="btn-group" aria-label="Form actions">
          ${sale.historyOperation === 'delete'
            ? html`
                <button
                  class="btn btn-danger"
                  type="Submit"
                  value="delete"
                  hx-delete=""
                  hx-params="delete-operation"
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
                  value="delete"
                  hx-delete=""
                  hx-params="delete-operation"
                >
                  Archive
                </button>
                <button class="btn btn-primary" type="Submit" value="save">Update</button>
              `}
        </section>
      </div>
      <div class="mt-3">
        <${SalesFormFields}
          sale=${sale}
          operation=${sale.historyOperation === 'delete' ? 'read' : 'write'}
        />
      </div>
    </form>
    <${SaleHistoryList} sale=${sale} history=${history} />
  `
}
