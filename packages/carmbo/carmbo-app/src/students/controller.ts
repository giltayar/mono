import type {Sql} from 'postgres'
import type {NewStudent, Student} from './model.ts'
import {
  listStudents,
  queryStudentByNumber,
  queryStudentByOperationId,
  createStudent as model_createStudent,
  updateStudent as model_updateStudent,
} from './model.ts'
import {
  renderStudentsCreatePage,
  renderStudentsPage,
  renderStudentFormFields,
  renderStudentUpdatePage,
  renderStudentViewInHistoryPage,
  type StudentManipulations,
} from './view.ts'
import {finalHtml, type ControllerResult} from '../commons/controller-result.ts'

export async function showStudents({flash}: {flash?: string}, sql: Sql): Promise<ControllerResult> {
  const students = await listStudents(sql)

  return finalHtml(renderStudentsPage(flash, students))
}

export function showStudentCreate(): ControllerResult {
  return finalHtml(renderStudentsCreatePage(undefined, undefined))
}

export async function showStudentUpdate(
  studentNumber: number,
  manipulations: StudentManipulations,
  sql: Sql,
): Promise<ControllerResult> {
  const studentWithHistory = await queryStudentByNumber(studentNumber, sql)

  if (!studentWithHistory) {
    return {status: 404, body: 'Student not found'}
  }
  return finalHtml(
    renderStudentUpdatePage(studentWithHistory.student, studentWithHistory.history, manipulations),
  )
}

export function showOngoingStudent(
  student: Student | NewStudent,
  manipulations: StudentManipulations,
): ControllerResult {
  return finalHtml(renderStudentFormFields(student, manipulations, 'write'))
}

export async function showStudentInHistory(
  studentNumber: number,
  operationId: string,
  sql: Sql,
): Promise<ControllerResult> {
  const student = await queryStudentByOperationId(studentNumber, operationId, sql)

  if (!student) {
    return {status: 404, body: 'Student not found'}
  }

  return finalHtml(renderStudentViewInHistoryPage(student.student, student.history))
}

export async function createStudent(student: NewStudent, sql: Sql): Promise<ControllerResult> {
  const studentNumber = await model_createStudent(student, undefined, sql)

  return {htmxRedirect: `/students/${studentNumber}`}
}

export async function updateStudent(student: Student, sql: Sql): Promise<ControllerResult> {
  const studentNumber = await model_updateStudent(student, undefined, sql)

  return {htmxRedirect: `/students/${studentNumber}`}
}
