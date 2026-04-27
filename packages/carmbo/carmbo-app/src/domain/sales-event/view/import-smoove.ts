import {requestContext} from '@fastify/request-context'
import {html} from '../../../commons/html-templates.ts'
import {getFixedT} from 'i18next'
import {generateItemTitle} from '../../../commons/view-commons.ts'

const t = getFixedT(null, 'sales-event')

export function renderImportSmooveDialog(
  salesEventNumber: number,
  form: {smooveListId: string} | undefined,
) {
  const smooveLists = requestContext.get('smooveLists')!
  const smooveListRealId = form?.smooveListId.split(':')[0]

  const smooveList = smooveListRealId
    ? smooveLists.find((l) => String(l.id) === smooveListRealId)
    : undefined

  return html`
    <dialog id="import-smoove-dialog" class="import-smoove-dialog">
      <form
        class="import-smoove-form"
        hx-post="/sales-events/${salesEventNumber}/import-smoove"
        hx-target="#import-smoove-results"
        hx-swap="innerHTML"
        hx-indicator="#import-smoove-spinner"
      >
        <h4 class="mb-3">${t('importSmoove.importFromSmooveList')}</h4>
        <p class="text-muted">${t('importSmoove.importDescription')}</p>

        <div class="mb-3">
          <label for="import-smooveListId" class="form-label"
            >${t('importSmoove.smooveList')}</label
          >
          <input
            name="smooveListId"
            type="text"
            list="import-smoove-lists-list"
            placeholder=${t('importSmoove.selectSmooveList')}
            class="form-control"
            id="import-smooveListId"
            spellcheck="false"
            autocorrect="off"
            autocomplete="off"
            autocapitalize="off"
            hx-post="/sales-events/${salesEventNumber}/import-smoove-dialog"
            hx-target="closest form"
            hx-select="form"
            hx-swap="outerHTML"
            hx-trigger="change delay:1ms"
            required
            value=${generateItemTitle(smooveListRealId, smooveList?.name)}
          />
          <datalist
            id="import-smoove-lists-list"
            hx-trigger="input changed from:#import-smooveListId"
            hx-target="this"
            hx-vals='js:{q: document.getElementById("import-smooveListId").value}'
            hx-get="/smoove/query/datalist"
          ></datalist>
        </div>

        <div class="d-flex gap-2 justify-content-end">
          <button type="button" class="btn btn-secondary" onclick="this.closest('dialog').close()">
            ${t('importSmoove.cancel')}
          </button>
          <button type="submit" class="btn btn-primary" id="import-smoove-start-btn">
            <span
              id="import-smoove-spinner"
              class="spinner-border spinner-border-sm htmx-indicator me-1"
            ></span>
            ${t('importSmoove.startImport')}
          </button>
        </div>
      </form>

      <div id="import-smoove-results"></div>
    </dialog>
  `
}

export type ImportResult = {
  total: number
  successful: number
  skipped: number
  errors: Array<{contact: {email: string; firstName: string; lastName: string}; error: string}>
}

export function renderImportJob(jobId: number) {
  return html`
    <div class="mt-3">
      <h5>${t('importSmoove.importJobSubmitted')}</h5>
      <div class="alert alert-info">
        <p class="mb-1"><a href="/jobs/${jobId}">${t('importSmoove.trackImportJob')}</a></p>
      </div>
    </div>
  `
}
