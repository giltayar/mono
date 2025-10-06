import {html} from '../../../commons/html-templates.ts'
import {MainLayout} from '../../../layout/main-view.ts'
import {Layout} from './layout.ts'
import type {SalesEventForGrid} from '../model.ts'

export function renderSalesEventsPage(
  flash: string | undefined,
  salesEvents: SalesEventForGrid[],
  {withArchived, query, page}: {withArchived: boolean; query: string; page: number},
) {
  return html`
    <${MainLayout} title="Sales Events" flash=${flash} activeNavItem="sales-events">
      <${Layout}>
        <${SalesEventsView} salesEvents=${salesEvents} withArchived=${withArchived} query=${query} page=${page} />
      </${Layout}>
    </${MainLayout}>
  `
}

function SalesEventsView({
  salesEvents,
  withArchived,
  query,
  page,
}: {
  salesEvents: SalesEventForGrid[]
  withArchived: boolean
  query: string
  page: number
}) {
  return html`
    <div class="mt-3">
      <div class="title-and-search d-flex flex-row border-bottom align-items-baseline">
        <h2>Sales Events</h2>
        <form
          class="mb-1 ms-auto"
          action="/sales-events"
          hx-boost
          hx-trigger="input changed throttle:500ms"
        >
          <fieldset class="row align-items-center me-0">
            <label class="form-check-label form-check col-auto"
              ><input
                type="checkbox"
                class="form-check-input"
                name="with-archived"
                checked=${withArchived}
              />
              Show archived</label
            >
            <label class="form-input-label col-auto" for="query">Search:</label>
            <input
              type="search"
              name="q"
              id="query"
              class="form-control form-control-sm col"
              placeholder="Search"
              value=${query}
            />
          </fieldset>
        </form>
      </div>
      <table class="table mt-3">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Dates</th>
            <th>Products for Sale</th>
          </tr>
        </thead>
        <tbody>
          ${salesEvents.map(
            (salesEvent, i, l) => html`
              <tr
                ...${i === l.length - 1
                  ? {
                      'hx-get': `/sales-events?page=${encodeURIComponent(page + 1)}`,
                      'hx-trigger': 'revealed',
                      'hx-select': '.sales-events-view tbody tr',
                      'hx-include': '.sales-events-view form',
                      'hx-swap': 'afterend',
                    }
                  : {}}
              >
                <td>
                  <a
                    class="btn btn-light btn-sm"
                    role="button"
                    href="/sales-events/${salesEvent.salesEventNumber}"
                    >${salesEvent.salesEventNumber}</a
                  >
                </td>
                <td>${salesEvent.name}</td>
                <td dir="rtl">${formatDateRange(salesEvent.fromDate, salesEvent.toDate)}</td>
                <td>${salesEvent.productsForSale.join(', ')}</td>
              </tr>
            `,
          )}
        </tbody>
      </table>
      <section class="add-new">
        <a
          role="button"
          class="btn float-end"
          href="/sales-events/new"
          aria-label="new sales event"
        >
          <svg class="feather feather-large" viewbox="0 0 24 24">
            <use href="/src/layout/style/plus-circle.svg" />
          </svg>
        </a>
      </section>
    </div>
  `
}

function formatDateRange(fromDate: Date | undefined, toDate: Date | undefined) {
  if (!fromDate && !toDate) return ''
  if (!fromDate) return formatDateWithWeekday(toDate!)
  if (!toDate) return formatDateWithWeekday(fromDate)
  return html`${formatDateWithWeekday(fromDate)} ... ${formatDateWithWeekday(toDate)}`
}

function formatDateWithWeekday(date: Date) {
  const d = new Date(date)
  const dateStr = d.toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  const weekday = d.toLocaleDateString('he-IL', {weekday: 'short'})
  return html`${dateStr} <span class="weekday">(${weekday})</span>`
}
