import type {AcademyCourse} from '@giltayar/carmel-tools-academy-integration/types'
import {html} from '../../../commons/html-templates.ts'
import type {Product, ProductHistory, ProductWithHistoryInfo} from '../model.ts'
import {ProductCreateOrUpdateFormFields} from './form.ts'
import {ProductHistoryList, historyOperationToText} from './history.ts'

export function ProductCreateView({product}: {product: Product}) {
  return html`
    <h2 class="border-bottom col-md-6 mt-3">New Product</h2>
    <form hx-post="/products/" hx-target="body" class="col-md-6 mt-3">
      <div class="ms-auto" style="width: fit-content">
        <section class="btn-group" aria-label="Form actions">
          <button class="btn btn-secondary discard" type="Submit" value="discard">Discard</button>
          <button class="btn btn-primary" type="Submit" value="save">Create</button>
        </section>
      </div>
      <div class="mt-3">
        <${ProductCreateOrUpdateFormFields} product=${product} operation="write" />
      </div>
    </form>
  `
}

export function ProductUpdateView({
  product,
  history,
  courses,
}: {
  product: ProductWithHistoryInfo
  history: ProductHistory[]
  courses: AcademyCourse[]
}) {
  return html`
    <h2 class="border-bottom col-md-6 mt-3">
      Update Product ${product.productNumber}
      ${product.historyOperation === 'delete'
        ? html` <small class="text-body-secondary">(archived)</small>`
        : ''}
    </h2>
    <form hx-put="/products/${product.productNumber}" hx-target="form" class="col-md-6 mt-3">
      <input name="productNumber" type="hidden" value=${product.productNumber} />
      <input
        name="delete-operation"
        type="hidden"
        value=${product.historyOperation === 'delete' ? 'restore' : 'delete'}
      />
      <div class="ms-auto" style="width: fit-content">
        <section class="btn-group" aria-label="Form actions">
          ${product.historyOperation === 'delete'
            ? html`
                <button
                  class="btn btn-danger"
                  type="Submit"
                  value="delete"
                  hx-delete=""
                  hx-params="delete-operation"
                >
                  Restore
                </button>
              `
            : html`
                <button class="btn btn-secondary discard" type="Submit" value="discard">
                  Discard
                </button>
                <button
                  class="btn btn-danger"
                  type="Submit"
                  value="delete"
                  hx-delete=""
                  hx-params="delete-operation"
                >
                  Archive
                </button>
                <button class="btn btn-primary" type="Submit" value="save">Update</button>
              `}
        </section>
      </div>
      <div class="mt-3">
        <${ProductCreateOrUpdateFormFields}
          product=${product}
          operation=${product.historyOperation === 'delete' ? 'read' : 'write'}
          courses=${courses}
        />
      </div>
    </form>
    <${ProductHistoryList} product=${product} history=${history} />
  `
}

export function ProductHistoryView({
  product,
  history,
}: {
  product: ProductWithHistoryInfo
  history: ProductHistory[]
}) {
  const currentHistory = history.find((h) => h.historyId === product.id)

  return html`
    <h2 class="border-bottom col-md-6 mt-3">
      View Product ${product.productNumber}<> </>
      <small class="text-body-secondary"
        >(${historyOperationToText(currentHistory?.operation)})</small
      >
    </h2>
    <form class="col-md-6 mt-3">
      <input name="productNumber" type="hidden" value=${product.productNumber} readonly />
      <div class="mt-3">
        <${ProductCreateOrUpdateFormFields} product=${product} operation="read" />
      </div>
    </form>
    <${ProductHistoryList} product=${product} history=${history} />
  `
}
