import {html} from '../../../commons/html-templates.ts'
import {generateItemTitle} from '../../../commons/view-commons.ts'
import type {NewProduct, Product} from '../model.ts'
import type {OngoingProduct} from './model.ts'
import {requestContext} from '@fastify/request-context'

export function ProductCreateOrUpdateFormFields({
  product,
  operation,
}: {
  product: Product | OngoingProduct | NewProduct
  operation: 'read' | 'write'
}) {
  const courses = requestContext.get('courses')!
  const whatsappGroups = requestContext.get('whatsappGroups')!
  const smooveLists = requestContext.get('smooveLists')!
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
                    id="academyCourse-${i}_value"
                    type="hidden"
                    value=${courseId}
                  />
                  <input
                    id="academyCourse-${i}"
                    value=${courseId
                      ? generateItemTitle(courseId, courses.find((c) => c.id === courseId)?.name)
                      : ''}
                    list="academy-courses-list"
                    type="text"
                    placeholder=" "
                    required
                    class="form-control pick-item-title"
                    spellcheck="false"
                    autocorrect="off"
                    autocomplete="off"
                    autocapitalize="off"
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
                    id="whatsappGroup-${i}_value"
                    type="hidden"
                    value=${group.id}
                  />
                  <input
                    type="text"
                    list="whatsapp-groups-list"
                    placeholder=" "
                    required
                    class="form-control pick-item-title"
                    id="whatsappGroup-${i}"
                    spellcheck="false"
                    autocorrect="off"
                    autocomplete="off"
                    autocapitalize="off"
                    value=${group.id
                      ? generateItemTitle(
                          group.id,
                          whatsappGroups.find((g) => g.id === group.id)?.name,
                        )
                      : ''}
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
            id="smooveListId_value"
            type="hidden"
            value=${product.smooveListId ?? ''}
          />
          <input
            type="text"
            list="smoove-lists-list"
            placeholder=" "
            class="form-control pick-item-title"
            id="smooveListId"
            spellcheck="false"
            autocorrect="off"
            autocomplete="off"
            autocapitalize="off"
            value=${product.smooveListId
              ? generateItemTitle(
                  product.smooveListId,
                  smooveLists.find((g) => g.id === product.smooveListId)?.name,
                )
              : ''}
            ${maybeRo}
          />
          <label for="smooveListId">Smoove List ID</label>
        </div>

        <div class="mt-3 form-floating">
          <input
            name="smooveCancellingListId"
            id="smooveCancellingListId_value"
            type="hidden"
            value=${product.smooveCancellingListId ?? ''}
          />
          <input
            type="text"
            list="smoove-lists-list"
            placeholder=" "
            class="form-control pick-item-title"
            id="smooveCancellingListId"
            spellcheck="false"
            autocorrect="off"
            autocomplete="off"
            autocapitalize="off"
            value=${product.smooveCancellingListId
              ? generateItemTitle(
                  product.smooveCancellingListId,
                  smooveLists.find((g) => g.id === product.smooveCancellingListId)?.name,
                )
              : ''}
            ${maybeRo}
          />
          <label for="smooveCancellingListId">Smoove Cancelling List ID</label>
        </div>

        <div class="mt-3 form-floating">
          <input
            name="smooveCancelledListId"
            id="smooveCancelledListId_value"
            type="hidden"
            value=${product.smooveCancelledListId ?? ''}
          />
          <input
            type="text"
            list="smoove-lists-list"
            placeholder=" "
            class="form-control pick-item-title"
            id="smooveCancelledListId"
            spellcheck="false"
            autocorrect="off"
            autocomplete="off"
            autocapitalize="off"
            value=${product.smooveCancelledListId
              ? generateItemTitle(
                  product.smooveCancelledListId,
                  smooveLists.find((g) => g.id === product.smooveCancelledListId)?.name,
                )
              : ''}
            ${maybeRo}
          />
          <label for="smooveCancelledListId">Smoove Cancelled List ID</label>
        </div>

        <div class="mt-3 form-floating">
          <input
            name="smooveRemovedListId"
            id="smooveRemovedListId_value"
            type="hidden"
            value=${product.smooveRemovedListId ?? ''}
          />
          <input
            type="text"
            list="smoove-lists-list"
            placeholder=" "
            class="form-control pick-item-title"
            id="smooveRemovedListId"
            spellcheck="false"
            autocorrect="off"
            autocomplete="off"
            autocapitalize="off"
            value=${product.smooveRemovedListId
              ? generateItemTitle(
                  product.smooveRemovedListId,
                  smooveLists.find((g) => g.id === product.smooveRemovedListId)?.name,
                )
              : ''}
            ${maybeRo}
          />
          <label for="smooveRemovedListId">Smoove Removed List ID</label>
        </div>
      </div>
    </div>
    <datalist id="academy-courses-list">
      ${courses.map(
        (course) =>
          html`<option
            data-id="${course.id}"
            value="${generateItemTitle(course.id, course.name)}"
          />`,
      )}
    </datalist>
    <datalist id="whatsapp-groups-list">
      ${whatsappGroups.map(
        (group) =>
          html`<option data-id="${group.id}" value="${generateItemTitle(group.id, group.name)}" />`,
      )}
    </datalist>
    <datalist id="smoove-lists-list">
      ${smooveLists.map(
        (list) =>
          html`<option data-id="${list.id}" value="${generateItemTitle(list.id, list.name)}" />`,
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
        <use href="/src/layout/style/plus-circle.svg" />
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
        <use href="/src/layout/style/minus-circle.svg" />
      </svg>
    </button>
  `
}
