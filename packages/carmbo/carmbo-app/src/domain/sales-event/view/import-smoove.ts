import {html} from '../../../commons/html-templates.ts'
import {generateItemTitle} from '../../../commons/view-commons.ts'
import type {SmooveList} from '@giltayar/carmel-tools-smoove-integration/types'

export function renderImportSmooveDialog(salesEventNumber: number, smooveLists: SmooveList[]) {
  return html`
    <dialog id="import-smoove-dialog" class="import-smoove-dialog">
      <form
        class="import-smoove-form"
        hx-post="/sales-events/${salesEventNumber}/import-smoove"
        hx-target="#import-smoove-results"
        hx-swap="innerHTML"
        hx-indicator="#import-smoove-spinner"
      >
        <h4 class="mb-3">Import from Smoove List</h4>
        <p class="text-muted">
          Select a Smoove list to import contacts from. Each contact will be created as a sale with
          zero revenue.
        </p>

        <div class="mb-3">
          <label for="import-smooveListId" class="form-label">Smoove List</label>
          <input
            name="smooveListId"
            id="import-smooveListId_value"
            type="hidden"
            value=""
            required
          />
          <input
            type="text"
            list="import-smoove-lists-list"
            placeholder="Select a Smoove list..."
            class="form-control pick-item-title"
            id="import-smooveListId"
            spellcheck="false"
            autocorrect="off"
            autocomplete="off"
            autocapitalize="off"
            required
          />
          <datalist id="import-smoove-lists-list">
            ${smooveLists.map(
              (list) =>
                html`<option data-id=${list.id} value=${generateItemTitle(list.id, list.name)} />`,
            )}
          </datalist>
        </div>

        <div class="d-flex gap-2 justify-content-end">
          <button type="button" class="btn btn-secondary" onclick="this.closest('dialog').close()">
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" id="import-smoove-start-btn">
            <span
              id="import-smoove-spinner"
              class="spinner-border spinner-border-sm htmx-indicator me-1"
            ></span>
            Start Import
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
      <h5>Import Job Submitted</h5>
      <div class="alert alert-info">
        <p class="mb-1"><a href="/jobs/${jobId}">Track import job</a></p>
      </div>
    </div>
  `
}
