import {html} from '../commons/html-templates.ts'
import {MainLayout} from '../layouts/main-view.ts'
import {Layout} from './layout.ts'
import type {StudentForGrid} from './model.ts'

export function renderStudentsPage(
  flash: string | undefined,
  students: StudentForGrid[],
  {withArchived, query, page}: {withArchived: boolean; query: string; page: number},
) {
  return html`
    <${MainLayout} title="Students" flash=${flash} activeNavItem="students">
      <${Layout}>
        <${StudentsView} students=${students} withArchived=${withArchived} query=${query} page=${page} />
      </${Layout}>
    </${MainLayout}>
  `
}

function StudentsView({
  students,
  withArchived,
  query,
  page,
}: {
  students: StudentForGrid[]
  withArchived: boolean
  query: string
  page: number
}) {
  return html`
    <div class="mt-3">
      <div class="title-and-search d-flex flex-row border-bottom align-items-baseline">
        <h2>Students</h2>
        <form
          class="mb-1 ms-auto"
          action="/students"
          hx-boost
          hx-trigger="input changed delay:500ms"
        >
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
            <label class="form-input-label col-auto" for="query">Search:</label>
            <input
              type="search"
              name="q"
              id="query"
              class="form-control form-control-sm col"
              placeholder="Search"
              value=${query}
            />
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
            (student, i, l) => html`
              <tr
                ...${i === l.length - 1
                  ? {
                      'hx-get': `/students?page=${encodeURIComponent(page + 1)}`,
                      'hx-trigger': 'revealed',
                      'hx-select': '.students-view tbody tr',
                      'hx-include': '.students-view form',
                      'hx-swap': 'afterend',
                    }
                  : {}}
              >
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
      <section class="add-new">
        <a role="button" class="btn float-end" href="/students/new" aria-label="new student">
          <svg class="feather feather-large" viewbox="0 0 24 24">
            <use href="/src/layouts/common-style/plus-circle.svg" />
          </svg>
        </a>
      </section>
    </div>
  `
}
