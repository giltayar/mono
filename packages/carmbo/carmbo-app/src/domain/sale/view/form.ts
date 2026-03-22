import {html} from '../../../commons/html-templates.ts'
import {getFixedT} from 'i18next'
import {generateItemTitle} from '../../../commons/view-commons.ts'
import type {NewSale, Sale} from '../model/model.ts'
import {version} from '../../../commons/version.ts'

export function SalesFormFields({
  sale,
  operation,
}: {
  sale: Sale | NewSale
  saleNumber: number | undefined
  operation: 'read' | 'write'
}) {
  const isReadOnly = operation === 'read' || !!sale.cardcomInvoiceDocumentUrl
  const isNotesReadOnly = operation === 'read'
  const t = getFixedT(null, 'sales')

  return html`
    <div class="sales-view_form-fields card">
      <div class="card-body">
        <div class="row">
          <div class="col form-floating mb-3">
            <input
              class="form-control"
              type="text"
              id="salesEventNumber"
              name="salesEventNumber"
              hx-post=""
              hx-target="closest .sales-view_form-fields"
              hx-swap="outerHTML"
              hx-trigger="change delay:1ms"
              value=${generateItemTitle(sale.salesEventNumber, sale.salesEventName)}
              list="sales-event-list"
              placeholder=" "
              required
              readonly=${isReadOnly}
            />
            <label for="salesEventNumber" class="form-label">${t('form.salesEvent')}</label>
            <datalist
              id="sales-event-list"
              hx-trigger="input changed from:#salesEventNumber"
              hx-target="this"
              hx-vals='js:{q: document.getElementById("salesEventNumber").value}'
              hx-get="/sales/query/sales-event-list"
            ></datalist>
          </div>
          <div class="col-auto link">
            ${sale.salesEventNumber
              ? html`<a href="/sales-events/${sale.salesEventNumber}" title="View sales event"
                  ><object
                    type="image/svg+xml"
                    class="feather feather-small pe-none"
                    data=${`/src/${version}/layout/style/link.svg`}
                  ></object>
                </a>`
              : ''}
          </div>
        </div>
        <div class="mb-3">
          <div class="row">
            <div class="col form-floating">
              <${StudentInput}
                studentNumber=${sale.studentNumber}
                studentName=${sale.studentName}
              />
              <label for="studentNumber" class="form-label">${t('form.student')}</label>
            </div>
            <datalist
              id="student-list"
              hx-trigger="input changed from:#studentNumber"
              hx-target="this"
              hx-vals='js:{q: document.getElementById("studentNumber").value}'
              hx-get="/sales/query/student-list"
            ></datalist>
            <div class="col-auto link">
              ${sale.studentNumber
                ? html`<a href="/students/${sale.studentNumber}" title="View student"
                    ><object
                      type="image/svg+xml"
                      class="feather feather-small pe-none"
                      data=${`/src/${version}/layout/style/link.svg`}
                    ></object>
                  </a>`
                : ''}
            </div>
            ${!isReadOnly
              ? html`<div class="col-auto">
                  <button
                    type="button"
                    class="btn btn-outline-secondary btn-sm"
                    hx-get="/sales/student-search-dialog"
                    hx-target="#student-search-dialog-container"
                    hx-swap="innerHTML"
                  >
                    ${t('form.searchCreate')}
                  </button>
                </div>`
              : ''}
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
              >${t('form.standingOrder')}${sale.isStandingOrder ? ':' : ''}
            </label>
          </div>
          ${sale.isStandingOrder
            ? html`<div class="col">
                <input class="form-control" type="text" value=${sale.recurringOrderId} readonly />
              </div>`
            : undefined}
        </div>
        ${sale.products && sale.products.length > 0
          ? html`
              <fieldset class="mb-3">
                <legend><h6>${t('form.products')}</h6></legend>
                ${sale.products.map(
                  (product, index) => html`
                    <fieldset class="card mb-2">
                      <div class="card-body">
                        <legend class="mb-2">
                          <h6>
                            ${index + 1}: ${product.productName}
                            <a href="/products/${product.productNumber}" title="View product"
                              ><object
                                type="image/svg+xml"
                                class="feather feather-small pe-none"
                                data=${`/src/${version}/layout/style/link.svg`}
                              ></object>
                            </a>
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
                            <label for="products[${index}][unitPrice]"
                              >${t('form.unitPrice')}</label
                            >
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
                            <label for="products[${index}][quantity]">${t('form.quantity')}</label>
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
          <label for="cardcomInvoiceNumber" class="form-label"
            >${t('form.cardcomInvoiceNumber')}</label
          >
          <div class="input-group">
            <input
              type="number"
              class="form-control"
              id="cardcomInvoiceNumber"
              name="cardcomInvoiceNumber"
              value=${sale.cardcomInvoiceNumber}
              readonly=${isReadOnly}
            />
            ${!isReadOnly
              ? html`<button
                  type="button"
                  class="btn btn-outline-secondary create-student-from-invoice"
                  hx-post="/sales/create-student-from-invoice"
                  hx-target="closest .sales-view_form-fields"
                  hx-swap="outerHTML"
                  hx-include="closest form"
                  hx-indicator=".operation-spinner"
                >
                  ${t('form.createStudentFromInvoice')}
                </button>`
              : ''}
          </div>
          ${sale.cardcomInvoiceDocumentUrl
            ? html`<${InvoiceDocumentUrlLink} url=${sale.cardcomInvoiceDocumentUrl} />`
            : undefined}
        </div>
        <div
          class="mb-3"
          style=${operation === 'write' || sale.transactionDescription ? '' : 'display: none'}
        >
          <label for="transactionDescription" class="form-label">${t('form.description')}</label>
          <input
            type="text"
            class="form-control"
            id="transactionDescription"
            name="transactionDescription"
            value=${sale.transactionDescription ?? ''}
            list="description-options"
            readonly=${isReadOnly}
          />
          <datalist id="description-options">
            <option value="שולם בביט" />
            <option value="שולם בפייבוקס" />
            <option value="שולם במזומן" />
            <option value="שולם בהעברה בנקאית" />
          </datalist>
        </div>
        <div class="mb-3">
          <label for="finalSaleRevenue" class="form-label">${t('form.finalSaleRevenue')}</label>
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
        <div class="mb-3 form-floating">
          <textarea
            class="form-control"
            id="sale-notes"
            name="notes"
            placeholder=" "
            style="height: 120px"
            readonly=${isNotesReadOnly}
          >
${sale.notes ?? ''}</textarea
          >
          <label for="sale-notes">${t('form.notes')}</label>
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
            <label class="form-check-label" for="delivery-address">${t('form.hasDelivery')}</label>
          </div>
        </div>
        <fieldset class="mb-3" style="display: ${sale.hasDeliveryAddress ? 'block' : 'none'}">
          <legend><h6>${t('form.deliveryAddress')}</h6></legend>
          <div class="row">
            <div class="col-md-6">
              <label for="delivery-address-street" class="form-label">${t('form.street')}</label>
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
              <label for="delivery-address-street-number" class="form-label"
                >${t('form.streetNumber')}</label
              >
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
              <label for="delivery-address-entrance" class="form-label"
                >${t('form.entrance')}</label
              >
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
              <label for="delivery-address-city" class="form-label">${t('form.city')}</label>
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
              <label for="delivery-address-floor" class="form-label">${t('form.floor')}</label>
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
                >${t('form.apartmentNumber')}</label
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
              <label for="delivery-address-contact-phone" class="form-label"
                >${t('form.contactPhone')}</label
              >
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
              <label for="delivery-address-notes" class="form-label"
                >${t('form.deliveryNotes')}</label
              >
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
  const t = getFixedT(null, 'sales')
  return html`<a target="_blank" href=${url}>${t('form.viewInvoice')} </a
    ><object
      type="image/svg+xml"
      class="feather feather-small pe-none"
      data=${`/src/${version}/layout/style/external-link.svg`}
    ></object>`
}

export function StudentInput({
  studentNumber,
  studentName,
}: {
  studentNumber: number
  studentName: string
}) {
  return html`<input
    class="form-control"
    id="studentNumber"
    name="studentNumber"
    list="student-list"
    hx-post=""
    hx-target="closest .sales-view_form-fields"
    hx-swap="outerHTML"
    hx-trigger="change"
    value=${generateItemTitle(studentNumber, studentName)}
    required
    placeholder=" "
  />`
}
