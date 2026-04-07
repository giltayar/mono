import {html} from '../../../commons/html-templates.ts'
import {getFixedT} from 'i18next'
import {generateItemTitle} from '../../../commons/view-commons.ts'

export function renderStudentSearchDialog() {
  const t = getFixedT(null, 'sale')
  return html`
    <dialog id="student-search-dialog" class="student-search-dialog">
      <h5 class="mb-3">${t('studentSearch.searchCreateStudent')}</h5>

      <div class="mb-3">
        <label for="student-search-q" class="form-label">${t('studentSearch.search')}</label>
        <input
          type="text"
          class="form-control"
          id="student-search-q"
          name="q"
          placeholder=${t('studentSearch.searchPlaceholder')}
          hx-get="/sales/query/student-search"
          hx-trigger="input changed delay:500ms"
          hx-target="#student-search-results"
          hx-swap="innerHTML"
          hx-indicator="#student-search-spinner"
          autofocus
        />
      </div>

      <div class="mb-3">
        <span
          id="student-search-spinner"
          class="spinner-border spinner-border-sm htmx-indicator"
        ></span>
        <div id="student-search-results"></div>
      </div>

      <hr />

      <details>
        <summary class="mb-2"><strong>${t('studentSearch.createNewStudent')}</strong></summary>
        <form
          hx-post="/sales/quick-create-student"
          hx-target="#studentNumber"
          hx-swap="outerHTML"
          hx-indicator=".operation-spinner"
          hx-on::after-request="this.closest('dialog')?.close(); document.getElementById('studentNumber')?.dispatchEvent(new Event('change', {bubbles: true}))"
        >
          <div class="mb-2">
            <label for="quick-create-email" class="form-label">${t('studentSearch.email')}</label>
            <input
              type="email"
              class="form-control form-control-sm"
              id="quick-create-email"
              name="quickCreateEmail"
              required
            />
          </div>
          <div class="row mb-2">
            <div class="col">
              <label for="quick-create-first-name" class="form-label"
                >${t('studentSearch.firstName')}</label
              >
              <input
                type="text"
                class="form-control form-control-sm"
                id="quick-create-first-name"
                name="quickCreateFirstName"
                required
              />
            </div>
            <div class="col">
              <label for="quick-create-last-name" class="form-label"
                >${t('studentSearch.lastName')}</label
              >
              <input
                type="text"
                class="form-control form-control-sm"
                id="quick-create-last-name"
                name="quickCreateLastName"
                required
              />
            </div>
          </div>
          <div class="mb-3">
            <label for="quick-create-phone" class="form-label">${t('studentSearch.phone')}</label>
            <input
              type="text"
              class="form-control form-control-sm"
              id="quick-create-phone"
              name="quickCreatePhone"
            />
          </div>
          <button type="submit" class="btn btn-success btn-sm">
            ${t('studentSearch.createAndChoose')}
          </button>
        </form>
      </details>

      <div class="d-flex justify-content-end mt-3">
        <button type="button" class="btn btn-secondary" onclick="this.closest('dialog').close()">
          ${t('studentSearch.cancel')}
        </button>
      </div>
    </dialog>
  `
}

export function renderStudentSearchResults(
  students: {studentNumber: number; name: string; email: string | null; phone: string | null}[],
) {
  const t = getFixedT(null, 'sale')
  if (students.length === 0) {
    return html`<p class="text-muted">${t('studentSearch.noStudentsFound')}</p>`
  }

  return html`
    <div class="list-group">
      ${students.map(
        (student) => html`
          <div class="list-group-item d-flex justify-content-between align-items-center">
            <div>
              <strong>${student.studentNumber}: ${student.name}</strong>
              ${student.email ? html`<br /><small class="text-muted">${student.email}</small>` : ''}
              ${student.phone ? html`<small class="text-muted ms-2">${student.phone}</small>` : ''}
            </div>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              onclick=${`document.getElementById('studentNumber').value = ${JSON.stringify(generateItemTitle(student.studentNumber, student.name))}; document.getElementById('studentNumber').dispatchEvent(new Event('change', {bubbles: true})); this.closest('dialog').close()`}
            >
              ${t('studentSearch.choose')}
            </button>
          </div>
        `,
      )}
    </div>
  `
}
