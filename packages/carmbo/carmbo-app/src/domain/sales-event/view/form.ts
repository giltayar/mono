import {requestContext} from '@fastify/request-context'
import {html} from '../../../commons/html-templates.ts'
import {generateItemTitle} from '../../../commons/view-commons.ts'
import type {SalesEvent} from '../model.ts'
import type {OngoingSalesEvent} from './model.ts'

export function SalesEventCreateOrUpdateFormFields({
  salesEvent,
  operation,
}: {
  salesEvent: SalesEvent | OngoingSalesEvent
  operation: 'read' | 'write'
}) {
  const maybeRo = operation === 'read' ? 'readonly' : ''
  const products = requestContext.get('products')!

  return html`
    <div class="sales-events-view_form-fields card">
      <div class="card-body">
        <div class="mt-3 form-floating">
          <input
            name="name"
            type="text"
            placeholder=" "
            required
            class="form-control"
            id="name"
            value="${salesEvent.name}"
            autocomplete="off"
            data-1p-ignore
            ${maybeRo}
          />
          <label for="name">Sales Event Name</label>
        </div>

        <div class="mt-3 form-floating">
          <input
            name="fromDate"
            type="date"
            placeholder=" "
            class="form-control"
            id="fromDate"
            value="${salesEvent.fromDate ? formatDateForInput(salesEvent.fromDate) : ''}"
            ${maybeRo}
          />
          <label for="fromDate">From Date</label>
        </div>

        <div class="mt-3 form-floating">
          <input
            name="toDate"
            type="date"
            placeholder=" "
            class="form-control"
            id="toDate"
            value="${salesEvent.toDate ? formatDateForInput(salesEvent.toDate) : ''}"
            ${maybeRo}
          />
          <label for="toDate">To Date</label>
        </div>

        <div class="mt-3 form-floating">
          <input
            name="landingPageUrl"
            type="url"
            placeholder=" "
            class="form-control"
            id="landingPageUrl"
            value="${salesEvent.landingPageUrl ?? ''}"
            ${maybeRo}
          />
          <label for="landingPageUrl">Landing Page URL</label>
        </div>

        <fieldset aria-label="Products for Sale" class="mt-3">
          ${salesEvent.productsForSale?.map(
            (productForSaleId, i, l) => html`
              <div class="sales-events-view_item input-group">
                <div class="form-floating">
                  <input
                    name="productsForSale[${i}]"
                    id="productsForSale-${i}_value"
                    type="hidden"
                    value="${productForSaleId}"
                  />
                  <input
                    id="productsForSale-${i}"
                    value=${productForSaleId
                      ? generateItemTitle(
                          productForSaleId,
                          products.find((p) => p.id === productForSaleId)?.name,
                        )
                      : ''}
                    list="products-list"
                    type="text"
                    placeholder=" "
                    required
                    class="form-control pick-item-title"
                  />
                  <label for="productsForSale-${i}">Product For Sale</label>
                </div>
                ${operation === 'write' && html`<${RemoveButton} />`}
                ${operation === 'write' &&
                html`<${AddButton} itemsName="productsForSale" i=${i} l=${l} />`}
              </div>
            `,
          )}
          ${operation === 'write' &&
          html`<${AddButton}
            itemsName="productsForSale"
            humanName="Products for Sale"
            l=${salesEvent.productsForSale}
          />`}
        </fieldset>
      </div>
    </div>
    <datalist id="products-list">
      ${products.map(
        (p) => html`<option data-id="${p.id}" value="${generateItemTitle(p.id, p.name)}" />`,
      )}
    </datalist>
  `
}

function AddButton({
  itemsName,
  i,
  l,
  humanName,
}: {
  itemsName: string
  i?: number
  l: unknown[]
  humanName?: string
}) {
  const isOnItsOwn = i === undefined && (!l || l.length === 0)
  return html`
    <button
      class="btn sales-events-view_add"
      hx-post=""
      hx-target="closest .sales-events-view_form-fields"
      hx-swap="outerHTML"
      hx-trigger="click delay:1ms"
      hx-headers=${JSON.stringify({'X-Add-Item': itemsName})}
      aria-label="Add"
      style=${isOnItsOwn || i === l.length - 1 ? '' : 'visibility: hidden'}
    >
      <svg class="feather pe-none" viewbox="0 0 24 24">
        <use href="/src/layout/style/plus-circle.svg" />
      </svg>
      ${isOnItsOwn ? html`<span class="ms-1">${humanName}</span>` : ''}
    </button>
  `
}

function RemoveButton() {
  return html`
    <button
      class="sales-events-view_trash btn btn-outline-secondary"
      hx-post=""
      hx-target="closest .sales-events-view_form-fields"
      hx-swap="outerHTML"
      hx-trigger="click delay:1ms"
      aria-label="Remove"
    >
      <svg class="feather pe-none" viewbox="0 0 24 24">
        <use href="/src/layout/style/minus-circle.svg" />
      </svg>
    </button>
  `
}

function formatDateForInput(date: Date): string {
  const d = new Date(date)
  return d.toISOString().split('T')[0]
}
