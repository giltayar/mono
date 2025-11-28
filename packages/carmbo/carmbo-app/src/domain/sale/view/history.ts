import {html} from '../../../commons/html-templates.ts'
import type {SaleHistory, SaleWithHistoryInfo} from '../model/model.ts'
import type {HistoryOperation} from '../../../commons/operation-type.ts'
import {saleHistoryOperationToText} from './history-operation-to-text.ts'

export function SaleHistoryList({
  sale,
  history,
}: {
  sale: SaleWithHistoryInfo
  history: SaleHistory[]
}) {
  return html`
    <h5 class="mt-3 col-md-6 border-bottom">History</h5>
    <ul aria-label="Sale History" class="list-group mt-3 pb-3 col-md-6" style="font-size: 0.9rem">
      ${history?.map((entry, i) => {
        const date = new Date(entry.timestamp)
        return html`<li class="list-group-item d-flex" style="text-transform: capitalize;">
          ${entry.historyId === sale.id
            ? html`<strong class="d-block">${saleHistoryOperationToText(entry.operation)}</strong>`
            : html` <a
                class="d-block"
                href=${`/sales/${sale.saleNumber}` +
                (i > 0 ? `/by-history/${entry.historyId}` : '')}
              >
                ${saleHistoryOperationToText(entry.operation)}</a
              >`}
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
      return 'created'
    case 'update':
      return 'updated'
    case 'delete':
      return 'archived'
    case 'restore':
      return 'restored'
    default:
      return operation + '???'
  }
}
