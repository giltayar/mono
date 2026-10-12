import {html} from '@giltayar/carmbo-commons/commons/html-templates'
import {MainLayout} from '@giltayar/carmbo-commons/layout/main-view'
import {getVersion} from '@giltayar/carmbo-commons/commons/version'
import {getFixedT} from 'i18next'
import {Layout} from './layout.ts'
import type {CommunityListItemView} from './model.ts'

const t = getFixedT(null, 'community')

export function renderCommunitiesPage(
  communities: CommunityListItemView[],
  {withArchived, query, page}: {withArchived: boolean; query: string; page: number},
): string | string[] {
  return html`
    <${MainLayout} title=${t('list.communities')} activeNavItem="communities">
      <${Layout}>
        <${CommunitiesView}
          communities=${communities}
          withArchived=${withArchived}
          query=${query}
          page=${page}
        />
      </${Layout}>
    </${MainLayout}>
  `
}

function CommunitiesView({
  communities,
  withArchived,
  query,
  page,
}: {
  communities: CommunityListItemView[]
  withArchived: boolean
  query: string
  page: number
}) {
  return html`
    <div class="mt-3">
      <div class="title-and-search d-flex flex-row border-bottom align-items-baseline">
        <h2>${t('list.communities')}</h2>
        <form
          class="mb-1 ms-auto"
          hx-get="/communities"
          hx-target=".communities-view table"
          hx-select=".communities-view table"
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
            <th>${t('list.description')}</th>
          </tr>
        </thead>
        <tbody>
          ${communities.map(
            ({communityNumber, community}, i, l) => html`
              <tr
                ...${
                  i === l.length - 1
                    ? {
                        'hx-get': `/communities?page=${encodeURIComponent(page + 1)}`,
                        'hx-trigger': 'revealed',
                        'hx-select': '.communities-view tbody tr',
                        'hx-include': '.communities-view form',
                        'hx-swap': 'afterend',
                      }
                    : {}
                }
              >
                <td>
                  <a
                    class="btn btn-light btn-sm"
                    role="button"
                    href="/communities/${communityNumber}"
                    >${communityNumber}</a
                  >
                </td>
                <td>${community.name}</td>
                <td>${community.description}</td>
              </tr>
            `,
          )}
        </tbody>
      </table>
      <section class="add-new">
        <a
          role="button"
          class="btn float-end"
          href="/communities/new"
          aria-label=${t('list.newCommunity')}
        >
          <object
            type="image/svg+xml"
            class="feather feather-large"
            data=${`/src/${getVersion()}/layout/style/plus-circle.svg`}
          ></object>
        </a>
      </section>
    </div>
  `
}
