import {html} from '../../../commons/html-templates.ts'
import {MainLayout} from '../../../layout/main-view.ts'
import {Layout} from './layout.ts'
import type {ProductForGrid} from '../model.ts'
import {version} from '../../../commons/version.ts'
import {getFixedT} from 'i18next'

const t = getFixedT(null, 'product')

export function renderProductsPage(
  flash: string | undefined,
  products: ProductForGrid[],
  {withArchived, query, page}: {withArchived: boolean; query: string; page: number},
) {
  return html`
    <${MainLayout} title=${t('list.products')} flash=${flash} activeNavItem="products">
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
        <h2>${t('list.products')}</h2>
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
            <th>${t('list.type')}</th>
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
        <a
          role="button"
          class="btn float-end"
          href="/products/new"
          aria-label=${t('list.newProduct')}
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
