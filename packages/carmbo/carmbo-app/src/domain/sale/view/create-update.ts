import {html} from '../../../commons/html-templates.ts'
import {getFixedT} from 'i18next'
import type {NewSale} from '../model/model.ts'
import {SalesFormFields} from './form.ts'

export function SaleCreateView({sale}: {sale: NewSale}) {
  const t = getFixedT(null, 'sales')
  return html`
    <h2 class="border-bottom col-md-6 mt-3">
      ${t('createUpdate.newSale')}
      <div class="operation-spinner spinner-border" role="status"></div>
    </h2>
    <form
      hx-post="/sales/"
      hx-target="body"
      class="col-md-6 mt-3"
      hx-indicator=".operation-spinner"
    >
      <div class="ms-auto" style="width: fit-content">
        <section class="btn-group" aria-label="Form actions">
          <button class="btn btn-secondary discard" type="Submit" value="discard">
            ${t('createUpdate.discard')}
          </button>
          <button class="btn btn-primary" type="Submit" value="save">
            ${t('createUpdate.create')}
          </button>
        </section>
      </div>
      <div class="mt-3">
        <${SalesFormFields} sale=${sale} operation="write" />
      </div>
    </form>
    <div
      id="student-search-dialog-container"
      hx-on::after-swap="this.querySelector('dialog')?.showModal()"
    ></div>
  `
}
