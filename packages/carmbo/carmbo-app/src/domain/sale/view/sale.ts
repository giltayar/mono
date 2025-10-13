import {html} from '../../../commons/html-templates.ts'
import type {SaleHistory, SaleWithHistoryInfo} from '../model.ts'
import {SaleHistoryList} from './history.ts'

export function SaleView({sale, history}: {sale: SaleWithHistoryInfo; history: SaleHistory[]}) {
  return html`
    <h2 class="border-bottom col-md-6 mt-3">Sale ${sale.saleNumber}</h2>
    <form class="col-md-6 mt-3">
      <div class="mt-3">
        <div class="mb-3">
          <label class="form-label"
            >Sale Number
            <input type="text" class="form-control" value=${sale.saleNumber} readonly />
          </label>
        </div>

        <div class="mb-3">
          <label class="form-label"
            >Timestamp
            <input
              type="text"
              class="form-control"
              value=${formatDateTime(sale.timestamp)}
              readonly
            />
          </label>
        </div>

        <div class="mb-3">
          <label class="form-label"
            >Sales Event
            <input
              type="text"
              class="form-control"
              value=${`${sale.saleEventNumber}: ${sale.salesEventName}`}
              readonly
              title="Sales Event Number"
            />
          </label>
        </div>

        <div class="mb-3">
          <label class="form-label"
            >Student
            <input
              type="text"
              class="form-control"
              value=${`${sale.studentNumber}: ${sale.studentName}`}
              readonly
              title="Student Number"
            />
          </label>
        </div>

        ${sale.finalSaleRevenue
          ? html`
              <div class="mb-3">
                <label class="form-label"
                  >Final Sale Revenue
                  <input
                    type="text"
                    class="form-control"
                    value=${'₪' + sale.finalSaleRevenue.toFixed(2)}
                    readonly
                  />
                </label>
              </div>
            `
          : ''}
        ${sale.cardcomInvoiceNumber
          ? html`
              <div class="mb-3">
                <label class="form-label"
                  >Cardcom Invoice Number
                  <input
                    type="text"
                    class="form-control"
                    value=${sale.cardcomInvoiceNumber}
                    readonly
                  />
                </label>
              </div>
            `
          : ''}
        ${sale.products && sale.products.length > 0
          ? html`
              <div class="mb-3">
                <label class="form-label"
                  >Products
                  ${sale.products.map(
                    (product, index) => html`
                      <div class="card mb-2">
                        <div class="card-body">
                          <h6 class="card-subtitle mb-2 text-muted">
                            Product ${index + 1}: ${product.productName}
                          </h6>
                          <div class="row">
                            <div class="col-md-4">
                              <small class="text-muted">Product</small>
                              <div>${product.productNumber}: ${product.productName}</div>
                            </div>
                            <div class="col-md-4">
                              <small class="text-muted">Quantity:</small>
                              <div>${product.quantity}</div>
                            </div>
                            <div class="col-md-4">
                              <small class="text-muted">Unit Price:</small>
                              <div>₪${product.unitPrice.toFixed(2)}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    `,
                  )}
                </label>
              </div>
            `
          : ''}
      </div>
    </form>
    <${SaleHistoryList} sale=${sale} history=${history} />
  `
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-IL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
