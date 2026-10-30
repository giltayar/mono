import {html} from '@giltayar/carmbo-commons/commons/html-templates'
import {getFixedT} from 'i18next'
import {CommunityFormFields} from './form.ts'
import {CommunityHistoryList, historyOperationToText} from './history.ts'
import type {CommunityPageView, CommunityView} from './model.ts'
import {CommunityTabs} from './layout.ts'

const t = getFixedT(null, 'community')

export function CommunityCreateView({community}: {community: CommunityView}) {
  return html`
    <h2 class="border-bottom col-md-6 mt-3">
      ${t('form.newCommunity')}
      <div class="operation-spinner spinner-border" role="status"></div>
    </h2>
    <form
      hx-post="/communities/"
      hx-target="body"
      class="col-md-6 mt-3"
      hx-indicator=".operation-spinner"
    >
      <div class="ms-auto" style="width: fit-content">
        <section class="btn-group" aria-label="Form actions">
          <button class="btn btn-secondary discard" type="Submit" value="discard">
            ${t('createUpdate.discard')}
          </button>
          <button class="btn btn-primary" type="Submit" value="save">
            ${t('createUpdate.create')}
          </button>
        </section>
      </div>
      <div class="mt-3">
        <${CommunityFormFields} community=${community} operation="write" />
      </div>
    </form>
  `
}

export function CommunityUpdateView({page}: {page: CommunityPageView}) {
  const isArchived = page.historyOperation === 'delete'

  return html`
    <h2 class="border-bottom col-md-6 mt-3">
      ${t('createUpdate.updateCommunity')} ${page.communityNumber}
      ${isArchived ? html` <small class="text-body-secondary">${t('createUpdate.archived')}</small>` : ''}
      <div class="operation-spinner spinner-border" role="status"></div>
    </h2>
    <${CommunityTabs} communityNumber=${page.communityNumber} activeTab="details" />
    <form
      hx-put="/communities/${page.communityNumber}"
      hx-target="body"
      class="col-md-6 mt-3"
      hx-indicator=".operation-spinner"
    >
      <input name="delete-operation" type="hidden" value=${isArchived ? 'restore' : 'delete'} />
      <div class="ms-auto" style="width: fit-content">
        <section class="btn-group" aria-label="Form actions">
          ${
            isArchived
              ? html`
                  <button
                    class="btn btn-danger"
                    type="Submit"
                    value="delete"
                    hx-delete=""
                    hx-params="delete-operation"
                  >
                    ${t('createUpdate.restore')}
                  </button>
                `
              : html`
                  <button class="btn btn-secondary discard" type="Submit" value="discard">
                    ${t('createUpdate.discard')}
                  </button>
                  <button
                    class="btn btn-danger"
                    type="Submit"
                    value="delete"
                    hx-delete=""
                    hx-params="delete-operation"
                  >
                    ${t('createUpdate.archive')}
                  </button>
                  <button class="btn btn-primary" type="Submit" value="save">
                    ${t('createUpdate.update')}
                  </button>
                `
          }
        </section>
      </div>
      <div class="mt-3">
        <${CommunityFormFields}
          community=${page.community}
          operation=${isArchived ? 'read' : 'write'}
        />
      </div>
    </form>

    <${CommunityHistoryList}
      communityNumber=${page.communityNumber}
      currentHistoryId=${page.historyId}
      history=${page.history}
    />
  `
}

export function CommunityHistoryView({page}: {page: CommunityPageView}) {
  return html`
    <h2 class="border-bottom col-md-6 mt-3">
      ${t('createUpdate.viewCommunity')} ${page.communityNumber}<> </>
      <small class="text-body-secondary">(${historyOperationToText(page.historyOperation)})</small>
    </h2>
    <form class="col-md-6 mt-3">
      <div class="mt-3">
        <${CommunityFormFields} community=${page.community} operation="read" />
      </div>
    </form>
    <${CommunityHistoryList}
      communityNumber=${page.communityNumber}
      currentHistoryId=${page.historyId}
      history=${page.history}
    />
  `
}
