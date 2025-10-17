import {html} from '../../../commons/html-templates.ts'
import {generateItemTitle} from '../../../commons/view-commons.ts'
import type {NewSale, Sale} from '../model.ts'

export function SalesFormFields({
  sale,
  operation,
}: {
  sale: Sale | NewSale
  operation: 'read' | 'write'
}) {
  const isReadOnly = operation === 'read' || !('manualSaleType' in sale)

  return html`
    <div class="sales-view_form-fields card">
      <div class="card-body">
        <div class="mb-3">
          <label for="salesEventNumber" class="form-label">Sales Event</label>
          <input
            type="hidden"
            id="salesEventNumber_value"
            name="salesEventNumber"
            value=${sale.salesEventNumber}
          />
          <input
            class="form-control pick-item-title-async"
            type="text"
            id="salesEventNumber"
            hx-post=""
            hx-target="closest .sales-view_form-fields"
            hx-swap="outerHTML"
            hx-trigger="change delay:1ms"
            value=${generateItemTitle(sale.salesEventNumber, sale.salesEventName)}
            list="sales-event-list"
            data-list-fetch="/sales/query/sales-event-list"
            required
            readonly=${isReadOnly}
          />
          <datalist id="sales-event-list"> </datalist>
        </div>
        <div class="mb-3">
          <label for="studentNumber" class="form-label">Student</label>
          <input
            type="hidden"
            id="studentNumber_value"
            name="studentNumber"
            value=${sale.studentNumber}
          />
          <input
            class="form-control pick-item-title-async"
            id="studentNumber"
            list="student-list"
            hx-post=""
            hx-target="closest .sales-view_form-fields"
            hx-swap="outerHTML"
            hx-trigger="change delay:1ms"
            data-list-fetch="/sales/query/student-list"
            value=${generateItemTitle(sale.studentNumber, sale.studentName)}
            required
            readonly=${isReadOnly}
          />
        </div>
        <datalist id="student-list"> </datalist>
        <div class="mb-3">
          <label for="finalSaleRevenue" class="form-label">Final Sale Revenue</label>
          <input
            type="number"
            class="form-control"
            id="finalSaleRevenue"
            name="finalSaleRevenue"
            value=${sale.finalSaleRevenue}
            readonly=${isReadOnly}
          />
        </div>
        <div class="mb-3">
          <label for="cardcomInvoiceNumber" class="form-label">Cardcom Invoice Number</label>
          <input
            type="number"
            class="form-control"
            id="cardcomInvoiceNumber"
            name="cardcomInvoiceNumber"
            value=${sale.cardcomInvoiceNumber}
            readonly=${isReadOnly}
          />
        </div>
        ${sale.products && sale.products.length > 0
          ? html`
              <fieldset class="mb-3">
                <legend><h6>Products</h6></legend>
                ${sale.products.map(
                  (product, index) => html`
                    <fieldset class="card mb-2">
                      <div class="card-body">
                        <legend class="mb-2"><h6>${index + 1}: ${product.productName}</h6></legend>
                        <input
                          type="hidden"
                          name=${`products[${index}][productNumber]`}
                          value=${[product.productNumber]}
                        />
                        <div class="products-view_item input-group">
                          <div class="form-floating">
                            <input
                              name="products[${index}][unitPrice]"
                              id="products[${index}][unitPrice]"
                              type="number"
                              value=${product.unitPrice ?? 1}
                              placeholder=" "
                              required
                              class="form-control"
                              readonly=${isReadOnly}
                            />
                            <label for="products[${index}][unitPrice]">Unit Price</label>
                          </div>

                          <div class="form-floating">
                            <input
                              name="products[${index}][quantity]"
                              id="products[${index}][quantity]"
                              type="number"
                              value=${product.quantity ?? 1}
                              placeholder=" "
                              required
                              class="form-control"
                              readonly=${isReadOnly}
                            />
                            <label for="products[${index}][quantity]">Quantity</label>
                          </div>
                        </div>
                      </div>
                    </fieldset>
                  `,
                )}
              </fieldset>
            `
          : ''}
      </div>
    </div>
  `
}
