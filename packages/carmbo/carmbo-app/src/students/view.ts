import {html} from '../commons/html-templates.ts'
import type {Student, StudentForGrid, StudentHistory} from './model.ts'

export function StudentsView({students}: {students: StudentForGrid[]}) {
  return html`
    <h1>Students</h1>
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

export function StudentCreateView({student}: {student: Student}) {
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

export function StudentUpdateView({
  student,
  history,
}: {
  student: Student
  history: StudentHistory[]
}) {
  return html`
    <h1>Update Student ${student.studentNumber}</h1>
    <form
      hx-put="/students/${student.studentNumber}"
      hx-target="form"
      hx-select="form"
      hx-replace-url="true"
    >
      <input name="studentNumber" type="hidden" value=${student.studentNumber} />
      <section>
        <button type="Submit" value="save">Save</button>
        <button type="Submit" value="discard">Discard</button>
      </section>
      <${StudentCreateOrUpdateFormFields} student=${student} operation="write" />
    </form>
    <ul>
      ${history?.map(
        (entry) =>
          html`<li>
            <a href=${`./${student.studentNumber}/by-history/${entry.operationId}`}
              >${entry.operation}</a
            ><> </>
            at ${new Date(entry.timestamp).toLocaleString()}
          </li>`,
      )}
    </ul>
  `
}

export function StudentHistoryView({student}: {student: Student}) {
  return html`
    <h1>View Student ${student.studentNumber}</h1>
    <form>
      <input name="studentNumber" type="hidden" value=${student.studentNumber} readonly />
      <${StudentCreateOrUpdateFormFields} student=${student} operation="read" />
    </form>
  `
}

function AddButton({itemsName: itemName}: {itemsName: string}) {
  return html`
    <button
      class="students-view_add"
      hx-post=""
      hx-target="closest form"
      hx-trigger="click delay:1ms"
      hx-select="form"
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
      hx-target="closest form"
      hx-trigger="click delay:1ms"
      hx-select="form"
    >
      Trash
    </button>
  `
}

export function StudentCreateOrUpdateFormFields({
  student,
  operation,
}: {
  student: Student
  operation: 'read' | 'write'
}) {
  const maybeRo = operation === 'read' ? 'readonly' : ''

  return html`
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
          value="${student.birthday.toISOString().split('T')[0]}"
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
  `
}
