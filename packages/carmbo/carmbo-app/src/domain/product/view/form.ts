import {html} from '../../../commons/html-templates.ts'
import {generateItemTitle} from '../../../commons/view-commons.ts'
import type {NewProduct, Product} from '../model.ts'
import type {OngoingProduct} from './model.ts'
import {requestContext} from '@fastify/request-context'
import {version} from '../../../commons/version.ts'
import {getFixedT} from 'i18next'
import {ValidityError} from '../../../commons/validity-error.ts'

const t = getFixedT(null, 'product')
const tCommon = getFixedT(null, 'layout')

export function ProductCreateOrUpdateFormFields({
  product,
  operation,
  withAcademyIntegration,
  academyAccountSubdomains,
  academyCoursesBySubdomain,
  withSmooveIntegration,
  withSkoolIntegration,
}: {
  product: Product | OngoingProduct | NewProduct
  operation: 'read' | 'write'
  withAcademyIntegration: boolean
  academyAccountSubdomains: string[]
  academyCoursesBySubdomain: Map<string, {id: number; name: string}[]> | undefined
  withSmooveIntegration: boolean
  withSkoolIntegration: boolean
}) {
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
            hx-post=""
            hx-target="closest .products-view_form-fields"
            hx-swap="innerHTML"
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

        ${withAcademyIntegration &&
        html`<fieldset aria-label=${t('form.academyCourses')} class="mt-3">
          ${product.academyCourses?.map(
            (course, i, l) => html`
              <div class="products-view_item input-group">
                <div class="form-floating">
                  <select
                    name=${`academyCourses[${i}][accountSubdomain]`}
                    class="form-select"
                    id="academyCourseSubdomain-${i}"
                    readonly=${isReadOnly}
                    hx-post="/academy/courses-datalist"
                    hx-target="#academy-courses-datalist-${i}"
                    hx-swap="innerHTML"
                    hx-include="this"
                    hx-vals=${JSON.stringify({index: i})}
                  >
                    ${academyAccountSubdomains.map(
                      (subdomain) => html`
                        <option
                          value=${subdomain}
                          selected=${course.courseId
                            ? course.accountSubdomain == subdomain
                            : subdomain === academyAccountSubdomains[0]}
                        >
                          ${subdomain}
                        </option>
                      `,
                    )}
                  </select>
                  <label for="academyCourseSubdomain-${i}">${t('form.academySubdomain')}</label>
                </div>
                <div class="form-floating">
                  <input
                    name="academyCourses[${i}][courseId]"
                    id="academyCourse-${i}"
                    value=${(() => {
                      const courses = course.accountSubdomain
                        ? (academyCoursesBySubdomain?.get(course.accountSubdomain) ?? [])
                        : []
                      return course.courseId
                        ? generateItemTitle(
                            course.courseId,
                            courses.find((c) => c.id === course.courseId)?.name,
                          )
                        : ''
                    })()}
                    list="academy-courses-list-${i}"
                    type="text"
                    placeholder=" "
                    required
                    class="form-control"
                    spellcheck="false"
                    autocorrect="off"
                    autocomplete="off"
                    autocapitalize="off"
                    hx-post=""
                    hx-target="closest .products-view_form-fields"
                    hx-swap="outerHTML"
                    hx-trigger="change delay:1ms"
                    readonly=${isReadOnly}
                  />
                  <${ValidityError}
                    valid=${course.courseId
                      ? (course.accountSubdomain
                          ? (academyCoursesBySubdomain?.get(course.accountSubdomain) ?? [])
                          : []
                        ).find((c) => c.id === course.courseId)
                      : true}
                    elementId=${`academyCourse-${i}`}
                    errorMessage=${tCommon('form.invalidListItem')}
                  />
                  <label for="academyCourse-${i}">${t('form.academyCourseId')}</label>
                </div>
                <div id="academy-courses-datalist-${i}">
                  <datalist
                    id="academy-courses-list-${i}"
                    hx-trigger="input changed from:#academyCourse-${i}"
                    hx-target="this"
                    hx-vals=${'js:{q: document.getElementById("academyCourse-' + i + '").value}'}
                    hx-get=${`/academy/query/${course.accountSubdomain ?? academyAccountSubdomains[0]}/datalist`}
                  ></datalist>
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
        </fieldset> `}

        <fieldset aria-label=${t('form.whatsappGroups')} class="mt-3">
          ${product.whatsappGroups?.map(
            (group, i, l) => html`
              <div class="products-view_item input-group">
                <div class="form-floating">
                  <input
                    name="whatsappGroups[${i}][id]"
                    type="text"
                    list="whatsapp-groups-list-${i}"
                    placeholder=" "
                    required
                    class="form-control"
                    id="whatsappGroup-${i}"
                    spellcheck="false"
                    autocorrect="off"
                    autocomplete="off"
                    autocapitalize="off"
                    hx-post=""
                    hx-target="closest .products-view_form-fields"
                    hx-swap="outerHTML"
                    hx-trigger="change delay:1ms"
                    value=${group.id
                      ? generateItemTitle(
                          group.id,
                          whatsappGroups.find((g) => g.id === group.id)?.name,
                        )
                      : ''}
                    readonly=${isReadOnly}
                  />
                  <${ValidityError}
                    valid=${group.id ? whatsappGroups.find((g) => g.id === group.id) : true}
                    elementId=${`whatsappGroup-${i}`}
                    errorMessage=${tCommon('form.invalidListItem')}
                  />
                  <label for="whatsappGroup-${i}">${t('form.whatsappGroupId')}</label>
                </div>
                <datalist
                  id="whatsapp-groups-list-${i}"
                  hx-trigger="input changed from:#whatsappGroup-${i}"
                  hx-target="this"
                  hx-vals=${'js:{q: document.getElementById("whatsappGroup-' + i + '").value}'}
                  hx-get="/whatsapp/query/datalist"
                ></datalist>
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

        ${withSmooveIntegration &&
        html`
          <div class="mt-3 row">
            <div class="col form-floating">
              <input
                name="smooveListId"
                type="text"
                list="smoove-lists-list-main"
                placeholder=" "
                class="form-control"
                id="smooveListId"
                spellcheck="false"
                autocorrect="off"
                autocomplete="off"
                autocapitalize="off"
                hx-post=""
                hx-target="closest .products-view_form-fields"
                hx-swap="outerHTML"
                hx-trigger="change delay:1ms"
                value=${product.smooveListId
                  ? generateItemTitle(
                      product.smooveListId,
                      smooveLists.find((g) => g.id === product.smooveListId)?.name,
                    )
                  : ''}
                readonly=${isReadOnly}
              />
              <${ValidityError}
                valid=${!product.smooveListId ||
                smooveLists.find((g) => g.id === product.smooveListId)}
                elementId="smooveListId"
                errorMessage=${tCommon('form.invalidListItem')}
              />
              <label for="smooveListId">${t('form.smooveListId')}</label>
            </div>
            <datalist
              id="smoove-lists-list-main"
              hx-trigger="input changed from:#smooveListId"
              hx-target="this"
              hx-vals='js:{q: document.getElementById("smooveListId").value}'
              hx-get="/smoove/query/datalist"
            ></datalist>
            ${!isReadOnly
              ? html`<div class="col-auto smoove-list-create-btn-smooveListId">
                  <button
                    type="button"
                    class="btn btn-outline-secondary btn-sm"
                    hx-get="/smoove/list-create-dialog?targetFieldId=smooveListId"
                    hx-target="#smoove-list-create-dialog-container"
                    hx-swap="innerHTML"
                  >
                    ${t('form.createSmooveList')}
                  </button>
                </div>`
              : ''}
          </div>

          ${product.productType === 'club' &&
          html`<div class="mt-3 row">
            <div class="col form-floating">
              <input
                name="smooveCancelledListId"
                type="text"
                list="smoove-lists-list-cancelled"
                placeholder=" "
                class="form-control"
                id="smooveCancelledListId"
                spellcheck="false"
                autocorrect="off"
                autocomplete="off"
                autocapitalize="off"
                hx-post=""
                hx-target="closest .products-view_form-fields"
                hx-swap="outerHTML"
                hx-trigger="change delay:1ms"
                value=${product.smooveCancelledListId
                  ? generateItemTitle(
                      product.smooveCancelledListId,
                      smooveLists.find((g) => g.id === product.smooveCancelledListId)?.name,
                    )
                  : ''}
                readonly=${isReadOnly}
              />
              <${ValidityError}
                valid=${!product.smooveCancelledListId ||
                smooveLists.find((g) => g.id === product.smooveCancelledListId)}
                elementId="smooveCancelledListId"
                errorMessage=${tCommon('form.invalidListItem')}
              />
              <label for="smooveCancelledListId">${t('form.smooveCancelledListId')}</label>
            </div>
            <datalist
              id="smoove-lists-list-cancelled"
              hx-trigger="input changed from:#smooveCancelledListId"
              hx-target="this"
              hx-vals='js:{q: document.getElementById("smooveCancelledListId").value}'
              hx-get="/smoove/query/datalist"
            ></datalist>
            ${!isReadOnly
              ? html`<div class="col-auto smoove-list-create-btn-smooveCancelledListId">
                  <button
                    type="button"
                    class="btn btn-outline-secondary btn-sm"
                    hx-get="/smoove/list-create-dialog?targetFieldId=smooveCancelledListId"
                    hx-target="#smoove-list-create-dialog-container"
                    hx-swap="innerHTML"
                  >
                    ${t('form.createSmooveList')}
                  </button>
                </div>`
              : ''}
          </div>`}

          <div class="mt-3 row">
            <div class="col form-floating">
              <input
                name="smooveRemovedListId"
                type="text"
                list="smoove-lists-list-removed"
                placeholder=" "
                class="form-control"
                id="smooveRemovedListId"
                spellcheck="false"
                autocorrect="off"
                autocomplete="off"
                autocapitalize="off"
                hx-post=""
                hx-target="closest .products-view_form-fields"
                hx-swap="outerHTML"
                hx-trigger="change delay:1ms"
                value=${product.smooveRemovedListId
                  ? generateItemTitle(
                      product.smooveRemovedListId,
                      smooveLists.find((g) => g.id === product.smooveRemovedListId)?.name,
                    )
                  : ''}
                readonly=${isReadOnly}
              />
              <${ValidityError}
                valid=${!product.smooveRemovedListId ||
                smooveLists.find((g) => g.id === product.smooveRemovedListId)}
                elementId="smooveRemovedListId"
                errorMessage=${tCommon('form.invalidListItem')}
              />
              <label for="smooveRemovedListId">${t('form.smooveRemovedListId')}</label>
            </div>
            <datalist
              id="smoove-lists-list-removed"
              hx-trigger="input changed from:#smooveRemovedListId"
              hx-target="this"
              hx-vals='js:{q: document.getElementById("smooveRemovedListId").value}'
              hx-get="/smoove/query/datalist"
            ></datalist>
            ${!isReadOnly
              ? html`<div class="col-auto smoove-list-create-btn-smooveRemovedListId">
                  <button
                    type="button"
                    class="btn btn-outline-secondary btn-sm"
                    hx-get="/smoove/list-create-dialog?targetFieldId=smooveRemovedListId"
                    hx-target="#smoove-list-create-dialog-container"
                    hx-swap="innerHTML"
                  >
                    ${t('form.createSmooveList')}
                  </button>
                </div>`
              : ''}
          </div>
        `}
        ${withSkoolIntegration &&
        html`
          <div class="mt-3 form-check">
            <input
              name="sendSkoolInvitation"
              type="checkbox"
              class="form-check-input"
              id="sendSkoolInvitation"
              checked=${product.sendSkoolInvitation}
              disabled=${isReadOnly}
              value="true"
            />
            <label class="form-check-label" for="sendSkoolInvitation"
              >${t('form.sendSkoolInvitation')}</label
            >
          </div>
        `}

        <details class="mt-3">
          <summary>${t('form.personalMessageWhenJoining')}</summary>
          <div class="mt-2 form-floating">
            <textarea
              name="personalMessageWhenJoining"
              placeholder=" "
              class="form-control"
              id="personalMessageWhenJoining"
              style="height: 120px"
              readonly=${isReadOnly}
            >
${product.personalMessageWhenJoining ?? ''}</textarea
            >
            <label for="personalMessageWhenJoining">${t('form.personalMessageWhenJoining')}</label>
          </div>
        </details>

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
