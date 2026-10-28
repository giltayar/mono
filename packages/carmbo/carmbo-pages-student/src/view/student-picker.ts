import {html} from '@giltayar/carmbo-commons/commons/html-templates'
import {BannerComponent, type Banner} from '@giltayar/carmbo-commons/layout/banner'
import {getFixedT} from 'i18next'
import {
  PickerTargetSchema,
  type PickerStudentView,
  type StudentPickerOptions,
  type StudentPickerSelection,
} from './student-picker-model.ts'

const t = getFixedT(null, 'student')

export function StudentPickerButton({
  targetFieldId,
  basePath = '/students',
}: StudentPickerOptions): string | string[] {
  PickerTargetSchema.parse(targetFieldId)
  return html`<button
    type="button"
    class="btn btn-outline-secondary"
    aria-haspopup="dialog"
    aria-controls="${targetFieldId}-student-picker-dialog"
    hx-get="${basePath}/picker?targetFieldId=${targetFieldId}"
    hx-target="#${targetFieldId}-student-picker-container"
    hx-swap="innerHTML"
  >
    ${t('picker.searchCreate')}
  </button>`
}

export function StudentPickerDialogContainer({
  targetFieldId,
  basePath = '/students',
}: StudentPickerOptions): string | string[] {
  PickerTargetSchema.parse(targetFieldId)
  return html`
    <link rel="stylesheet" href="${basePath}/picker.css" />
    <div
      id="${targetFieldId}-student-picker-container"
      hx-on::after-settle="this.querySelector('dialog')?.showModal()"
    ></div>
  `
}

export function renderStudentPickerDialog({
  targetFieldId,
  basePath,
  student = {firstName: '', lastName: '', email: '', phone: ''},
  banner,
}: StudentPickerOptions & {student?: PickerStudentView; banner?: Banner}): string | string[] {
  const id = `${targetFieldId}-student-picker`
  return html`<dialog
    id="${id}-dialog"
    class="student-picker-dialog"
    aria-labelledby="${id}-heading"
    hx-on:student-picker-selected="const field = document.getElementById(event.detail.targetFieldId); if (!field) throw new Error('Student picker field not found'); field.value = event.detail.value; field.dispatchEvent(new CustomEvent('change', {bubbles: true, detail: event.detail.student})); this.close(); field.focus()"
  >
    <h3 id="${id}-heading" class="fs-5 mb-3">${t('picker.searchCreate')}</h3>
    ${banner ? html`<${BannerComponent} banner=${banner} />` : ''}
    <form
      role="search"
      aria-label=${t('picker.search')}
      hx-get="${basePath}/picker/search?targetFieldId=${targetFieldId}"
      hx-target="#${id}-results"
      hx-trigger="input delay:500ms, submit"
      class="mb-3"
    >
      <label class="form-label" for="${id}-query">${t('picker.search')}</label>
      <div class="input-group">
        <input
          id="${id}-query"
          type="search"
          name="q"
          class="form-control"
          placeholder=${t('picker.searchPlaceholder')}
          autofocus
        />
        <button type="submit" class="btn btn-outline-secondary">${t('picker.search')}</button>
      </div>
    </form>
    <div id="${id}-results" aria-live="polite"></div>
    <hr />
    <details open=${!!banner}>
      <summary id="${id}-create-heading" class="mb-3 fw-semibold">
        ${t('picker.createStudent')}
      </summary>
      <form
        aria-labelledby="${id}-create-heading"
        hx-post="${basePath}/picker/create?targetFieldId=${targetFieldId}"
        hx-target="#${targetFieldId}-student-picker-container"
        hx-swap="innerHTML"
        hx-disabled-elt="find button"
      >
        <div class="row g-3 mb-3">
          ${(['firstName', 'lastName', 'email', 'phone'] as const).map(
            (field) =>
              html`<div class="col-sm-6">
                <label class="form-label" for="${id}-${field}">${t(`picker.${field}`)}</label>
                <input
                  id="${id}-${field}"
                  class="form-control"
                  name=${field}
                  type=${field === 'email' ? 'email' : 'text'}
                  value=${student[field]}
                  required=${field !== 'phone'}
                />
              </div>`,
          )}
        </div>
        <button type="submit" class="btn btn-primary">${t('picker.createAndSelect')}</button>
      </form>
    </details>
    <div class="d-flex justify-content-end mt-3">
      <button type="button" class="btn btn-secondary" onclick="this.closest('dialog').close()">
        ${t('picker.cancel')}
      </button>
    </div>
  </dialog>`
}

export function renderStudentPickerResults(
  options: StudentPickerOptions,
  students: StudentPickerSelection[],
): string | string[] {
  if (!students.length) return html`<p class="text-body-secondary">${t('picker.noResults')}</p>`
  return html`<ul aria-label=${t('picker.results')} class="list-group">
    ${students.map(
      (student) =>
        html`<li class="list-group-item d-flex flex-wrap align-items-center gap-3">
          <div class="me-auto text-break">
            <strong>${student.name}</strong>
            <small class="d-block text-body-secondary">${student.email}</small>
            <small class="d-block text-body-secondary">${student.phone}</small>
          </div>
          <button
            type="button"
            class="btn btn-outline-primary btn-sm"
            aria-label="${t('picker.select')} ${student.name}"
            hx-post="${options.basePath}/picker/select?targetFieldId=${options.targetFieldId}"
            hx-vals=${JSON.stringify({studentNumber: student.studentNumber})}
            hx-swap="none"
          >
            ${t('picker.select')}
          </button>
        </li>`,
    )}
  </ul>`
}

export const studentPickerStyles = `.student-picker-dialog {
  width: min(38rem, calc(100vw - 2rem));
  max-height: calc(100dvh - 2rem);
  overflow-y: auto;
  border: 0;
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 1rem 3rem rgb(0 0 0 / 20%);
}
.student-picker-dialog::backdrop {
  background: rgb(0 0 0 / 40%);
}
`
