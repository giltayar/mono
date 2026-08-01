import {html} from '../../../commons/html-templates.ts'
import {getFixedT} from 'i18next'
import type {SaleWithHistoryInfo} from '../model/model.ts'

export function RefundDialog({sale}: {sale: SaleWithHistoryInfo}) {
  const t = getFixedT(null, 'sale')
  const isManualSale = sale.manualSaleType === 'manual'

  return html`
    <dialog id="refund-dialog" class="refund-dialog" aria-labelledby="refund-dialog-title">
      <form
        hx-post="/sales/${sale.saleNumber}/refund"
        hx-indicator=".operation-spinner"
        class="d-grid gap-3"
      >
        <h5 id="refund-dialog-title" class="mb-0">${t('refundDialog.title')}</h5>

        ${
          isManualSale
            ? html`<div class="alert alert-warning mb-0" role="alert">
                ${t('refundDialog.manualWarning')}
              </div>`
            : undefined
        }

        <fieldset class="d-grid gap-2">
          <legend class="visually-hidden">${t('refundDialog.refundType')}</legend>
          <div class="form-check">
            <input
              class="form-check-input"
              type="radio"
              name="refundType"
              id="refund-type-full"
              value="full"
              checked
              onchange="this.form.elements.partialSum.disabled = true"
            />
            <label class="form-check-label" for="refund-type-full">
              ${t('refundDialog.fullRefund')}
            </label>
          </div>
          <div class="form-check d-flex align-items-center gap-2">
            <input
              class="form-check-input mt-0"
              type="radio"
              name="refundType"
              id="refund-type-partial"
              value="partial"
              disabled=${isManualSale}
              onchange="this.form.elements.partialSum.disabled = false; this.form.elements.partialSum.focus()"
            />
            <label class="form-check-label" for="refund-type-partial">
              ${t('refundDialog.partialRefund')}
            </label>
            <div class="input-group input-group-sm refund-dialog_amount">
              <span class="input-group-text">₪</span>
              <input
                class="form-control"
                type="number"
                name="partialSum"
                aria-label=${t('refundDialog.amount')}
                min="0.01"
                step="0.01"
                disabled
                required
              />
            </div>
          </div>
        </fieldset>

        <div class="d-flex justify-content-end gap-2">
          <button type="button" class="btn btn-secondary" onclick="this.closest('dialog').close()">
            ${t('refundDialog.cancel')}
          </button>
          <button type="submit" class="btn btn-danger">${t('refundDialog.refund')}</button>
        </div>
      </form>
    </dialog>
  `
}
