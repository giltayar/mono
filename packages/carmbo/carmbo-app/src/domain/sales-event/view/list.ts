import {html} from '../../../commons/html-templates.ts'
import {MainLayout} from '../../../layout/main-view.ts'
import {Layout} from './layout.ts'
import type {SalesEventForGrid} from '../model/model.ts'
import {version} from '../../../commons/version.ts'
import {getFixedT} from 'i18next'

const t = getFixedT(null, 'salesEvent')

export function renderSalesEventsPage(
  flash: string | undefined,
  salesEvents: SalesEventForGrid[],
  {withArchived, query, page}: {withArchived: boolean; query: string; page: number},
) {
  return html`
    <${MainLayout} title=${t('list.salesEvents')} flash=${flash} activeNavItem="sales-events">
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
        <h2>${t('list.salesEvents')}</h2>
        <form
          class="mb-1 ms-auto"
          hx-get="/sales-events"
          hx-target=".sales-events-view table"
          hx-select=".sales-events-view table"
          hx-include="this"
          hx-trigger="input changed delay:500ms from:input[type=search], change from:input[type=checkbox]"
          hx-push-url="true"
          hx-swap="outerHTML"
        >
          <fieldset class="row align-items-center me-0">
            <label class="form-check-label form-check col-auto"
              ><input
                type="checkbox"
                class="form-check-input"
                name="with-archived"
                checked=${withArchived}
              />
              ${t('list.showArchived')}</label
            >
            <label class="form-input-label col-auto" for="query">${t('list.search')}</label>
            <input
              type="search"
              name="q"
              id="query"
              class="form-control form-control-sm col"
              placeholder=${t('list.searchPlaceholder')}
              value=${query}
            />
          </fieldset>
        </form>
      </div>
      <table class="table mt-3">
        <thead>
          <tr>
            <th>${t('list.id')}</th>
            <th>${t('list.name')}</th>
            <th>${t('list.dates')}</th>
            <th>${t('list.productsForSale')}</th>
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
                <td>
                  ${salesEvent.productsForSale.map(
                    (p, i) =>
                      html`${i > 0 ? ', ' : ''}<a href="/products/${p.productNumber}"
                          >${p.name}</a
                        >`,
                  )}
                </td>
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
          aria-label=${t('list.newSalesEvent')}
        >
          <object
            type="image/svg+xml"
            class="feather feather-large"
            data=${`/src/${version}/layout/style/plus-circle.svg`}
          ></object>
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
