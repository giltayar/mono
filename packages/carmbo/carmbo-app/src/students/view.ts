import {html} from '../commons/html-templates.ts'
import {MainLayout} from '../layouts/main-view.ts'
import type {NewStudent, Student, StudentHistory, StudentWithHistoryInfo} from './model.ts'
import {manipulateStudent, type StudentManipulations} from './view-student-manipulations.ts'
import {StudentCreateOrUpdateFormFields} from './view-form.ts'
import {StudentCreateView, StudentHistoryView, StudentUpdateView} from './view-create-update.ts'
import {Layout} from './layout.ts'

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
        birthday: undefined,
        cardcomCustomerId: '',
      }

  return html`
    <${MainLayout} title="Students" activeNavItem="students">
      <${Layout}>
        <${StudentCreateView} student=${finalStudent} />
      </${Layout}>
    </${MainLayout}>
  `
}

export function renderStudentUpdatePage(
  student: StudentWithHistoryInfo,
  history: StudentHistory[],
  manipulations: StudentManipulations,
) {
  return html`
    <${MainLayout} title="Students" activeNavItem="students">
      <${Layout}>
        <${StudentUpdateView} student=${manipulateStudent(student, manipulations)} history=${history} />
      </${Layout}>
    </${MainLayout}>
  `
}

export function renderStudentViewInHistoryPage(
  student: StudentWithHistoryInfo,
  history: StudentHistory[],
) {
  return html`
    <${MainLayout} title="Students" activeNavItem="students">
      <${Layout}>
          <${StudentHistoryView} student=${student} history=${history} operationId=${student.id} />
      </${Layout}>
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
