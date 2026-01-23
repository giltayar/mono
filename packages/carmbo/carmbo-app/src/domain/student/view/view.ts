import {html} from '../../../commons/html-templates.ts'
import {MainLayout} from '../../../layout/main-view.ts'
import type {NewStudent, Student, StudentHistory, StudentWithHistoryInfo} from '../model.ts'
import type {OngoingStudent} from './model.ts'
import {manipulateStudent, type StudentManipulations} from './student-manipulations.ts'
import {StudentCreateOrUpdateFormFields} from './form.ts'
import {StudentCreateView, StudentHistoryView, StudentUpdateView} from './create-update.ts'
import {Layout} from './layout.ts'
import type {Banner} from '../../../layout/banner.ts'

export function renderStudentsCreatePage(
  student: NewStudent | OngoingStudent | undefined,
  {banner}: {banner?: Banner} = {},
) {
  const finalStudent: OngoingStudent = student
    ? student
    : {
        names: [{firstName: '', lastName: ''}],
        emails: [''],
        phones: [''],
        facebookNames: [''],
        birthday: undefined,
      }

  return html`
    <${MainLayout} title="Students" activeNavItem="students" banner=${banner}>
      <${Layout}>
        <${StudentCreateView} student=${finalStudent} />
      </${Layout}>
    </${MainLayout}>
  `
}

export function renderStudentUpdatePage(
  student: StudentWithHistoryInfo,
  history: StudentHistory[],
  {banner}: {banner?: Banner | undefined} = {},
) {
  return html`
    <${MainLayout} title="Students" activeNavItem="students" banner=${banner}>
      <${Layout}>
        <${StudentUpdateView} student=${student} history=${history} />
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
  student: Student | OngoingStudent,
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

export function renderMagicLinks(magicLinks: {email: string; link: string}[]) {
  if (magicLinks.length === 1) {
    return html`
      <a href=${magicLinks[0].link} target="_blank" rel="noopener noreferrer"
        >${magicLinks[0].link}</a
      >
    `
  } else if (magicLinks.length === 0) {
    return html`<p>No magic links found for this student.</p>`
  } else {
    return html`
      <ul>
        ${magicLinks.map(
          (el) => html`
            <li>
              ${el.email}:
              <a href=${el.link} target="_blank" rel="noopener noreferrer">${el.link}</a>
            </li>
          `,
        )}
      </ul>
    `
  }
}
