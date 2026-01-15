import {html} from '../../../commons/html-templates.ts'
import {MainLayout} from '../../../layout/main-view.ts'
import {Layout} from './layout.ts'
import type {SaleForGrid} from '../model/model.ts'

export function renderSalesPage(
  flash: string | undefined,
  sales: SaleForGrid[],
  {withArchived, query, page}: {withArchived: boolean; query: string; page: number},
) {
  return html`
    <${MainLayout} title="Sales" flash=${flash} activeNavItem="sales">
      <${Layout}>
        <${SalesView} sales=${sales} withArchived=${withArchived} query=${query} page=${page} />
      </${Layout}>
    </${MainLayout}>
  `
}

function SalesView({
  sales,
  withArchived,
  query,
  page,
}: {
  sales: SaleForGrid[]
  withArchived: boolean
  query: string
  page: number
}) {
  return html`
    <div class="mt-3">
      <div class="title-and-search d-flex flex-row border-bottom align-items-baseline">
        <h2>Sales</h2>
        <form
          class="mb-1 ms-auto"
          action="/sales"
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
            <th>Sale #</th>
            <th>Date</th>
            <th>Event</th>
            <th>Student</th>
            <th>Revenue</th>
            <th>Products</th>
          </tr>
        </thead>
        <tbody>
          ${sales.map(
            (sale, i, l) => html`
              <tr
                ...${i === l.length - 1
                  ? {
                      'hx-get': `/sales?page=${encodeURIComponent(page + 1)}`,
                      'hx-trigger': 'revealed',
                      'hx-select': '.sales-view tbody tr',
                      'hx-include': '.sales-view form',
                      'hx-swap': 'afterend',
                    }
                  : {}}
              >
                <td>
                  <a class="btn btn-light btn-sm" role="button" href="/sales/${sale.saleNumber}"
                    >${sale.saleNumber}</a
                  >
                </td>
                <td>${formatDate(sale.timestamp)}</td>
                <td>
                  <a href="/sales-events/${sale.salesEventNumber}">${sale.saleEventName}</a>
                </td>
                <td>
                  <a href="/students/${sale.studentNumber}">${sale.studentName}</a>
                </td>
                <td>${sale.finalSaleRevenue ? `₪${sale.finalSaleRevenue.toFixed(2)}` : '-'}</td>
                <td>${sale.products.join(', ')}</td>
              </tr>
            `,
          )}
        </tbody>
      </table>
      <section class="add-new">
        <a role="button" class="btn float-end" href="/sales/new" aria-label="new sale">
          <object
            type="image/svg+xml"
            class="feather feather-large"
            data="/src/layout/style/plus-circle.svg"
          ></object>
        </a>
      </section>
    </div>
  `
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-IL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
