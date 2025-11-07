import {addQueryParamsToUrl} from '@giltayar/url-commons'
import {html} from '../../../commons/html-templates.ts'
import type {SalesEvent, SalesEventHistory, SalesEventWithHistoryInfo} from '../model.ts'
import {SalesEventCreateOrUpdateFormFields} from './form.ts'
import {SalesEventHistoryList, historyOperationToText} from './history.ts'

export function SalesEventCreateView({salesEvent}: {salesEvent: SalesEvent}) {
  return html`
    <h2 class="border-bottom col-md-6 mt-3">
      New Sales Event
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
          <button class="btn btn-secondary discard" type="Submit" value="discard">Discard</button>
          <button class="btn btn-primary" type="Submit" value="save">Create</button>
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
      Update Sales Event ${salesEvent.salesEventNumber}
      ${salesEvent.historyOperation === 'delete'
        ? html` <small class="text-body-secondary">(archived)</small>`
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
        <${SalesEventCreateOrUpdateFormFields}
          salesEvent=${salesEvent}
          operation=${salesEvent.historyOperation === 'delete' ? 'read' : 'write'}
        />
      </div>
    </form>
    <div class="form-group col-md-6 mt-3">
      <h3 class="mb-3">Cardcom Information</h3>
      <label style="width: 100%">
        CardCom Webhook URL
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
      View Sales Event ${salesEvent.salesEventNumber}<> </>
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
