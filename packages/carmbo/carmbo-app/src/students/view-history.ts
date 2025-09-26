import {html} from '../commons/html-templates.ts'
import type {StudentHistory, StudentWithHistoryInfo} from './model.ts'
import type {HistoryOperation} from '../commons/operation-type.ts'

export function StudentHistoryList({
  student,
  history,
}: {
  student: StudentWithHistoryInfo
  history: StudentHistory[]
}) {
  return html`
    <h5 class="mt-3 col-md-6 border-bottom">History</h5>
    <ul
      aria-label="Student History"
      class="list-group mt-3 pb-3 col-md-6"
      style="font-size: 0.9rem"
    >
      ${history?.map((entry, i) => {
        const date = new Date(entry.timestamp)
        return html`<li class="list-group-item d-flex" style="text-transform: capitalize;">
          ${entry.historyId === student.id
            ? html`<strong class="d-block">${historyOperationToText(entry.operation)}</strong>`
            : html` <a
                class="d-block"
                href=${`/students/${student.studentNumber}` +
                (i > 0 ? `/by-history/${entry.historyId}` : '')}
              >
                ${historyOperationToText(entry.operation)}</a
              >`}
          <span class="d-block ms-auto" title="${date.toLocaleTimeString('he-IL')}"
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
