import {html} from '../../../commons/html-templates.ts'
import type {Student, StudentHistory, StudentWithHistoryInfo} from '../model.ts'
import {StudentCreateOrUpdateFormFields} from './form.ts'
import {StudentHistoryList, historyOperationToText} from './history.ts'
import {Tabs} from './layout.ts'
import {getFixedT} from 'i18next'

const t = getFixedT(null, 'student')

export function StudentCreateView({student}: {student: Student}) {
  return html`
    <h2 class="border-bottom col-md-6 mt-3">
      ${t('form.newStudent')}
      <div class="operation-spinner spinner-border" role="status"></div>
    </h2>
    <form
      hx-post="/students/"
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
        <${StudentCreateOrUpdateFormFields} student=${student} operation="write" />
      </div>
    </form>
  `
}

export function StudentUpdateView({
  student,
  history,
}: {
  student: StudentWithHistoryInfo
  history: StudentHistory[]
}) {
  return html`
    <h2 class="border-bottom col-md-6 mt-3">
      ${t('createUpdate.updateStudent')} ${student.studentNumber}
      ${student.historyOperation === 'delete'
        ? html` <small class="text-body-secondary">${t('createUpdate.archived')}</small>`
        : ''}
      <div class="operation-spinner spinner-border" role="status"></div>
    </h2>
    <${Tabs} studentNumber=${student.studentNumber} activeTab="details" />
    <form
      hx-put="/students/${student.studentNumber}"
      hx-target="form"
      class="col-md-6 mt-3"
      hx-indicator=".operation-spinner"
    >
      <input name="studentNumber" type="hidden" value=${student.studentNumber} />
      <input
        name="delete-operation"
        type="hidden"
        value=${student.historyOperation === 'delete' ? 'restore' : 'delete'}
      />
      <div class="ms-auto" style="width: fit-content">
        <section class="btn-group" aria-label="Form actions">
          ${student.historyOperation === 'delete'
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
              `}
        </section>
      </div>
      <div class="mt-3">
        <${StudentCreateOrUpdateFormFields}
          student=${student}
          operation=${student.historyOperation === 'delete' ? 'read' : 'write'}
        />
      </div>
    </form>
    <section
      id="magic-link-section"
      class="form-group col-md-6 mt-3"
      aria-labelledby="magic-link-label"
    >
      <h5 id="magic-link-label" class="mb-3">${t('createUpdate.academyMagicLink')}</h5>
      <button
        hx-get="/students/${student.studentNumber}/academy-magic-link"
        hx-swap="outerHTML"
        hx-target="this"
        hx-indicator="#magic-link-section .operation-spinner"
      >
        ${t('createUpdate.fetchLink')}
        <div class="operation-spinner spinner-border spinner-border-sm" role="status"></div>
      </button>
    </section>

    <${StudentHistoryList} student=${student} history=${history} />
  `
}

export function StudentHistoryView({
  student,
  history,
}: {
  student: StudentWithHistoryInfo
  history: StudentHistory[]
}) {
  const currentHistory = history.find((h) => h.historyId === student.id)

  return html`
    <h2 class="border-bottom col-md-6 mt-3">
      ${t('createUpdate.viewStudent')} ${student.studentNumber}<> </>
      <small class="text-body-secondary"
        >(${historyOperationToText(currentHistory?.operation)})</small
      >
      <div class="operation-spinner spinner-border" role="status"></div>
    </h2>
    <form class="col-md-6 mt-3" hx-indicator=".operation-spinner">
      <input name="studentNumber" type="hidden" value=${student.studentNumber} readonly />
      <div class="mt-3">
        <${StudentCreateOrUpdateFormFields} student=${student} operation="read" />
      </div>
    </form>
    <${StudentHistoryList} student=${student} history=${history} />
  `
}
