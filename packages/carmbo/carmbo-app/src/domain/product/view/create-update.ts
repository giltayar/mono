import type {AcademyCourse} from '@giltayar/carmel-tools-academy-integration/types'
import {html} from '../../../commons/html-templates.ts'
import type {Product, ProductHistory, ProductWithHistoryInfo} from '../model.ts'
import {ProductCreateOrUpdateFormFields} from './form.ts'
import {ProductHistoryList, historyOperationToText} from './history.ts'
import {getFixedT} from 'i18next'

const t = getFixedT(null, 'product')

export function ProductCreateView({
  product,
  withAcademyIntegration,
  withSmooveIntegration,
}: {
  product: Product
  withAcademyIntegration: boolean
  withSmooveIntegration: boolean
}) {
  return html`
    <h2 class="border-bottom col-md-6 mt-3">
      ${t('createUpdate.newProduct')}
      <div class="operation-spinner spinner-border" role="status"></div>
    </h2>
    <form
      hx-post="/products/"
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
        <${ProductCreateOrUpdateFormFields}
          product=${product}
          operation="write"
          withAcademyIntegration=${withAcademyIntegration}
          withSmooveIntegration=${withSmooveIntegration}
        />
      </div>
    </form>
    <div
      id="smoove-list-create-dialog-container"
      hx-on::after-swap="this.querySelector('dialog')?.showModal()"
    ></div>
  `
}

export function ProductUpdateView({
  product,
  history,
  courses,
  withAcademyIntegration,
  withSmooveIntegration,
}: {
  product: ProductWithHistoryInfo
  history: ProductHistory[]
  courses: AcademyCourse[]
  withAcademyIntegration: boolean
  withSmooveIntegration: boolean
}) {
  return html`
    <h2 class="border-bottom col-md-6 mt-3">
      ${t('createUpdate.updateProduct')} ${product.productNumber}
      ${product.historyOperation === 'delete'
        ? html` <small class="text-body-secondary">${t('createUpdate.archived')}</small>`
        : ''}
      <div class="operation-spinner spinner-border" role="status"></div>
    </h2>
    <form
      hx-put="/products/${product.productNumber}"
      hx-target="form"
      class="col-md-6 mt-3"
      hx-indicator=".operation-spinner"
    >
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
                  ${t('createUpdate.restore')}
                </button>
              `
            : html`
                <button class="btn btn-secondary discard" type="Submit" value="discard">
                  ${t('createUpdate.discard')}
                </button>
                <button
                  class="btn btn-danger"
                  type="Submit"
                  value="delete"
                  hx-delete=""
                  hx-params="delete-operation"
                >
                  ${t('createUpdate.archive')}
                </button>
                <button class="btn btn-primary" type="Submit" value="save">
                  ${t('createUpdate.update')}
                </button>
              `}
        </section>
      </div>
      <div class="mt-3">
        <${ProductCreateOrUpdateFormFields}
          product=${product}
          operation=${product.historyOperation === 'delete' ? 'read' : 'write'}
          courses=${courses}
          withAcademyIntegration=${withAcademyIntegration}
          withSmooveIntegration=${withSmooveIntegration}
        />
      </div>
    </form>
    <div
      id="smoove-list-create-dialog-container"
      hx-on::after-swap="this.querySelector('dialog')?.showModal()"
    ></div>
    <${ProductHistoryList} product=${product} history=${history} />
  `
}

export function ProductHistoryView({
  product,
  history,
  withAcademyIntegration,
  withSmooveIntegration,
}: {
  product: ProductWithHistoryInfo
  history: ProductHistory[]
  withAcademyIntegration: boolean
  withSmooveIntegration: boolean
}) {
  const currentHistory = history.find((h) => h.historyId === product.id)

  return html`
    <h2 class="border-bottom col-md-6 mt-3">
      ${t('createUpdate.viewProduct')} ${product.productNumber}<> </>
      <small class="text-body-secondary"
        >(${historyOperationToText(currentHistory?.operation)})</small
      >
      <div class="operation-spinner spinner-border" role="status"></div>
    </h2>
    <form class="col-md-6 mt-3" hx-indicator=".operation-spinner">
      <input name="productNumber" type="hidden" value=${product.productNumber} readonly />
      <div class="mt-3">
        <${ProductCreateOrUpdateFormFields}
          product=${product}
          operation="read"
          withAcademyIntegration=${withAcademyIntegration}
          withSmooveIntegration=${withSmooveIntegration}
        />
      </div>
    </form>
    <${ProductHistoryList} product=${product} history=${history} />
  `
}
