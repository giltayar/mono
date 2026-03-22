import {requestContext} from '@fastify/request-context'
import {html} from '../../../commons/html-templates.ts'
import {generateItemTitle} from '../../../commons/view-commons.ts'
import type {SalesEvent} from '../model/model.ts'
import type {OngoingSalesEvent} from './model.ts'
import {version} from '../../../commons/version.ts'
import {getFixedT} from 'i18next'

const t = getFixedT(null, 'salesEvent')

export function SalesEventCreateOrUpdateFormFields({
  salesEvent,
  operation,
}: {
  salesEvent: SalesEvent | OngoingSalesEvent
  operation: 'read' | 'write'
}) {
  const isReadOnly = operation === 'read'
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
            value=${salesEvent.name}
            autocomplete="off"
            data-1p-ignore
            readonly=${isReadOnly}
          />
          <label for="name">${t('form.salesEventName')}</label>
        </div>

        <div class="mt-3 form-floating">
          <input
            name="fromDate"
            type="date"
            placeholder=" "
            class="form-control"
            id="fromDate"
            value=${salesEvent.fromDate ? formatDateForInput(salesEvent.fromDate) : ''}
            readonly=${isReadOnly}
          />
          <label for="fromDate">${t('form.fromDate')}</label>
        </div>

        <div class="mt-3 form-floating">
          <input
            name="toDate"
            type="date"
            placeholder=" "
            class="form-control"
            id="toDate"
            value=${salesEvent.toDate ? formatDateForInput(salesEvent.toDate) : ''}
            readonly=${isReadOnly}
          />
          <label for="toDate">${t('form.toDate')}</label>
        </div>

        <div class="mt-3 form-floating">
          <input
            name="landingPageUrl"
            type="url"
            placeholder=" "
            class="form-control"
            id="landingPageUrl"
            value=${salesEvent.landingPageUrl ?? ''}
            readonly=${isReadOnly}
          />
          <label for="landingPageUrl">${t('form.landingPageUrl')}</label>
        </div>

        <fieldset aria-label=${t('form.productsForSale')} class="mt-3">
          ${salesEvent.productsForSale?.map(
            (productForSaleId, i, l) => html`
              <div class="sales-events-view_item input-group">
                <div class="form-floating">
                  <input
                    name="productsForSale[${i}]"
                    id="productsForSale-${i}_value"
                    type="hidden"
                    value=${productForSaleId}
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
                    hx-post=""
                    hx-target="closest .sales-events-view_form-fields"
                    hx-swap="outerHTML"
                    hx-trigger="change delay:1ms"
                  />
                  <label for="productsForSale-${i}">${t('form.productForSale')}</label>
                </div>
                ${operation === 'write' && html`<${RemoveButton} />`}
                ${operation === 'write' &&
                html`<${AddButton} itemsName="productsForSale" i=${i} l=${l} />`}
                ${productForSaleId
                  ? html`<a
                      class="align-self-center ms-1"
                      href="/products/${productForSaleId}"
                      title="View product"
                      ><object
                        type="image/svg+xml"
                        class="feather feather-small pe-none"
                        data=${`/src/${version}/layout/style/link.svg`}
                      ></object>
                    </a>`
                  : ''}
              </div>
            `,
          )}
          ${operation === 'write' &&
          html`<${AddButton}
            itemsName="productsForSale"
            humanName=${t('form.productsForSale')}
            l=${salesEvent.productsForSale}
          />`}
        </fieldset>

        <div class="mt-3 form-floating">
          <textarea
            name="notes"
            placeholder=" "
            class="form-control"
            id="notes"
            style="height: 120px"
            readonly=${isReadOnly}
          >
${salesEvent.notes ?? ''}</textarea
          >
          <label for="notes">${t('form.notes')}</label>
        </div>
      </div>
    </div>
    <datalist id="products-list">
      ${products.map(
        (p) => html`<option data-id=${p.id} value=${generateItemTitle(p.id, p.name)} />`,
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
      <object
        type="image/svg+xml"
        class="feather pe-none"
        data=${`/src/${version}/layout/style/plus-circle.svg`}
      ></object>
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
      <object
        type="image/svg+xml"
        class="feather pe-none"
        data=${`/src/${version}/layout/style/minus-circle.svg`}
      ></object>
    </button>
  `
}

function formatDateForInput(date: Date): string {
  const d = new Date(date)
  return d.toISOString().split('T')[0]
}
