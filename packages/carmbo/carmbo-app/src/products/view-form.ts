import {html} from '../commons/html-templates.ts'
import type {NewProduct, Product} from './model.ts'

export function ProductCreateOrUpdateFormFields({
  product,
  operation,
}: {
  product: Product | NewProduct
  operation: 'read' | 'write'
}) {
  const maybeRo = operation === 'read' ? 'readonly' : ''

  return html`
    <div class="products-view_form-fields card">
      <div class="card-body">
        <div class="mt-3 form-floating">
          <input
            name="name"
            type="text"
            placeholder=" "
            required
            class="form-control"
            id="name"
            value="${product.name}"
            autocomplete="off"
            data-1p-ignore
            ${maybeRo}
          />
          <label for="name">Product Name</label>
        </div>

        <div class="mt-3 form-floating">
          <select name="productType" class="form-select" id="productType" ${maybeRo} required>
            <option value="recorded" selected=${product.productType === 'recorded'}>
              Recorded
            </option>
            <option value="challenge" selected=${product.productType === 'challenge'}>
              Challenge
            </option>
            <option value="club" selected=${product.productType === 'club'}>Club</option>
            <option value="bundle" selected=${product.productType === 'bundle'}>Bundle</option>
          </select>
          <label for="productType">Product Type</label>
        </div>

        <fieldset aria-label="Academy Courses" class="mt-3">
          ${product.academyCourses?.map(
            (courseId, i, l) => html`
              <div class="products-view_item input-group">
                <div class="form-floating">
                  <input
                    name="academyCourses[${i}]"
                    type="number"
                    value=${courseId}
                    placeholder=" "
                    required
                    class="form-control"
                    id="academyCourse-${i}"
                    ${maybeRo}
                  />
                  <label for="academyCourse-${i}">Academy Course ID</label>
                </div>
                ${operation === 'write' && html`<${RemoveButton} />`}
                ${operation === 'write' &&
                html`<${AddButton} itemsName="academyCourses" i=${i} l=${l} />`}
              </div>
            `,
          )}
          ${operation === 'write' &&
          html`<${AddButton}
            itemsName="academyCourses"
            humanName="Academy Courses"
            l=${product.academyCourses}
          />`}
        </fieldset>

        <fieldset aria-label="WhatsApp Groups" class="mt-3">
          ${product.whatsappGroups?.map(
            (group, i, l) => html`
              <div class="products-view_item input-group">
                <div class="form-floating">
                  <input
                    name="whatsappGroups[${i}][id]"
                    type="text"
                    value=${group.id}
                    placeholder=" "
                    required
                    class="form-control"
                    id="whatsappGroup-${i}"
                    pattern="[0-9]+@g\\.us"
                    ${maybeRo}
                  />
                  <label for="whatsappGroup-${i}">WhatsApp Group ID</label>
                </div>
                <div class="form-floating">
                  <input
                    name="whatsappGroups[${i}][timedMessagesGoogleSheetUrl]"
                    type="url"
                    value=${group.timedMessagesGoogleSheetUrl}
                    placeholder=" "
                    required
                    class="form-control"
                    id="whatsappGroupUrl-${i}"
                    ${maybeRo}
                  />
                  <label for="whatsappGroupUrl-${i}">Messages Google Sheet URL</label>
                </div>
                ${operation === 'write' && html`<${RemoveButton} />`}
                ${operation === 'write' &&
                html`<${AddButton} itemsName="whatsappGroups" i=${i} l=${l} />`}
              </div>
            `,
          )}
          ${operation === 'write' &&
          html`<${AddButton}
            itemsName="whatsappGroups"
            humanName="WhatsApp Groups"
            l=${product.whatsappGroups}
          />`}
        </fieldset>

        <fieldset aria-label="Facebook Groups" class="mt-3">
          ${product.facebookGroups?.map(
            (groupId, i, l) => html`
              <div class="products-view_item input-group">
                <div class="form-floating">
                  <input
                    name="facebookGroups[${i}]"
                    type="text"
                    value=${groupId}
                    placeholder=" "
                    required
                    class="form-control"
                    id="facebookGroup-${i}"
                    ${maybeRo}
                  />
                  <label for="facebookGroup-${i}">Facebook Group ID</label>
                </div>
                ${operation === 'write' && html`<${RemoveButton} />`}
                ${operation === 'write' &&
                html`<${AddButton} itemsName="facebookGroups" i=${i} l=${l} />`}
              </div>
            `,
          )}
          ${operation === 'write' &&
          html`<${AddButton}
            itemsName="facebookGroups"
            humanName="Facebook Groups"
            l=${product.facebookGroups}
          />`}
        </fieldset>

        <div class="mt-3 form-floating">
          <input
            name="smooveListId"
            type="number"
            placeholder=" "
            class="form-control"
            id="smooveListId"
            value="${product.smooveListId ?? ''}"
            ${maybeRo}
          />
          <label for="smooveListId">Smoove List ID</label>
        </div>

        <div class="mt-3 form-floating">
          <input
            name="smooveCancellingListId"
            type="number"
            placeholder=" "
            class="form-control"
            id="smooveCancellingListId"
            value="${product.smooveCancellingListId ?? ''}"
            ${maybeRo}
          />
          <label for="smooveCancellingListId">Smoove Cancelling List ID</label>
        </div>

        <div class="mt-3 form-floating">
          <input
            name="smooveCancelledListId"
            type="number"
            placeholder=" "
            class="form-control"
            id="smooveCancelledListId"
            value="${product.smooveCancelledListId ?? ''}"
            ${maybeRo}
          />
          <label for="smooveCancelledListId">Smoove Cancelled List ID</label>
        </div>

        <div class="mt-3 form-floating">
          <input
            name="smooveRemovedListId"
            type="number"
            placeholder=" "
            class="form-control"
            id="smooveRemovedListId"
            value="${product.smooveRemovedListId ?? ''}"
            ${maybeRo}
          />
          <label for="smooveRemovedListId">Smoove Removed List ID</label>
        </div>

        <div class="mt-3 form-floating">
          <input
            name="cardcomProductId"
            type="text"
            placeholder=" "
            class="form-control"
            id="cardcomProductId"
            value="${product.cardcomProductId ?? ''}"
            ${maybeRo}
          />
          <label for="cardcomProductId">Cardcom Product ID</label>
        </div>
      </div>
    </div>
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
      class="btn products-view_add"
      hx-post=""
      hx-target="closest .products-view_form-fields"
      hx-swap="outerHTML"
      hx-trigger="click delay:1ms"
      hx-headers=${JSON.stringify({'X-Add-Item': itemsName})}
      aria-label="Add"
      style=${isOnItsOwn || i === l.length - 1 ? '' : 'visibility: hidden'}
    >
      <svg class="feather pe-none" viewbox="0 0 24 24">
        <use href="/public/layouts/common-style/plus-circle.svg" />
      </svg>
      ${isOnItsOwn ? html`<span class="ms-1">${humanName}</span>` : ''}
    </button>
  `
}

function RemoveButton() {
  return html`
    <button
      class="products-view_trash btn btn-outline-secondary"
      hx-post=""
      hx-target="closest .products-view_form-fields"
      hx-swap="outerHTML"
      hx-trigger="click delay:1ms"
      aria-label="Remove"
    >
      <svg class="feather pe-none" viewbox="0 0 24 24">
        <use href="/public/layouts/common-style/minus-circle.svg" />
      </svg>
    </button>
  `
}
