import {html} from '../../../commons/html-templates.ts'
import {MainLayout} from '../../../layout/main-view.ts'
import {Layout} from './layout.ts'
import type {StudentForGrid} from '../model.ts'
import {version} from '../../../commons/version.ts'
import {getFixedT} from 'i18next'

const t = getFixedT(null, 'student')

export function renderStudentsPage(
  flash: string | undefined,
  students: StudentForGrid[],
  {withArchived, query, page}: {withArchived: boolean; query: string; page: number},
) {
  return html`
    <${MainLayout} title=${t('list.students')} flash=${flash} activeNavItem="students">
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
        <h2>${t('list.students')}</h2>
        <form
          class="mb-1 ms-auto"
          action="/students"
          hx-boost
          hx-trigger="input changed throttle:500ms"
        >
          <fieldset class="row align-items-center me-0">
            <label class="form-check-label form-check col-auto"
              ><input
                type="checkbox"
                class="form-check-input"
                name="with-archived"
                checked=${withArchived}
              />
              ${t('list.showArchived')}</label
            >
            <label class="form-input-label col-auto" for="query">${t('list.search')}</label>
            <input
              type="search"
              name="q"
              id="query"
              class="form-control form-control-sm col"
              placeholder=${t('list.searchPlaceholder')}
              value=${query}
            />
          </fieldset>
        </form>
      </div>
      <table class="table mt-3">
        <thead>
          <tr>
            <th>${t('list.id')}</th>
            <th>${t('list.names')}</th>
            <th>${t('list.emails')}</th>
            <th>${t('list.phones')}</th>
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
        <a
          role="button"
          class="btn float-end"
          href="/students/new"
          aria-label=${t('list.newStudent')}
        >
          <object
            type="image/svg+xml"
            class="feather feather-large"
            data=${`/src/${version}/layout/style/plus-circle.svg`}
          ></object>
        </a>
      </section>
    </div>
  `
}
