import type {Sql} from 'postgres'
import {html} from '../commons/html-templates.ts'
import {MainLayout} from '../layouts/main-view.ts'
import type {NewStudent, Student} from './model.ts'
import {listStudents} from './model.ts'
import {StudentCreateView, StudentsView, StudentUpdateView} from './view.ts'
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
  removeItem: string | string[] | undefined
  removeIndex: string | string[] | undefined
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

export function showStudentUpdate(student: Student, manipulations: StudentManipulations) {
  return html`
    <${MainLayout} title="Students">
      <${StudentUpdateView} student=${manipulateStudent(student, manipulations)} />
    </${MainLayout}>
  `
}
const ARRAY_FIELDS_IN_STUDENT = ['names', 'emails', 'phones', 'facebookNames']

function manipulateStudent<T extends NewStudent | Student>(
  student: T,
  manipulations: StudentManipulations,
): T {
  const transformed = {...student}
  const removeItem = Array.isArray(manipulations.removeItem) ? undefined : manipulations.removeItem
  const removeIndex = Array.isArray(manipulations.removeIndex)
    ? undefined
    : manipulations.removeIndex
  const addItem = Array.isArray(manipulations.addItem) ? undefined : manipulations.addItem

  assert(
    removeItem === undefined || ARRAY_FIELDS_IN_STUDENT.includes(removeItem),
    `Invalid removeItem: ${removeItem}`,
  )
  assert(
    addItem === undefined || ARRAY_FIELDS_IN_STUDENT.includes(addItem),
    `Invalid addItem: ${addItem}`,
  )

  if (removeItem && removeIndex) {
    const index = parseInt(removeIndex, 10)
    if (!isNaN(index)) {
      // @ts-expect-error dynamic stuff!
      transformed[removeItem].splice(index, 1)
    }
  }

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
