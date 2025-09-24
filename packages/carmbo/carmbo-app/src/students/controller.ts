import type {Sql} from 'postgres'
import {html} from '../commons/html-templates.ts'
import {MainLayout} from '../layouts/main-view.ts'
import type {NewStudent, Student, StudentHistory} from './model.ts'
import {listStudents} from './model.ts'
import {StudentCreateView, StudentHistoryView, StudentsView, StudentUpdateView} from './view.ts'
import {assert} from 'console'

export async function showStudents({flash}: {flash?: string}, sql: Sql) {
  const students = await listStudents(sql)

  return html`
    <${MainLayout} title="Students" flash=${flash}>
      <${StudentsView} students=${students} />
    </${MainLayout}>
  `
}

type StudentManipulations = {
  addItem: string | string[] | undefined
}

export function showStudentCreate(
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

export function showStudentUpdate(
  {student, history}: {student: Student; history: StudentHistory[]},
  manipulations: StudentManipulations,
) {
  return html`
    <${MainLayout} title="Students">
      <${StudentUpdateView} student=${manipulateStudent(student, manipulations)} history=${history}/>
    </${MainLayout}>
  `
}

export function showStudentInHistory(student: Student) {
  return html`
    <${MainLayout} title="Students">
      <${StudentHistoryView} student=${student} />
    </${MainLayout}>
  `
}

const ARRAY_FIELDS_IN_STUDENT = ['names', 'emails', 'phones', 'facebookNames']

function manipulateStudent<T extends NewStudent | Student>(
  student: T,
  manipulations: StudentManipulations,
): T {
  const transformed = {...student}
  const addItem = Array.isArray(manipulations.addItem) ? undefined : manipulations.addItem
  assert(
    addItem === undefined || ARRAY_FIELDS_IN_STUDENT.includes(addItem),
    `Invalid addItem: ${addItem}`,
  )

  if (addItem) {
    if (addItem === 'names') {
      ;(transformed[addItem] ??= []).push({firstName: '', lastName: ''})
    } else {
      // @ts-expect-error dynamic stuff!
      ;(transformed[addItem] ??= []).push('')
    }
  }

  return transformed
}
