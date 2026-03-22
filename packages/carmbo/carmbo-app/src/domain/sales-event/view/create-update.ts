import {addQueryParamsToUrl} from '@giltayar/url-commons'
import {html} from '../../../commons/html-templates.ts'
import type {SalesEvent, SalesEventHistory, SalesEventWithHistoryInfo} from '../model/model.ts'
import {SalesEventCreateOrUpdateFormFields} from './form.ts'
import {SalesEventHistoryList, historyOperationToText} from './history.ts'
import {getFixedT} from 'i18next'

const t = getFixedT(null, 'salesEvent')

export function SalesEventCreateView({salesEvent}: {salesEvent: SalesEvent}) {
  return html`
    <h2 class="border-bottom col-md-6 mt-3">
      ${t('createUpdate.newSalesEvent')}
      <div class="operation-spinner spinner-border" role="status"></div>
    </h2>
    <form
      hx-post="/sales-events/"
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
        <${SalesEventCreateOrUpdateFormFields} salesEvent=${salesEvent} operation="write" />
      </div>
    </form>
  `
}

export function SalesEventUpdateView({
  salesEvent,
  history,
  options: {appBaseUrl, apiSecret},
}: {
  salesEvent: SalesEventWithHistoryInfo
  history: SalesEventHistory[]
  options: {appBaseUrl: string; apiSecret: string | undefined}
}) {
  return html`
    <h2 class="border-bottom col-md-6 mt-3">
      ${t('createUpdate.updateSalesEvent')} ${salesEvent.salesEventNumber}
      ${salesEvent.historyOperation === 'delete'
        ? html` <small class="text-body-secondary">${t('createUpdate.archived')}</small>`
        : ''}
      <div class="operation-spinner spinner-border" role="status"></div>
    </h2>
    <form
      hx-put="/sales-events/${salesEvent.salesEventNumber}"
      hx-target="form"
      class="col-md-6 mt-3"
      hx-indicator=".operation-spinner"
    >
      <input name="salesEventNumber" type="hidden" value=${salesEvent.salesEventNumber} />
      <input
        name="delete-operation"
        type="hidden"
        value=${salesEvent.historyOperation === 'delete' ? 'restore' : 'delete'}
      />
      <div class="ms-auto" style="width: fit-content">
        <section class="btn-group" aria-label="Form actions">
          ${salesEvent.historyOperation === 'delete'
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
        <${SalesEventCreateOrUpdateFormFields}
          salesEvent=${salesEvent}
          operation=${salesEvent.historyOperation === 'delete' ? 'read' : 'write'}
        />
      </div>
    </form>
    <div class="form-group col-md-6 mt-3">
      <h5 class="mb-3">${t('createUpdate.cardcomInformation')}</h5>
      <label style="width: 100%">
        ${t('createUpdate.cardcomWebhookUrl')}
        <input
          class="form-control"
          type="url"
          value=${addQueryParamsToUrl(new URL('/api/sales/cardcom/sale', appBaseUrl), {
            'sales-event': salesEvent.salesEventNumber.toString(),
            secret: apiSecret,
          }).href}
          readonly
        />
      </label>
    </div>
    <div class="form-group col-md-6 mt-3">
      <h5 class="mb-3">${t('createUpdate.smooveInformation')}</h5>
      <label style="width: 100%">
        ${t('createUpdate.smooveWebhookUrl')}
        <input
          class="form-control"
          type="url"
          value=${addQueryParamsToUrl(new URL('/api/sales/no-invoice-sale', appBaseUrl), {
            'sales-event': salesEvent.salesEventNumber.toString(),
            secret: apiSecret,
            email: '[[email]]',
            phone: '[[phone]]',
            cellPhone: '[[mobile]]',
            firstName: '[[first_name]]',
            lastName: '[[last_name]]',
          }).href}
          readonly
        />
      </label>
      <button
        type="button"
        class="btn btn-secondary mt-2"
        hx-get="/sales-events/${salesEvent.salesEventNumber}/import-smoove-dialog"
        hx-target="#import-smoove-dialog-container"
        hx-swap="innerHTML"
      >
        ${t('createUpdate.importFromSmoove')}
      </button>
      <div id="import-smoove-dialog-container"></div>
    </div>
    <${SalesEventHistoryList} salesEvent=${salesEvent} history=${history} />
  `
}

export function SalesEventHistoryView({
  salesEvent,
  history,
}: {
  salesEvent: SalesEventWithHistoryInfo
  history: SalesEventHistory[]
}) {
  const currentHistory = history.find((h) => h.historyId === salesEvent.id)

  return html`
    <h2 class="border-bottom col-md-6 mt-3">
      ${t('createUpdate.viewSalesEvent')} ${salesEvent.salesEventNumber}<> </>
      <small class="text-body-secondary"
        >(${historyOperationToText(currentHistory?.operation)})</small
      >
      <div class="operation-spinner spinner-border" role="status"></div>
    </h2>
    <form class="col-md-6 mt-3" hx-indicator=".operation-spinner">
      <input name="salesEventNumber" type="hidden" value=${salesEvent.salesEventNumber} readonly />
      <div class="mt-3">
        <${SalesEventCreateOrUpdateFormFields} salesEvent=${salesEvent} operation="read" />
      </div>
    </form>
    <${SalesEventHistoryList} salesEvent=${salesEvent} history=${history} />
  `
}
