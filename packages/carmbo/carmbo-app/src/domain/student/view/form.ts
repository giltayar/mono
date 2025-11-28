import {html} from '../../../commons/html-templates.ts'
import type {Student} from '../model.ts'
import type {OngoingStudent} from './model.ts'

export function StudentCreateOrUpdateFormFields({
  student,
  operation,
}: {
  student: Student | OngoingStudent
  operation: 'read' | 'write'
}) {
  const isReadOnly = operation === 'read'

  return html`
    <div class="students-view_form-fields card">
      <div class="card-body">
        <fieldset aria-label="Names" class="mt-3">
          ${student.names?.map(
            (name, i, l) => html`
              <div class="students-view_item input-group">
                <div class="form-floating">
                  <input
                    name="names[${i}][firstName]"
                    type="text"
                    value=${name?.firstName ?? ''}
                    placeholder=" "
                    required
                    class="form-control"
                    id="firstName-${i}"
                    autocomplete="off"
                    data-1p-ignore
                    readonly=${isReadOnly}
                  />
                  <label for="firstName-${i}">First Name</label>
                </div>

                <div class="form-floating">
                  <input
                    name="names[${i}][lastName]"
                    type="text"
                    value=${name?.lastName ?? ''}
                    placeholder=" "
                    required
                    class="form-control"
                    id="lastName-${i}"
                    autocomplete="off"
                    data-1p-ignore
                    readonly=${isReadOnly}
                  />
                  <label for="lastName-${i}">Last Name</label>
                </div>
                ${operation === 'write' && html`<${RemoveButton} />`}
                ${operation === 'write' && html`<${AddButton} itemsName="names" i=${i} l=${l} />`}
              </div>
            `,
          )}
          ${operation === 'write' &&
          html`<${AddButton} itemsName="names" humanName="Names" l=${student.names} />`}
        </fieldset>

        <fieldset aria-label="Emails" class="mt-3">
          ${student.emails?.map(
            (email, i, l) => html`
              <div class="students-view_item input-group">
                <div class="form-floating">
                  <input
                    name="emails[${i}]"
                    type="email"
                    value=${email}
                    placeholder=" "
                    required
                    class="form-control"
                    id="email-${i}"
                    autocomplete="off"
                    data-1p-ignore
                    readonly=${isReadOnly}
                  />
                  <label for="email-${i}">Email</label>
                </div>
                ${operation === 'write' && html`<${RemoveButton} />`}
                ${operation === 'write' && html`<${AddButton} itemsName="emails" i=${i} l=${l} />`}
              </div>
            `,
          )}
          ${operation === 'write' &&
          html`<${AddButton} itemsName="emails" humanName="Emails" l=${student.emails} />`}
        </fieldset>

        <fieldset aria-label="Phones" class="mt-3">
          ${student.phones?.map(
            (phone, i, l) => html`
              <div class="students-view_item input-group">
                <div class="form-floating">
                  <input
                    name="phones[${i}]"
                    type="tel"
                    value=${phone}
                    placeholder=" "
                    required
                    class="form-control"
                    id="phone-${i}"
                    pattern="^\\+?[\\d\\-\\.\\(\\) ]+$"
                    autocomplete="off"
                    data-1p-ignore
                    readonly=${isReadOnly}
                  />
                  <label for="phone-${i}">Phone</label>
                </div>
                ${operation === 'write' && html`<${RemoveButton} />`}
                ${operation === 'write' && html`<${AddButton} itemsName="phones" i=${i} l=${l} />`}
              </div>
            `,
          )}
          ${operation === 'write' &&
          html`<${AddButton} itemsName="phones" humanName="Phones" l=${student.phones} />`}
        </fieldset>

        <fieldset aria-label="Facebook Names" class="mt-3">
          ${student.facebookNames?.map(
            (fb, i, l) => html`
              <div class="students-view_item input-group">
                <div class="form-floating">
                  <input
                    name="facebookNames[${i}]"
                    type="text"
                    value=${fb}
                    placeholder=" "
                    required
                    class="form-control"
                    id="facebookName-${i}"
                    autocomplete="off"
                    data-1p-ignore
                    readonly=${isReadOnly}
                  />
                  <label for="facebookName-${i}">Facebook Name</label>
                </div>
                ${operation === 'write' && html`<${RemoveButton} />`}
                ${operation === 'write' &&
                html`<${AddButton} itemsName="facebookNames" i=${i} l=${l} />`}
              </div>
            `,
          )}
          ${operation === 'write' &&
          html`<${AddButton}
            itemsName="facebookNames"
            humanName="Facebook Names"
            l=${student.facebookNames}
          />`}
        </fieldset>

        <div class="mt-3 form-floating">
          <input
            name="birthday"
            type="date"
            placeholder=" "
            class="form-control"
            id="birthday"
            value=${student.birthday ? student.birthday.toISOString().split('T')[0] : ''}
            readonly=${isReadOnly}
          />
          <label for="birthday">Birthday</label>
        </div>

        ${'cardcomCustomerIds' in student &&
        student.cardcomCustomerIds &&
        student.cardcomCustomerIds.length > 0
          ? html`
              <div class="mt-3 form-floating">
                <input
                  type="text"
                  placeholder=" "
                  class="form-control"
                  id="cardcomCustomerIds"
                  value=${student.cardcomCustomerIds.join(', ')}
                  readonly
                />
                <label for="cardcomCustomerIds">Cardcom Customer IDs</label>
              </div>
            `
          : ''}
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
      class="btn students-view_add"
      hx-post=""
      hx-target="closest .students-view_form-fields"
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
      class="students-view_trash btn btn-outline-secondary"
      hx-post=""
      hx-target="closest .students-view_form-fields"
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
