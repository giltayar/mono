import {html} from '../commons/html-templates.ts'
import {MainLayout} from '../layouts/main-view.ts'
import type {StudentForGrid} from './model.ts'

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

function StudentsView({
  students,
  withArchived,
}: {
  students: StudentForGrid[]
  withArchived: boolean
}) {
  return html`
    <div class="students-view mt-3">
      <div class="title-and-search d-flex flex-row border-bottom align-items-baseline">
        <h1>Students</h1>
        <form action="/students" hx-boosted class="mb-1">
          <fieldset class="row align-items-center me-0">
            <label class="form-check-label form-check col-auto"
              ><input
                type="checkbox"
                class="form-check-input"
                name="with-archived"
                checked=${withArchived}
              />
              Show archived</label
            >
            <button type="submit" class="btn btn-light btn-sm col-auto">Refresh</button>
          </fieldset>
        </form>
      </div>
      <table class="table mt-3">
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
                <td>
                  <a
                    class="btn btn-light btn-sm"
                    role="button"
                    href="/students/${student.studentNumber}"
                    >${student.studentNumber}</a
                  >
                </td>
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
        <a role="button" class="btn float-end" href="/students/new" aria-label="new student">
          <svg class="feather feather-large" viewbox="0 0 24 24">
            <use href="/public/students/style/plus-circle.svg" />
          </svg>
        </a>
      </section>
    </div>
  `
}
