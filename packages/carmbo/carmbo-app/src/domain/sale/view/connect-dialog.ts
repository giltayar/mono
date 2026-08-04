import {html} from '../../../commons/html-templates.ts'
import {getFixedT} from 'i18next'
import type {SaleWithHistoryInfo} from '../model/model.ts'

export function ConnectDialog({sale}: {sale: SaleWithHistoryInfo}) {
  const t = getFixedT(null, 'sale')

  return html`
    <dialog id="connect-dialog" class="connect-dialog" aria-labelledby="connect-dialog-title">
      <form
        hx-post="/sales/${sale.saleNumber}/connect"
        hx-include="#sale-form"
        hx-indicator=".operation-spinner"
        class="d-grid gap-3"
      >
        <h5 id="connect-dialog-title" class="mb-0">${t('connectDialog.title')}</h5>

        <fieldset class="d-grid gap-2">
          <legend class="fs-6">${t('connectDialog.invoiceQuestion')}</legend>
          <div class="form-check">
            <input
              class="form-check-input"
              type="radio"
              name="createInvoice"
              id="create-invoice-yes"
              value="true"
              required
            />
            <label class="form-check-label" for="create-invoice-yes">
              ${t('connectDialog.createInvoice')}
            </label>
          </div>
          <div class="form-check">
            <input
              class="form-check-input"
              type="radio"
              name="createInvoice"
              id="create-invoice-no"
              value="false"
              required
            />
            <label class="form-check-label" for="create-invoice-no">
              ${t('connectDialog.doNotCreateInvoice')}
            </label>
          </div>
        </fieldset>

        <div class="d-flex justify-content-end gap-2">
          <button type="button" class="btn btn-secondary" onclick="this.closest('dialog').close()">
            ${t('connectDialog.cancel')}
          </button>
          <button type="submit" class="btn btn-primary">${t('connectDialog.connect')}</button>
        </div>
      </form>
    </dialog>
  `
}
