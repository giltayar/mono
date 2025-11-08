import {html} from '../../../commons/html-templates.ts'
import {generateItemTitle} from '../../../commons/view-commons.ts'
import type {NewSale, Sale} from '../model.ts'

export function SalesFormFields({
  sale,
  operation,
}: {
  sale: Sale | NewSale
  saleNumber: number | undefined
  operation: 'read' | 'write'
}) {
  const isReadOnly = operation === 'read' || !!sale.cardcomInvoiceDocumentUrl

  return html`
    <div class="sales-view_form-fields card">
      <div class="card-body">
        <div class="row">
          <div class="col form-floating mb-3">
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
            <label for="salesEventNumber" class="form-label">Sales Event</label>
            <datalist id="sales-event-list"> </datalist>
          </div>
          <div class="col-auto link">
            ${sale.salesEventNumber
              ? html`<a href="/sales-events/${sale.salesEventNumber}" title="View sales event"
                  ><svg class="feather feather-small pe-none" viewbox="0 0 24 24">
                    <use href="/src/layout/style/link.svg" /></svg
                ></a>`
              : ''}
          </div>
        </div>
        <div class="mb-3">
          <div class="row">
            <div class="col form-floating">
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
                placeholder=" "
                readonly=${isReadOnly}
              />
              <label for="studentNumber" class="form-label">Student</label>
            </div>
            <div class="col-auto link">
              ${sale.studentNumber
                ? html`<a href="/students/${sale.studentNumber}" title="View student"
                    ><svg class="feather feather-small pe-none" viewbox="0 0 24 24">
                      <use href="/src/layout/style/link.svg" /></svg
                  ></a>`
                : ''}
            </div>
          </div>
        </div>
        <div class="mb-3 row">
          <div class="col">
            <input
              class="form-check-input"
              type="checkbox"
              value=${sale.isStandingOrder ? 'on' : undefined}
              id="is-standing-order-checkbox"
              readonly
              onclick="return false"
            />
            <label class="ms-2 form-check-label" for="is-standing-order-checkbox"
              >Standing Order${sale.isStandingOrder ? ':' : ''}
            </label>
          </div>
          ${sale.isStandingOrder
            ? html`<div class="col">
                <input class="form-control" type="text" value=${sale.recurringOrderId} readonly />
              </div>`
            : undefined}
        </div>
        <datalist id="student-list"> </datalist>
        ${sale.products && sale.products.length > 0
          ? html`
              <fieldset class="mb-3">
                <legend><h6>Products</h6></legend>
                ${sale.products.map(
                  (product, index) => html`
                    <fieldset class="card mb-2">
                      <div class="card-body">
                        <legend class="mb-2">
                          <h6>
                            ${index + 1}: ${product.productName}
                            <a href="/products/${product.productNumber}" title="View product"
                              ><svg class="feather feather-small pe-none" viewbox="0 0 24 24">
                                <use href="/src/layout/style/link.svg" /></svg
                            ></a>
                          </h6>
                        </legend>
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
        <div class="mb-3">
          <label for="cardcomInvoiceNumber" class="form-label">Cardcom Invoice Number</label>
          <input
            type="number"
            class="form-control"
            id="cardcomInvoiceNumber"
            name="cardcomInvoiceNumber"
            value=${sale.cardcomInvoiceNumber}
            readonly=${isReadOnly}
          />${sale.cardcomInvoiceDocumentUrl
            ? html`<${InvoiceDocumentUrlLink} url=${sale.cardcomInvoiceDocumentUrl} />`
            : undefined}
        </div>
        <div class="mb-3">
          <label for="finalSaleRevenue" class="form-label">Final Sale Revenue</label>
          <input
            type="number"
            class="form-control"
            id="finalSaleRevenue"
            name="finalSaleRevenue"
            value=${sale.finalSaleRevenue}
            readonly=${isReadOnly}
            required
          />
        </div>
        <div class="mb-3">
          <div class="form-check">
            <input
              class="form-check-input"
              type="checkbox"
              checked=${sale.hasDeliveryAddress}
              value="on"
              id="delivery-address"
              name="hasDeliveryAddress"
              hx-post=""
              hx-target="closest .sales-view_form-fields"
              hx-swap="outerHTML"
              hx-trigger="change delay:100ms"
              readonly=${isReadOnly}
              onclick=${isReadOnly ? 'return false' : undefined}
            />
            <label class="form-check-label" for="delivery-address">Has delivery</label>
          </div>
        </div>
        <fieldset class="mb-3" style="display: ${sale.hasDeliveryAddress ? 'block' : 'none'}">
          <legend><h6>Delivery Address</h6></legend>
          <div class="row">
            <div class="col-md-6">
              <label for="delivery-address-street" class="form-label">Street</label>
              <input
                type="text"
                class="form-control"
                id="delivery-address-street"
                name="deliveryAddress[street]"
                value=${sale.deliveryAddress?.street ?? ''}
                readonly=${isReadOnly}
              />
            </div>
            <div class="col-md-3">
              <label for="delivery-address-street-number" class="form-label">Street Number</label>
              <input
                type="text"
                class="form-control"
                id="delivery-address-street-number"
                name="deliveryAddress[streetNumber]"
                value=${sale.deliveryAddress?.streetNumber ?? ''}
                readonly=${isReadOnly}
              />
            </div>
            <div class="col-md-3">
              <label for="delivery-address-entrance" class="form-label">Entrance</label>
              <input
                type="text"
                class="form-control"
                id="delivery-address-entrance"
                name="deliveryAddress[entrance]"
                value=${sale.deliveryAddress?.entrance ?? ''}
                readonly=${isReadOnly}
              />
            </div>
          </div>
          <div class="row">
            <div class="col-md-12">
              <label for="delivery-address-city" class="form-label">City</label>
              <input
                type="text"
                class="form-control"
                id="delivery-address-city"
                name="deliveryAddress[city]"
                value=${sale.deliveryAddress?.city ?? ''}
                readonly=${isReadOnly}
              />
            </div>
          </div>
          <div class="row">
            <div class="col-md-6">
              <label for="delivery-address-floor" class="form-label">Floor</label>
              <input
                type="text"
                class="form-control"
                id="delivery-address-floor"
                name="deliveryAddress[floor]"
                value=${sale.deliveryAddress?.floor ?? ''}
                readonly=${isReadOnly}
              />
            </div>
            <div class="col-md-6">
              <label for="delivery-address-apartment-number" class="form-label"
                >Apartment Number</label
              >
              <input
                type="text"
                class="form-control"
                id="delivery-address-apartment-number"
                name="deliveryAddress[apartmentNumber]"
                value=${sale.deliveryAddress?.apartmentNumber ?? ''}
                readonly=${isReadOnly}
              />
            </div>
          </div>
          <div class="row">
            <div class="col-md-12">
              <label for="delivery-address-contact-phone" class="form-label">Contact Phone</label>
              <input
                type="tel"
                class="form-control"
                id="delivery-address-contact-phone"
                name="deliveryAddress[contactPhone]"
                value=${sale.deliveryAddress?.contactPhone ?? ''}
                readonly=${isReadOnly}
              />
            </div>
          </div>
          <div class="row">
            <div class="col-md-12">
              <label for="delivery-address-notes" class="form-label">Notes</label>
              <textarea
                class="form-control"
                id="delivery-address-notes"
                name="deliveryAddress[notesToDeliveryPerson]"
                rows="2"
                readonly=${isReadOnly}
              >
${sale.deliveryAddress?.notesToDeliveryPerson ?? ''}</textarea
              >
            </div>
          </div>
        </fieldset>
      </div>
    </div>
  `
}

function InvoiceDocumentUrlLink({url}: {url: string}) {
  return html`<a target="_blank" href=${url}>View Invoice </a
    ><svg class="feather" viewbox="0 0 24 24">
      <use href="/src/layout/style/external-link.svg" />
    </svg>`
}
