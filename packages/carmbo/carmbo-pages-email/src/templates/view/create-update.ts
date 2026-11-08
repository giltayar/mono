import {html} from '@giltayar/carmbo-commons/commons/html-templates'
import {MainLayout} from '@giltayar/carmbo-commons/layout/main-view'
import type {Banner} from '@giltayar/carmbo-commons/layout/banner'
import i18next from 'i18next'
import {templateTabs} from '../../layout/view.ts'
import {editorAssetUrl} from '../assets.ts'
import type {TemplateDraft, TemplateHistory, TemplateRevision} from '../schema.ts'
import {labels} from './labels.ts'
import {TemplateSamples} from './samples.ts'

const [scriptUrl, styleUrl] = await Promise.all([
  editorAssetUrl('editor.js'),
  editorAssetUrl('editor.css'),
])

// `templateEditorDocument` is the editor island's synchronous bridge to the editor's JSON.
export const editorDocumentVals = 'js:{editorDocument: templateEditorDocument()}'

export type TemplatePage = {
  number: number | undefined
  draft: TemplateDraft
  revision: TemplateRevision | undefined
  historical: boolean
  history: TemplateHistory[]
}

export function templatePath(number: number | undefined): string {
  return `/emails/templates/${number ?? 'new'}`
}

function pageMode({revision, historical}: TemplatePage): {archived: boolean; readOnly: boolean} {
  const archived = revision?.operation === 'delete'
  return {archived, readOnly: historical || archived}
}

export function renderTemplatePage(
  page: TemplatePage,
  {banner}: {banner: Banner | undefined},
): string | string[] {
  const t = labels()
  const {revision, historical} = page
  const {archived} = pageMode(page)
  return html`<${MainLayout}
    title=${revision ? revision.template.name : t.new}
    activeNavItem="emails"
    banner=${banner}
  >
    ${templateTabs('templates')}
    <link rel="stylesheet" href=${styleUrl} />
    <div class="email-template">
      <h2 class="template-heading border-bottom col-md-6 mt-3">
        ${revision ? revision.template.name : t.new}
        ${
          historical || archived
            ? html`<small class="text-body-secondary">
                (${historical ? t.historical : t.archived})
              </small>`
            : ''
        }
      </h2>
      <${TemplateForm} page=${page} />
      <${PreviewActions} page=${page} />
      <div id="template-dialog-slot"></div>
      <${TemplateHistoryList} revision=${revision} history=${page.history} />
    </div>
    <script type="module" src=${scriptUrl}></script>
  </${MainLayout}>`
}

export function renderTemplateForm(page: TemplatePage): string | string[] {
  return html`<${TemplateForm} page=${page} />`
}

function TemplateForm({page}: {page: TemplatePage}): string | string[] {
  const t = labels()
  const {number, draft, revision, historical} = page
  const {archived, readOnly} = pageMode(page)
  const path = templatePath(number)
  const save = readOnly
    ? {}
    : number === undefined
      ? {'hx-post': '/emails/templates/', 'hx-target': 'body'}
      : {'hx-put': path, 'hx-target': '#template-form', 'hx-swap': 'outerHTML'}
  const busy = {'hx-indicator': '#template-form-busy', 'hx-disabled-elt': 'this'}

  return html`<form
    id="template-form"
    ...${save}
    hx-vals=${editorDocumentVals}
    hx-indicator="#template-form-busy"
    hx-disabled-elt="find .template-action-buttons"
    hx-disinherit="hx-target hx-swap hx-indicator hx-disabled-elt"
  >
    <div class="template-actions col-md-6 mt-3 d-flex justify-content-end align-items-center gap-2">
      <p id="template-form-busy" class="template-busy mb-0" role="status">${t.busy}</p>
      <fieldset class="template-action-buttons btn-group">
        ${
          !readOnly
            ? html`
                <a class="btn btn-secondary" href=${path}>${t.discard}</a>
                ${
                  number !== undefined &&
                  html`<button
                    type="button"
                    class="btn btn-danger"
                    hx-delete=${`${path}?delete-operation=delete`}
                    hx-params="none"
                    hx-target="body"
                    ...${busy}
                    data-editor-required
                    disabled
                  >
                    ${t.archive}
                  </button>`
                }
                <button type="submit" class="btn btn-primary" data-editor-required disabled>
                  ${t.save}
                </button>
              `
            : ''
        }
        ${
          archived && !historical && revision
            ? html`<button
                type="button"
                class="btn btn-danger"
                hx-delete=${`${path}?delete-operation=restore`}
                hx-params="none"
                hx-target="body"
                ...${busy}
              >
                ${t.restore}
              </button>`
            : ''
        }
      </fieldset>
    </div>
    <fieldset disabled=${readOnly}>
      <div class="template-fields card col-md-6 mt-3">
        <div class="card-body d-grid gap-3">
          <div class="form-floating">
            <input
              id="template-name"
              name="name"
              class="form-control"
              placeholder=" "
              required
              autocomplete="off"
              value=${draft.name}
            />
            <label for="template-name">${t.name}</label>
          </div>
          <div class="form-floating">
            <textarea
              id="template-description"
              name="description"
              class="form-control template-description"
              placeholder=" "
            >
${draft.description}</textarea>
            <label for="template-description">${t.description}</label>
          </div>
          <div class="form-floating">
            <select
              id="template-language"
              name="language"
              class="form-select"
              hx-on:change="document.getElementById('template-text').dir = this.value === 'he' ? 'rtl' : 'ltr'"
            >
              <option value="en" selected=${draft.language === 'en'}>${t.english}</option>
              <option value="he" selected=${draft.language === 'he'}>${t.hebrew}</option>
            </select>
            <label for="template-language">${t.language}</label>
          </div>
          <div class="form-floating">
            <input
              id="template-subject"
              name="subject"
              class="form-control"
              placeholder=" "
              dir="auto"
              required
              autocomplete="off"
              value=${draft.subject}
            />
            <label for="template-subject">${t.subject}</label>
          </div>
          <div class="form-floating">
            <textarea
              id="template-text"
              name="text"
              class="form-control template-text"
              placeholder=" "
              dir=${draft.language === 'he' ? 'rtl' : 'ltr'}
            >
${draft.text}</textarea>
            <label for="template-text">${t.text}</label>
          </div>
        </div>
      </div>
      <section class="mt-4" aria-label=${t.html}>
        <h5 class="border-bottom">${t.html}</h5>
        <div class="card">
          <div class="card-body">
            <div
              id="template-editor"
              data-template-editor
              data-language=${draft.language}
              data-readonly=${String(readOnly)}
              data-document=${JSON.stringify(draft.editorDocument)}
            ></div>
          </div>
        </div>
      </section>
      <${TemplateSamples} draft=${draft} readOnly=${readOnly} />
    </fieldset>
  </form>`
}

function PreviewActions({page}: {page: TemplatePage}): string | string[] {
  const t = labels()
  const {number, revision, historical} = page
  const {readOnly} = pageMode(page)
  const path = templatePath(number)
  const editable = {
    'hx-include': '#template-form',
    'hx-vals': editorDocumentVals,
    'data-editor-required': true,
    disabled: true,
  }
  const rawHtml = readOnly
    ? {
        'hx-get': `${path}/raw-html${
          historical && revision ? `?history-id=${revision.historyId}` : ''
        }`,
      }
    : {'hx-post': `${path}/raw-html`, ...editable}

  return html`<section class="col-md-6 mt-4" aria-label=${t.preview}>
    <h5 class="border-bottom">${t.preview}</h5>
    <div class="d-flex flex-wrap gap-2">
      <button
        type="button"
        class="btn btn-outline-primary"
        hx-target="#template-dialog-slot"
        ...${rawHtml}
      >
        ${t.rawHtml}
      </button>
      ${
        !readOnly &&
        html`
          <button
            type="button"
            class="btn btn-outline-primary"
            hx-post=${`${path}/preview`}
            hx-target="#template-dialog-slot"
            ...${editable}
          >
            ${t.preview}
          </button>
          <button
            type="button"
            class="btn btn-outline-primary"
            hx-get=${`${path}/send-preview`}
            hx-target="#template-dialog-slot"
            data-editor-required
            disabled
          >
            ${t.sendPreview}
          </button>
        `
      }
    </div>
  </section>`
}

function TemplateHistoryList({
  revision,
  history,
}: {
  revision: TemplateRevision | undefined
  history: TemplateHistory[]
}): string | string[] {
  const t = labels()
  if (!revision) return ''
  return html`<section class="template-history col-md-6 mt-3 pb-3" aria-label=${t.history}>
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
}
