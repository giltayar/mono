import {html} from '../commons/html-templates.ts'
import {MainLayout} from '../layouts/main-view.ts'
import type {NewStudent, Student, StudentHistory, StudentWithHistoryInfo} from './model.ts'
import {manipulateStudent, type StudentManipulations} from './view-student-manipulations.ts'
import {StudentCreateOrUpdateFormFields} from './view-form.ts'
import {
  StudentCreateView,
  StudentHistoryView,
  StudentUpdateView,
} from './view-create-update-view.ts'

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
