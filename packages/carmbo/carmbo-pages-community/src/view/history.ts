import {html} from '@giltayar/carmbo-commons/commons/html-templates'
import type {HistoryOperation} from '@giltayar/carmbo-commons/commons/operation-type'
import {getFixedT} from 'i18next'
import type {CommunityHistoryEntryView} from './model.ts'

const t = getFixedT(null, 'community')

export function CommunityHistoryList({
  communityNumber,
  currentHistoryId,
  history,
}: {
  communityNumber: number
  currentHistoryId: string
  history: CommunityHistoryEntryView[]
}) {
  return html`
    <h5 class="mt-3 col-md-6 border-bottom">${t('history.history')}</h5>
    <ul
      aria-label=${t('history.history')}
      class="list-group mt-3 pb-3 col-md-6"
      style="font-size: 0.9rem"
    >
      ${history.map((entry, i) => {
        const date = new Date(entry.timestamp)
        return html`<li class="list-group-item d-flex" style="text-transform: capitalize;">
          ${
            entry.historyId === currentHistoryId
              ? html`<strong class="d-block">${historyOperationToText(entry.operation)}</strong>`
              : html`<a
                  class="d-block"
                  href=${
                    `/communities/${communityNumber}` +
                    (i > 0 ? `/by-history/${entry.historyId}` : '')
                  }
                  >${historyOperationToText(entry.operation)}</a
                >`
          }
          <span class="d-block ms-auto" title=${date.toLocaleTimeString('he-IL')}
            >${date.toLocaleDateString('he-IL')}</span
          >
        </li>`
      })}
    </ul>
  `
}

export function historyOperationToText(operation: HistoryOperation | undefined): string {
  switch (operation) {
    case 'create':
      return t('history.created')
    case 'update':
      return t('history.updated')
    case 'delete':
      return t('history.archived')
    case 'restore':
      return t('history.restored')
    default:
      return operation + '???'
  }
}
