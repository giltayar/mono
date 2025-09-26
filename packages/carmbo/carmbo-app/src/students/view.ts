import assert from 'node:assert'
import {html} from '../commons/html-templates.ts'
import {MainLayout} from '../layouts/main-view.ts'
import type {NewStudent, Student, StudentHistory, StudentWithHistoryInfo} from './model.ts'
import type {HistoryOperation} from '../commons/operation-type.ts'

export type StudentManipulations = {
  addItem: string | string[] | undefined
}

export function renderStudentsCreatePage(
  student: NewStudent | undefined,
  manipulations: StudentManipulations | undefined,
) {
  const finalStudent: NewStudent = student
    ? manipulations
      ? manipulateStudent(student, manipulations)
      : student
    : {
        names: [{firstName: '', lastName: ''}],
        emails: [''],
        phones: [''],
        facebookNames: [''],
        birthday: new Date(),
        cardcomCustomerId: '',
      }

  return html`
    <${MainLayout} title="Students">
      <${StudentCreateView} student=${finalStudent} />
    </${MainLayout}>
  `
}

export function renderStudentUpdatePage(
  student: StudentWithHistoryInfo,
  history: StudentHistory[],
  manipulations: StudentManipulations,
) {
  return html`
    <${MainLayout} title="Students">
      <${StudentUpdateView} student=${manipulateStudent(student, manipulations)} history=${history} />
    </${MainLayout}>
  `
}

export function renderStudentFormFields(
  student: Student | NewStudent,
  manipulations: StudentManipulations,
  operation: 'read' | 'write',
) {
  return html`
    <${StudentCreateOrUpdateFormFields}
      student=${manipulateStudent(student, manipulations)}
      operation=${operation}
    />
  `
}

export function renderStudentViewInHistoryPage(
  student: StudentWithHistoryInfo,
  history: StudentHistory[],
) {
  return html`,
    <${MainLayout} title="Students">
      <${StudentHistoryView} student=${student} history=${history} operationId=${student.id} />
    </${MainLayout}>
  `
}

function StudentCreateView({student}: {student: Student}) {
  return html`
    <h2 class="border-bottom col-md-6 mt-3">New Student</h2>
    <form hx-post="/students/" hx-target="html" hx-push-url="true" class="col-md-6 mt-3">
      <div class="ms-auto" style="width: fit-content">
        <section class="btn-group" aria-label="Form actions">
          <button class="btn btn-secondary" type="Submit" value="discard">Discard</button>
          <button class="btn btn-primary" type="Submit" value="save">Create</button>
        </section>
      </div>
      <div class="mt-3">
        <${StudentCreateOrUpdateFormFields} student=${student} operation="write" />
      </div>
    </form>
  `
}

function StudentUpdateView({
  student,
  history,
}: {
  student: StudentWithHistoryInfo
  history: StudentHistory[]
}) {
  return html`
    <h2 class="border-bottom col-md-6 mt-3">
      Update Student ${student.studentNumber}
      ${student.historyOperation === 'delete'
        ? html` <small class="text-body-secondary">(archived)</small>`
        : ''}
    </h2>
    <form
      hx-put="/students/${student.studentNumber}"
      hx-target="form"
      hx-replace-url="true"
      class="col-md-6 mt-3"
    >
      <input name="studentNumber" type="hidden" value=${student.studentNumber} />
      <input
        name="delete-operation"
        type="hidden"
        value=${student.historyOperation === 'delete' ? 'restore' : 'delete'}
      />
      <div class="ms-auto" style="width: fit-content">
        <section class="btn-group" aria-label="Form actions">
          <button class="btn btn-secondary" type="Submit" value="discard">Discard</button>
          <button
            class="btn btn-danger"
            type="Submit"
            value="delete"
            hx-delete=""
            hx-params="delete-operation"
          >
            ${student.historyOperation === 'delete' ? 'Restore' : 'Archive'}
          </button>
          <button class="btn btn-primary" type="Submit" value="save">Update</button>
        </section>
      </div>
      <div class="mt-3">
        <${StudentCreateOrUpdateFormFields} student=${student} operation="write" />
      </div>
    </form>
    <${StudentHistoryList} student=${student} history=${history} />
  `
}

function StudentHistoryView({
  student,
  history,
}: {
  student: StudentWithHistoryInfo
  history: StudentHistory[]
}) {
  const currentHistory = history.find((h) => h.historyId === student.id)

  return html`
    <h2 class="border-bottom col-md-6 mt-3">
      View Student ${student.studentNumber}<> </>
      <small class="text-body-secondary"
        >(${historyOperationToText(currentHistory?.operation)})</small
      >
    </h2>
    <form class="col-md-6 mt-3">
      <input name="studentNumber" type="hidden" value=${student.studentNumber} readonly />
      <div class="mt-3">
        <${StudentCreateOrUpdateFormFields} student=${student} operation="read" />
      </div>
    </form>
    <${StudentHistoryList} student=${student} history=${history} />
  `
}

function StudentHistoryList({
  student,
  history,
}: {
  student: StudentWithHistoryInfo
  history: StudentHistory[]
}) {
  return html`
    <h5 class="mt-3 col-md-6 border-bottom">History</h5>
    <ul
      aria-label="Student History"
      class="list-group mt-3 pb-3 col-md-6"
      style="font-size: 0.9rem"
    >
      ${history?.map((entry, i) => {
        const date = new Date(entry.timestamp)
        return html`<li class="list-group-item d-flex" style="text-transform: capitalize;">
          ${entry.historyId === student.id
            ? html`<strong class="d-block">${historyOperationToText(entry.operation)}</strong>`
            : html` <a
                class="d-block"
                href=${`/students/${student.studentNumber}` +
                (i > 0 ? `/by-history/${entry.historyId}` : '')}
              >
                ${historyOperationToText(entry.operation)}</a
              >`}
          <span class="d-block ms-auto" title="${date.toLocaleTimeString('he-IL')}"
            >${date.toLocaleDateString('he-IL')}</span
          >
        </li>`
      })}
    </ul>
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
        <use href="/public/students/style/plus-circle.svg" />
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
        <use href="/public/students/style/minus-circle.svg" />
      </svg>
    </button>
  `
}

function StudentCreateOrUpdateFormFields({
  student,
  operation,
}: {
  student: Student | NewStudent
  operation: 'read' | 'write'
}) {
  const maybeRo = operation === 'read' ? 'readonly' : ''

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
                    value=${name.firstName}
                    placeholder=" "
                    required
                    class="form-control"
                    id="firstName-${i}"
                    ${maybeRo}
                  />
                  <label for="firstName-${i}">First Name</label>
                </div>

                <div class="form-floating">
                  <input
                    name="names[${i}][lastName]"
                    type="text"
                    value=${name.lastName}
                    placeholder=" "
                    required
                    class="form-control"
                    id="lastName-${i}"
                    ${maybeRo}
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
                    ${maybeRo}
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
                    pattern="^\\+?[\\d\\-\\.]+$"
                    ${maybeRo}
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
                    ${maybeRo}
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
            value="${student.birthday ? student.birthday.toISOString().split('T')[0] : ''}"
            ${maybeRo}
          />
          <label for="birthday">Birthday</label>
        </div>

        <div class="mt-3 form-floating">
          <input
            name="cardcomCustomerId"
            type="text"
            placeholder=" "
            class="form-control"
            id="cardcomCustomerId"
            value="${student.cardcomCustomerId}"
            ${maybeRo}
          />
          <label for="cardcomCustomerId">Cardcom Customer ID</label>
        </div>
      </div>
    </div>
  `
}

const ARRAY_FIELDS_IN_STUDENT = ['names', 'emails', 'phones', 'facebookNames']

function manipulateStudent<T extends NewStudent | Student>(
  student: T,
  manipulations: StudentManipulations,
): T {
  const transformed = {...student}
  const addItem = Array.isArray(manipulations.addItem) ? undefined : manipulations.addItem
  assert(
    addItem === undefined || ARRAY_FIELDS_IN_STUDENT.includes(addItem),
    `Invalid addItem: ${addItem}`,
  )

  if (addItem) {
    if (addItem === 'names') {
      ;(transformed[addItem] ??= []).push({firstName: '', lastName: ''})
    } else {
      // @ts-expect-error dynamic stuff!
      ;(transformed[addItem] ??= []).push('')
    }
  }

  return transformed
}

function historyOperationToText(operation: HistoryOperation | undefined): string {
  switch (operation) {
    case 'create':
      return 'created'
    case 'update':
      return 'updated'
    case 'delete':
      return 'archived'
    case 'restore':
      return 'restored'
    default:
      return operation + '???'
  }
}
