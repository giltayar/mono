import {html} from '../../../commons/html-templates.ts'
import type {NewSale} from '../model.ts'
import {SalesFormFields} from './form.ts'

export function SaleCreateView({sale}: {sale: NewSale}) {
  return html`
    <h2 class="border-bottom col-md-6 mt-3">New Sale</h2>
    <form hx-post="/sales/" hx-target="body" class="col-md-6 mt-3">
      <div class="ms-auto" style="width: fit-content">
        <section class="btn-group" aria-label="Form actions">
          <button class="btn btn-secondary discard" type="Submit" value="discard">Discard</button>
          <button class="btn btn-primary" type="Submit" value="save">Create</button>
        </section>
      </div>
      <div class="mt-3">
        <${SalesFormFields} sale=${sale} operation="write" />
      </div>
    </form>
  `
}
