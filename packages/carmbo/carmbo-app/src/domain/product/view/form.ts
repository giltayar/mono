import {html} from '../../../commons/html-templates.ts'
import {generateItemTitle} from '../../../commons/view-commons.ts'
import type {NewProduct, Product} from '../model.ts'
import type {OngoingProduct} from './model.ts'
import {requestContext} from '@fastify/request-context'
import {version} from '../../../commons/version.ts'
import {getFixedT} from 'i18next'

const t = getFixedT(null, 'product')

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
  const isReadOnly = operation === 'read'

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
            value=${product.name}
            autocomplete="off"
            data-1p-ignore
            readonly=${isReadOnly}
          />
          <label for="name">${t('form.productName')}</label>
        </div>

        <div class="mt-3 form-floating">
          <select
            name="productType"
            class="form-select"
            id="productType"
            readonly=${isReadOnly}
            required
          >
            <option value="recorded" selected=${product.productType === 'recorded'}>
              ${t('form.recorded')}
            </option>
            <option value="challenge" selected=${product.productType === 'challenge'}>
              ${t('form.challenge')}
            </option>
            <option value="club" selected=${product.productType === 'club'}>
              ${t('form.club')}
            </option>
            <option value="bundle" selected=${product.productType === 'bundle'}>
              ${t('form.bundle')}
            </option>
          </select>
          <label for="productType">${t('form.productType')}</label>
        </div>

        <fieldset aria-label=${t('form.academyCourses')} class="mt-3">
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
                    readonly=${isReadOnly}
                  />
                  <label for="academyCourse-${i}">${t('form.academyCourseId')}</label>
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
            humanName=${t('form.academyCourses')}
            l=${product.academyCourses}
          />`}
        </fieldset>

        <fieldset aria-label=${t('form.whatsappGroups')} class="mt-3">
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
                    readonly=${isReadOnly}
                  />
                  <label for="whatsappGroup-${i}">${t('form.whatsappGroupId')}</label>
                </div>
                <div class="form-floating">
                  <input
                    name="whatsappGroups[${i}][timedMessagesGoogleSheetUrl]"
                    type="url"
                    value=${group.timedMessagesGoogleSheetUrl}
                    placeholder=" "
                    class="form-control"
                    id="whatsappGroupUrl-${i}"
                    readonly=${isReadOnly}
                  />
                  <label for="whatsappGroupUrl-${i}">${t('form.messagesGoogleSheetUrl')}</label>
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
            humanName=${t('form.whatsappGroups')}
            l=${product.whatsappGroups}
          />`}
        </fieldset>

        <fieldset aria-label=${t('form.facebookGroups')} class="mt-3">
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
                    readonly=${isReadOnly}
                  />
                  <label for="facebookGroup-${i}">${t('form.facebookGroupId')}</label>
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
            humanName=${t('form.facebookGroups')}
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
            readonly=${isReadOnly}
          />
          <label for="smooveListId">${t('form.smooveListId')}</label>
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
            readonly=${isReadOnly}
          />
          <label for="smooveCancellingListId">${t('form.smooveCancellingListId')}</label>
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
            readonly=${isReadOnly}
          />
          <label for="smooveCancelledListId">${t('form.smooveCancelledListId')}</label>
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
            readonly=${isReadOnly}
          />
          <label for="smooveRemovedListId">${t('form.smooveRemovedListId')}</label>
        </div>

        <div class="mt-3 form-floating">
          <textarea
            name="notes"
            placeholder=" "
            class="form-control"
            id="notes"
            style="height: 120px"
            readonly=${isReadOnly}
          >
${product.notes ?? ''}</textarea
          >
          <label for="notes">${t('form.notes')}</label>
        </div>
      </div>
    </div>
    <datalist id="academy-courses-list">
      ${courses.map(
        (course) =>
          html`<option data-id=${course.id} value=${generateItemTitle(course.id, course.name)} />`,
      )}
    </datalist>
    <datalist id="whatsapp-groups-list">
      ${whatsappGroups.map(
        (group) =>
          html`<option data-id=${group.id} value=${generateItemTitle(group.id, group.name)} />`,
      )}
    </datalist>
    <datalist id="smoove-lists-list">
      ${smooveLists.map(
        (list) =>
          html`<option data-id=${list.id} value=${generateItemTitle(list.id, list.name)} />`,
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
      class="products-view_trash btn btn-outline-secondary"
      hx-post=""
      hx-target="closest .products-view_form-fields"
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
