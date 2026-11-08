import {html} from '@giltayar/carmbo-commons/commons/html-templates'
import {MainLayout} from '@giltayar/carmbo-commons/layout/main-view'
import {getVersion} from '@giltayar/carmbo-commons/commons/version'
import i18next from 'i18next'
import en from './locale/en.json' with {type: 'json'}
import he from './locale/he.json' with {type: 'json'}
import type {Template, TemplateHistory, TemplateRevision} from './schema.ts'
import {TEMPLATE_PAGE_SIZE} from './schema.ts'
import type {TemplateListItem} from './model.ts'
import {editorAssetUrl} from './assets.ts'

const [scriptUrl, styleUrl] = await Promise.all([
  editorAssetUrl('editor.js'),
  editorAssetUrl('editor.css'),
])

export type Labels = typeof en
export function labels(): Labels {
  return i18next.resolvedLanguage?.startsWith('he') ? he : en
}
export type EditorPage = {
  template: Template
  number: number | undefined
  readOnly: boolean
  archived: boolean
  historical: boolean
  labels: Labels
}

export function templateTabs(activeTab: 'emails' | 'templates'): string | string[] {
  const t = labels()
  return html`<nav class="nav nav-tabs my-3" aria-label=${t.templates}>
    <a
      class="nav-link ${activeTab === 'emails' ? 'active' : ''}"
      aria-current=${activeTab === 'emails' ? 'page' : undefined}
      href="/emails"
      >${t.emails}</a
    >
    <a
      class="nav-link ${activeTab === 'templates' ? 'active' : ''}"
      aria-current=${activeTab === 'templates' ? 'page' : undefined}
      href="/emails/templates"
      >${t.templates}</a
    >
  </nav>`
}

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

export function renderTemplatePage(
  template: Template,
  revision: TemplateRevision | undefined,
  historical: boolean,
  history: TemplateHistory[],
): string | string[] {
  const t = labels()
  const archived = revision?.operation === 'delete'
  const data: EditorPage = {
    template,
    number: revision?.number,
    readOnly: historical || archived,
    archived,
    historical,
    labels: t,
  }
  return html`<${MainLayout} title=${revision ? template.name : t.new} activeNavItem="emails">
    ${templateTabs('templates')}
    <h2 class="template-heading border-bottom col-md-6 mt-3">
      ${revision ? template.name : t.new}
      ${
        historical || archived
          ? html`<small class="text-body-secondary">
              (${historical ? t.historical : t.archived})
            </small>`
          : ''
      }
    </h2>
    <link rel="stylesheet" href=${styleUrl} />
    <div data-template-page data-template-state=${JSON.stringify(data)}>
      <p role="status">${t.busy}</p>
    </div>
    <script type="module" src=${scriptUrl}></script>
    ${
      revision
        ? html`<section class="template-history col-md-6 mt-3 pb-3" aria-label=${t.history}>
            <h5 class="border-bottom">${t.history}</h5>
            <a href="/emails/templates/${revision.number}">${t.current}</a>
            <ul class="list-group mt-3">
              ${history.map(
                (item) =>
                  html`<li class="list-group-item d-flex gap-2">
                    <a
                      class=${item.id === revision.historyId ? 'fw-bold' : undefined}
                      aria-current=${item.id === revision.historyId ? 'page' : undefined}
                      href="/emails/templates/${revision.number}/by-history/${item.id}"
                    >
                      ${t.operations[item.operation]}
                    </a>
                    <time
                      class="ms-auto"
                      datetime=${item.timestamp.toISOString()}
                      title=${item.timestamp.toLocaleTimeString(i18next.language)}
                      >${item.timestamp.toLocaleDateString(i18next.language)}</time
                    >
                  </li>`,
              )}
            </ul>
          </section>`
        : ''
    }
  </${MainLayout}>`
}
