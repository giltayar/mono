import {html} from '../../../commons/html-templates.ts'
import {getFixedT} from 'i18next'
import {generateItemTitle} from '../../../commons/view-commons.ts'

export function renderSmooveListCreateDialog(targetFieldId: string) {
  const t = getFixedT(null, 'product')
  return html`
    <dialog id="smoove-list-create-dialog">
      <h5 class="mb-3">${t('smooveListDialog.createSmooveList')}</h5>

      <form
        hx-post="/products/create-smoove-list"
        hx-target="#smoove-list-create-result"
        hx-swap="innerHTML"
        hx-indicator="#smoove-list-create-spinner"
        hx-on:htmx:after-settle=${`
          var result = document.querySelector('#smoove-list-create-result [data-list-id]');
          if (result) {
            var tf = document.getElementById(${JSON.stringify(targetFieldId)});
            var th = document.getElementById(${JSON.stringify(targetFieldId + '_value')});
            if (tf) { tf.value = result.dataset.listId + ': ' + result.dataset.listName; }
            if (th) { th.value = result.dataset.listId; }
            this.closest('dialog')?.close();
          }
        `}
      >
        <input type="hidden" name="targetFieldId" value=${targetFieldId} />
        <div class="mb-3">
          <label for="smoove-list-name" class="form-label">${t('smooveListDialog.listName')}</label>
          <input
            type="text"
            class="form-control"
            id="smoove-list-name"
            name="listName"
            required
            autofocus
          />
        </div>
        <div id="smoove-list-create-result"></div>
        <div class="d-flex justify-content-between mt-3">
          <button type="submit" class="btn btn-success btn-sm">
            ${t('smooveListDialog.create')}
            <span
              id="smoove-list-create-spinner"
              class="spinner-border spinner-border-sm htmx-indicator"
            ></span>
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            onclick="this.closest('dialog').close()"
          >
            ${t('smooveListDialog.cancel')}
          </button>
        </div>
      </form>
    </dialog>
  `
}

export function renderSmooveListCreateResult(listId: number, listName: string) {
  return html`<div data-list-id=${listId} data-list-name=${listName}>
    ${generateItemTitle(listId, listName)}
  </div>`
}

export function renderSmooveListCreateError(error: string) {
  return html`<div class="text-danger mt-2">${error}</div>`
}
