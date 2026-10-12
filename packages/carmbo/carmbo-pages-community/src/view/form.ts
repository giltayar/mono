import {html} from '@giltayar/carmbo-commons/commons/html-templates'
import {getFixedT} from 'i18next'
import type {CommunityView} from './model.ts'

const t = getFixedT(null, 'community')

export function CommunityFormFields({
  community,
  operation,
}: {
  community: CommunityView
  operation: 'read' | 'write'
}) {
  const isReadOnly = operation === 'read'

  return html`
    <div class="communities-view_form-fields card">
      <div class="card-body">
        <div class="form-floating">
          <input
            name="name"
            type="text"
            value=${community.name}
            placeholder=" "
            required
            class="form-control"
            id="name"
            autocomplete="off"
            data-1p-ignore
            readonly=${isReadOnly}
          />
          <label for="name">${t('form.name')}</label>
        </div>
        <div class="mt-3 form-floating">
          <textarea
            name="description"
            placeholder=" "
            class="form-control"
            id="description"
            style="height: 120px"
            readonly=${isReadOnly}
          >
${community.description}</textarea>
          <label for="description">${t('form.description')}</label>
        </div>
      </div>
    </div>
  `
}
