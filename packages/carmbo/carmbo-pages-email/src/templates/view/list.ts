import {html} from '@giltayar/carmbo-commons/commons/html-templates'
import {MainLayout} from '@giltayar/carmbo-commons/layout/main-view'
import {getVersion} from '@giltayar/carmbo-commons/commons/version'
import {templateTabs} from '../../layout/view.ts'
import {TEMPLATE_PAGE_SIZE} from '../schema.ts'
import type {TemplateListItem} from '../model.ts'
import {labels} from './labels.ts'

export function renderTemplateList(
  templates: TemplateListItem[],
  filter: {query: string; page: number; withArchived: boolean},
): string | string[] {
  const t = labels()
  const query = new URLSearchParams({q: filter.query})
  if (filter.withArchived) query.set('with-archived', 'true')
  query.set('page', String(filter.page + 1))
  return html`<${MainLayout} title=${t.templates} activeNavItem="emails">
    ${templateTabs('templates')}
    <link rel="stylesheet" href="/emails/templates/style.css" />
    <div class="email-templates-view mt-3">
      <div class="title-and-search d-flex flex-row flex-wrap gap-2 border-bottom align-items-baseline">
        <h2>${t.templates}</h2>
        <form class="mb-1 ms-auto" hx-get="/emails/templates" hx-target="#templates-table"
          hx-select="#templates-table" hx-swap="outerHTML" hx-push-url="true" hx-include="this"
          hx-trigger="input changed delay:500ms from:input[type=search], change from:input[type=checkbox], submit">
          <fieldset class="row align-items-center me-0">
            <label class="form-check-label form-check col-auto">
              <input class="form-check-input" type="checkbox" name="with-archived" checked=${filter.withArchived} />
              ${t.withArchived}
            </label>
            <label class="form-input-label col-auto" for="template-query">${t.search}</label>
            <input id="template-query" class="form-control form-control-sm col" type="search"
              name="q" placeholder=${t.searchPlaceholder} value=${filter.query} />
          </fieldset>
        </form>
      </div>
    <table id="templates-table" class="table mt-3" aria-label=${t.templates}>
      <thead><tr><th scope="col">${t.number}</th><th scope="col">${t.name}</th><th scope="col">${t.description}</th></tr></thead>
      <tbody>${templates.map(
        (item, index) =>
          html`<tr
            ...${
              index === templates.length - 1 && templates.length === TEMPLATE_PAGE_SIZE
                ? {
                    'hx-get': `/emails/templates?${query}`,
                    'hx-trigger': 'revealed',
                    'hx-select': '#templates-table tbody tr',
                    'hx-swap': 'afterend',
                  }
                : {}
            }
          >
            <td>
              <a class="btn btn-light btn-sm" role="button" href="/emails/templates/${item.number}"
                >${item.number}</a
              >
            </td>
            <td dir="auto">
              <span>${item.name}</span>
              ${item.archived ? html` <small class="text-body-secondary">(${t.archived})</small>` : ''}
            </td>
            <td dir="auto">${item.description}</td>
          </tr>`,
      )}
      ${
        templates.length === 0 && filter.page === 0
          ? html`<tr>
              <td colspan="3">${t.empty}</td>
            </tr>`
          : ''
      }
      </tbody>
    </table>
    <section class="add-new">
      <a role="button" class="btn float-end" href="/emails/templates/new" aria-label=${t.new}>
        <object type="image/svg+xml" class="feather feather-large" aria-hidden="true" tabindex="-1"
          data=${`/src/${getVersion()}/layout/style/plus-circle.svg`}></object>
      </a>
    </section>
    </div>
  </${MainLayout}>`
}
