import {html} from '../commons/html-templates.ts'
import type {Student, StudentForGrid} from './model.ts'

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
    <form hx-post="/students/" hx-target="html">
      <section>
        <button type="Submit" value="save">Save</button>
        <button type="Submit" value="discard">Discard</button>
      </section>
      <${StudentCreateOrUpdateFormFields} student=${student} operation="write" />
    </form>
  `
}

export function StudentUpdateView({student}: {student: Student}) {
  return html`
    <h1>Update Student ${student.studentNumber}</h1>
    <form hx-put="/students/${student.studentNumber}" hx-target="html">
      <input name="studentNumber" type="hidden" value=${student.studentNumber} />
      <section>
        <button type="Submit" value="save">Save</button>
        <button type="Submit" value="discard">Discard</button>
      </section>
      <${StudentCreateOrUpdateFormFields} student=${student} operation="write" />
    </form>
  `
}

function AddRemoveButtons({
  itemsName: itemName,
  itemsLength,
  index,
}: {
  itemsName: string
  itemsLength: number
  index: number
}) {
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
    ${index === itemsLength - 1 &&
    html`<button
      class="students-view_add"
      hx-post=""
      hx-target="closest form"
      hx-trigger="click delay:1ms"
      hx-select="form"
      hx-headers=${JSON.stringify({'X-Add-Item': itemName})}
    >
      +
    </button>`}
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
      <div class="students-view_names-list">
        ${student.names.map(
          (name, i, items) => html`
            <div class="students-view_item">
              <label>
                First Name
                <input
                  name="names[${i}][firstName]"
                  type="text"
                  value=${name.firstName}
                  ${maybeRo}
                />
              </label>
              <label>
                Last Name
                <input name="names[${i}][lastName]" type="text" value=${name.lastName} ${maybeRo} />
              </label>
              ${operation === 'write' &&
              html`<${AddRemoveButtons}
                itemsName="names"
                itemsLength=${items.length}
                index=${i}
              />`}
            </div>
          `,
        )}
      </div>
    </fieldset>

    <fieldset>
      <legend>Emails</legend>
      ${student.emails.map(
        (email, i, items) => html`
          <div class="students-view_item">
            <label>
              Email
              <input name="emails[${i}]" type="email" value=${email} ${maybeRo} />
            </label>
            ${operation === 'write' &&
            html`<${AddRemoveButtons} itemsName="emails" itemsLength=${items.length} index=${i} />`}
          </div>
        `,
      )}
    </fieldset>

    <fieldset>
      <legend>Phones</legend>
      ${student.phones.map(
        (phone, i, items) => html`
          <div class="students-view_item">
            <label>
              Phone
              <input name="phones[${i}]" type="tel" value=${phone} ${maybeRo} />
            </label>
            ${operation === 'write' &&
            html`<${AddRemoveButtons} itemsName="phones" itemsLength=${items.length} index=${i} />`}
          </div>
        `,
      )}
    </fieldset>

    <fieldset>
      <legend>Facebook names</legend>
      ${student.facebookNames.map(
        (fb, i, items) => html`
          <div class="students-view_item">
            <label>
              Facebook name
              <input name="facebookNames[${i}]" type="text" value=${fb} ${maybeRo} />
            </label>
            ${operation === 'write' &&
            html`<${AddRemoveButtons}
              itemsName="facebookNames"
              itemsLength=${items.length}
              index=${i}
            />`}
          </div>
        `,
      )}
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
