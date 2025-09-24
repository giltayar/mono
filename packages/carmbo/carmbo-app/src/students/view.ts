import assert from 'node:assert'
import {html} from '../commons/html-templates.ts'
import {MainLayout} from '../layouts/main-view.ts'
import type {
  NewStudent,
  Student,
  StudentForGrid,
  StudentHistory,
  StudentWithHistoryInfo,
} from './model.ts'

export type StudentManipulations = {
  addItem: string | string[] | undefined
}

export function renderStudentsPage(
  flash: string | undefined,
  students: StudentForGrid[],
  {withArchived}: {withArchived: boolean},
) {
  return html`
    <${MainLayout} title="Students" flash=${flash}>
      <${StudentsView} students=${students} withArchived=${withArchived} />
    </${MainLayout}>
  `
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

function StudentsView({
  students,
  withArchived,
}: {
  students: StudentForGrid[]
  withArchived: boolean
}) {
  return html`
    <h1>Students</h1>
    <form action="/students" hx-boosted>
      <input type="checkbox" name="with-archived" id="with-archived" checked=${withArchived} />
      <label for="with-archived">Show archived</label>
      <button type="submit">Refresh</button>
    </form>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Names</th>
          <th>Emails</th>
          <th>Phones</th>
        </tr>
      </thead>
      <tbody>
        ${students.map(
          (student) => html`
            <tr>
              <td><a href="/students/${student.studentNumber}">${student.studentNumber}</a></td>
              <td>
                ${student.names.map((name) => `${name.firstName} ${name.lastName}`).join(', ')}
              </td>
              <td>${student.emails.join(', ')}</td>
              <td>${student.phones.join(', ')}</td>
            </tr>
          `,
        )}
      </tbody>
    </table>
    <section>
      <a href="/students/new">Create new student</a>
    </section>
  `
}

function StudentCreateView({student}: {student: Student}) {
  return html`
    <h1>New Student</h1>
    <form hx-post="/students/" hx-target="html" hx-push-url="true">
      <section>
        <button type="Submit" value="save">Save</button>
        <button type="Submit" value="discard">Discard</button>
      </section>
      <${StudentCreateOrUpdateFormFields} student=${student} operation="write" />
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
    <h1>
      Update Student ${student.studentNumber}<> </>
      ${student.historyOperation === 'delete' ? '(deleted)' : ''}
    </h1>
    <form hx-put="/students/${student.studentNumber}" hx-target="form" hx-replace-url="true">
      <input name="studentNumber" type="hidden" value=${student.studentNumber} />
      <section>
        <button type="Submit" value="save">Save</button>
        <button type="Submit" value="discard">Discard</button>
        <button type="Submit" value="delete" hx-delete="" hx-params="none">Delete</button>
      </section>
      <${StudentCreateOrUpdateFormFields} student=${student} operation="write" />
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
    <h1>
      View Student ${student.studentNumber} (${currentHistory?.operation ?? 'unknown'} at
      ${currentHistory ? new Date(currentHistory.timestamp).toLocaleString() : '???'})
    </h1>
    <form>
      <input name="studentNumber" type="hidden" value=${student.studentNumber} readonly />
      <${StudentCreateOrUpdateFormFields} student=${student} operation="read" />
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
    <ul aria-label="Student History">
      ${history?.map(
        (entry) =>
          html`<li>
            ${
              entry.historyId === student.id
                ? html`<strong>${entry.operation}</strong>`
                : html` <a
                    href=${`/students/${student.studentNumber}/by-history/${entry.historyId}`}
                  >
                    ${entry.operation}</a
                  >`
            }<> </>
            at ${new Date(entry.timestamp).toLocaleString()}
          </li>`,
      )}
    </ul>
  `
}

function AddButton({itemsName: itemName}: {itemsName: string}) {
  return html`
    <button
      class="students-view_add"
      hx-post=""
      hx-target="closest .students-view_form-fields"
      hx-swap="outerHTML"
      hx-trigger="click delay:1ms"
      hx-headers=${JSON.stringify({'X-Add-Item': itemName})}
      aria-label="Add"
    >
      +
    </button>
  `
}

function RemoveButton() {
  return html`
    <button
      class="students-view_trash"
      hx-post=""
      hx-target="closest .students-view_form-fields"
      hx-swap="outerHTML"
      hx-trigger="click delay:1ms"
    >
      Trash
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
    <div class="students-view_form-fields">
      <fieldset>
        <legend>Names</legend>
        ${student.names?.map(
          (name, i) => html`
            <div class="students-view_item">
              <label>
                First Name
                <input
                  name="names[${i}][firstName]"
                  type="text"
                  value=${name.firstName}
                  required
                  ${maybeRo}
                />
              </label>
              <label>
                Last Name
                <input
                  name="names[${i}][lastName]"
                  type="text"
                  value=${name.lastName}
                  required
                  ${maybeRo}
                />
              </label>
              ${operation === 'write' && html`<${RemoveButton} />`}
            </div>
          `,
        )}
        ${operation === 'write' && html`<${AddButton} itemsName="names" />`}
      </fieldset>

      <fieldset>
        <legend>Emails</legend>
        ${student.emails?.map(
          (email, i) => html`
            <div class="students-view_item">
              <label>
                Email
                <input name="emails[${i}]" type="email" value=${email} ${maybeRo} required />
              </label>
              ${operation === 'write' && html`<${RemoveButton} />`}
            </div>
          `,
        )}
        ${operation === 'write' && html`<${AddButton} itemsName="emails" />`}
      </fieldset>

      <fieldset>
        <legend>Phones</legend>
        ${student.phones?.map(
          (phone, i) => html`
            <div class="students-view_item">
              <label>
                Phone
                <input
                  name="phones[${i}]"
                  type="tel"
                  value=${phone}
                  ${maybeRo}
                  pattern="^\\+?[\\d\\-\\.]+$"
                  required
                />
              </label>
              ${operation === 'write' && html`<${RemoveButton} />`}
            </div>
          `,
        )}
        ${operation === 'write' && html`<${AddButton} itemsName="phones" />`}
      </fieldset>

      <fieldset>
        <legend>Facebook names</legend>
        ${student.facebookNames?.map(
          (fb, i) => html`
            <div class="students-view_item">
              <label>
                Facebook name
                <input name="facebookNames[${i}]" type="text" value=${fb} ${maybeRo} required />
              </label>
              ${operation === 'write' && html`<${RemoveButton} />`}
            </div>
          `,
        )}
        ${operation === 'write' && html`<${AddButton} itemsName="facebookNames" />`}
      </fieldset>

      <div>
        <label>
          Birthday
          <input
            name="birthday"
            type="date"
            value="${student.birthday ? student.birthday.toISOString().split('T')[0] : ''}"
            ${maybeRo}
          />
        </label>
      </div>

      <div>
        <label>
          Cardcom Customer ID
          <input
            name="cardcomCustomerId"
            type="text"
            value="${student.cardcomCustomerId}"
            ${maybeRo}
          />
        </label>
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
