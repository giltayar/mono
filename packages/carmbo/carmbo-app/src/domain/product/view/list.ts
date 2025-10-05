import {html} from '../../../commons/html-templates.ts'
import {MainLayout} from '../../../layout/main-view.ts'
import {Layout} from './layout.ts'
import type {ProductForGrid} from '../model.ts'

export function renderProductsPage(
  flash: string | undefined,
  products: ProductForGrid[],
  {withArchived, query, page}: {withArchived: boolean; query: string; page: number},
) {
  return html`
    <${MainLayout} title="Products" flash=${flash} activeNavItem="products">
      <${Layout}>
        <${ProductsView} products=${products} withArchived=${withArchived} query=${query} page=${page} />
      </${Layout}>
    </${MainLayout}>
  `
}

function ProductsView({
  products,
  withArchived,
  query,
  page,
}: {
  products: ProductForGrid[]
  withArchived: boolean
  query: string
  page: number
}) {
  return html`
    <div class="mt-3">
      <div class="title-and-search d-flex flex-row border-bottom align-items-baseline">
        <h2>Products</h2>
        <form
          class="mb-1 ms-auto"
          action="/products"
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
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          ${products.map(
            (product, i, l) => html`
              <tr
                ...${i === l.length - 1
                  ? {
                      'hx-get': `/products?page=${encodeURIComponent(page + 1)}`,
                      'hx-trigger': 'revealed',
                      'hx-select': '.products-view tbody tr',
                      'hx-include': '.products-view form',
                      'hx-swap': 'afterend',
                    }
                  : {}}
              >
                <td>
                  <a
                    class="btn btn-light btn-sm"
                    role="button"
                    href="/products/${product.productNumber}"
                    >${product.productNumber}</a
                  >
                </td>
                <td>${product.name}</td>
                <td>${product.productType}</td>
              </tr>
            `,
          )}
        </tbody>
      </table>
      <section class="add-new">
        <a role="button" class="btn float-end" href="/products/new" aria-label="new product">
          <svg class="feather feather-large" viewbox="0 0 24 24">
            <use href="/src/layout/style/plus-circle.svg" />
          </svg>
        </a>
      </section>
    </div>
  `
}
