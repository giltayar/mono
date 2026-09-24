import {html} from '../../../commons/html-templates.ts'
import {getFixedT} from 'i18next'
import {generateItemTitle} from '../../../commons/view-commons.ts'

export function renderRavmesserListCreateDialog(targetFieldId: string) {
  const t = getFixedT(null, 'product')
  return html`
    <dialog id="ravmesser-list-create-dialog">
      <h5 class="mb-3">${t('ravmesserListDialog.createRavmesserList')}</h5>

      <form
        hx-post="/ravmesser/create-list"
        hx-target="#ravmesser-list-create-result"
        hx-swap="innerHTML"
        hx-indicator="#ravmesser-list-create-spinner"
        hx-on:htmx:after-settle=${`
          var result = document.querySelector('#ravmesser-list-create-result [data-list-id]');
          if (result) {
            var tf = document.getElementById(${JSON.stringify(targetFieldId)});
            if (tf) { tf.value = result.dataset.listId + ': ' + result.dataset.listName; }
            this.closest('dialog')?.close();
          }
        `}
      >
        <input type="hidden" name="targetFieldId" value=${targetFieldId} />
        <div class="mb-3">
          <label for="ravmesser-list-name" class="form-label"
            >${t('ravmesserListDialog.listName')}</label
          >
          <input
            type="text"
            class="form-control"
            id="ravmesser-list-name"
            name="listName"
            required
            autofocus
          />
        </div>
        <div id="ravmesser-list-create-result"></div>
        <div class="d-flex justify-content-between mt-3">
          <button type="submit" class="btn btn-success btn-sm">
            ${t('ravmesserListDialog.create')}
            <span
              id="ravmesser-list-create-spinner"
              class="spinner-border spinner-border-sm htmx-indicator"
            ></span>
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            onclick="this.closest('dialog').close()"
          >
            ${t('ravmesserListDialog.cancel')}
          </button>
        </div>
      </form>
    </dialog>
  `
}

export function renderRavmesserListCreateResult(listId: number, listName: string) {
  return html`<div data-list-id=${listId} data-list-name=${listName}>
    ${generateItemTitle(listId, listName)}
  </div>`
}

export function renderRavmesserListCreateError(error: string) {
  return html`<div class="text-danger mt-2">${error}</div>`
}
