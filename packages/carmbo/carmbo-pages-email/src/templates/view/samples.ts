import {html} from '@giltayar/carmbo-commons/commons/html-templates'
import {previewVariables, type TemplateDraft} from '../schema.ts'
import {labels} from './labels.ts'

// Refreshed by the server whenever the subject, plain text or editor content changes.
const refresh = {
  'hx-post': '/emails/templates/samples',
  'hx-trigger': [
    'input changed delay:500ms from:#template-subject',
    'input changed delay:500ms from:#template-text',
    'template-changed delay:500ms from:#template-editor',
  ].join(', '),
  'hx-target': 'this',
  'hx-swap': 'outerHTML',
}

export function TemplateSamples({
  draft,
  readOnly,
}: {
  draft: TemplateDraft
  readOnly: boolean
}): string | string[] {
  const t = labels()
  const variables = previewVariables(draft)
  return html`<section
    id="template-samples"
    class="col-md-6 mt-4"
    aria-label=${t.samples}
    ...${readOnly ? {} : refresh}
  >
    <h5 class="border-bottom">${t.samples}</h5>
    <p class="text-body-secondary small">${t.samplesHelp}</p>
    ${
      variables.length > 0 &&
      html`<div class="card">
        <div class="card-body d-grid gap-3">
          ${variables.map(
            (name) =>
              html`<div class="form-floating">
                <input
                  id=${`template-sample-${name}`}
                  name=${`previewValues[${name}]`}
                  class="form-control"
                  placeholder=" "
                  autocomplete="off"
                  value=${draft.previewValues[name] ?? ''}
                />
                <label for=${`template-sample-${name}`}>${name}</label>
              </div>`,
          )}
        </div>
      </div>`
    }
  </section>`
}

export function renderTemplateSamples(draft: TemplateDraft): string | string[] {
  return html`<${TemplateSamples} draft=${draft} readOnly=${false} />`
}
