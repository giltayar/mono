import {html} from '../commons/html-templates.ts'
import {MainLayout} from '../layouts/main-view.ts'
import type {NewStudent, Student, StudentHistory, StudentWithHistoryInfo} from './model.ts'
import {manipulateStudent, type StudentManipulations} from './view-student-manipulations.ts'
import {StudentCreateOrUpdateFormFields} from './view-form.ts'
import {StudentHistoryList, historyOperationToText} from './view-history.ts'

export function renderStudentsCreatePage(
  student: NewStudent | undefined,
  manipulations: StudentManipulations | undefined,
) {
  const finalStudent: NewStudent = student
    ? manipulations
      ? manipulateStudent(student, manipulations)
      : student
    : {
        names: [{firstName: '', lastName: ''}],
        emails: [''],
        phones: [''],
        facebookNames: [''],
        birthday: new Date(),
        cardcomCustomerId: '',
      }

  return html`
    <${MainLayout} title="Students">
      <${StudentCreateView} student=${finalStudent} />
    </${MainLayout}>
  `
}

export function renderStudentUpdatePage(
  student: StudentWithHistoryInfo,
  history: StudentHistory[],
  manipulations: StudentManipulations,
) {
  return html`
    <${MainLayout} title="Students">
      <${StudentUpdateView} student=${manipulateStudent(student, manipulations)} history=${history} />
    </${MainLayout}>
  `
}

export function renderStudentFormFields(
  student: Student | NewStudent,
  manipulations: StudentManipulations,
  operation: 'read' | 'write',
) {
  return html`
    <${StudentCreateOrUpdateFormFields}
      student=${manipulateStudent(student, manipulations)}
      operation=${operation}
    />
  `
}

export function renderStudentViewInHistoryPage(
  student: StudentWithHistoryInfo,
  history: StudentHistory[],
) {
  return html`,
    <${MainLayout} title="Students">
      <${StudentHistoryView} student=${student} history=${history} operationId=${student.id} />
    </${MainLayout}>
  `
}

function StudentCreateView({student}: {student: Student}) {
  return html`
    <h2 class="border-bottom col-md-6 mt-3">New Student</h2>
    <form hx-post="/students/" hx-target="html" hx-push-url="true" class="col-md-6 mt-3">
      <div class="ms-auto" style="width: fit-content">
        <section class="btn-group" aria-label="Form actions">
          <button class="btn btn-secondary" type="Submit" value="discard">Discard</button>
          <button class="btn btn-primary" type="Submit" value="save">Create</button>
        </section>
      </div>
      <div class="mt-3">
        <${StudentCreateOrUpdateFormFields} student=${student} operation="write" />
      </div>
    </form>
  `
}

function StudentUpdateView({
  student,
  history,
}: {
  student: StudentWithHistoryInfo
  history: StudentHistory[]
}) {
  return html`
    <h2 class="border-bottom col-md-6 mt-3">
      Update Student ${student.studentNumber}
      ${student.historyOperation === 'delete'
        ? html` <small class="text-body-secondary">(archived)</small>`
        : ''}
    </h2>
    <form
      hx-put="/students/${student.studentNumber}"
      hx-target="form"
      hx-replace-url="true"
      class="col-md-6 mt-3"
    >
      <input name="studentNumber" type="hidden" value=${student.studentNumber} />
      <input
        name="delete-operation"
        type="hidden"
        value=${student.historyOperation === 'delete' ? 'restore' : 'delete'}
      />
      <div class="ms-auto" style="width: fit-content">
        <section class="btn-group" aria-label="Form actions">
          <button class="btn btn-secondary" type="Submit" value="discard">Discard</button>
          <button
            class="btn btn-danger"
            type="Submit"
            value="delete"
            hx-delete=""
            hx-params="delete-operation"
          >
            ${student.historyOperation === 'delete' ? 'Restore' : 'Archive'}
          </button>
          <button class="btn btn-primary" type="Submit" value="save">Update</button>
        </section>
      </div>
      <div class="mt-3">
        <${StudentCreateOrUpdateFormFields} student=${student} operation="write" />
      </div>
    </form>
    <${StudentHistoryView} student=${student} history=${history} />
  `
}

function StudentHistoryView({
  student,
  history,
}: {
  student: StudentWithHistoryInfo
  history: StudentHistory[]
}) {
  const currentHistory = history.find((h) => h.historyId === student.id)

  return html`
    <h2 class="border-bottom col-md-6 mt-3">
      View Student ${student.studentNumber}<> </>
      <small class="text-body-secondary"
        >(${historyOperationToText(currentHistory?.operation)})</small
      >
    </h2>
    <form class="col-md-6 mt-3">
      <input name="studentNumber" type="hidden" value=${student.studentNumber} readonly />
      <div class="mt-3">
        <${StudentCreateOrUpdateFormFields} student=${student} operation="read" />
      </div>
    </form>
    <${StudentHistoryList} student=${student} history=${history} />
  `
}
