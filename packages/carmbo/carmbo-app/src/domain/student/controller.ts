import type {Sql} from 'postgres'
import type {NewStudent, Student} from './model.ts'
import type {OngoingStudent} from './view/model.ts'
import {
  listStudents,
  queryStudentByNumber,
  queryStudentByHistoryId,
  createStudent as model_createStudent,
  updateStudent as model_updateStudent,
  deleteStudent as model_deleteStudent,
} from './model.ts'
import {
  renderStudentsCreatePage,
  renderStudentFormFields,
  renderStudentUpdatePage,
  renderStudentViewInHistoryPage,
} from './view/view.ts'
import {renderStudentsPage} from './view/list.ts'
import {finalHtml, retarget, type ControllerResult} from '../../commons/controller-result.ts'
import type {StudentManipulations} from './view/student-manipulations.ts'
import {requestContext} from '@fastify/request-context'
import {exceptionToBanner} from '../../layout/banner.ts'

export async function showStudents(
  {
    flash,
    withArchived,
    query,
    page,
  }: {flash?: string; withArchived: boolean; query: string | undefined; page: number},
  sql: Sql,
): Promise<ControllerResult> {
  const students = await listStudents(sql, {withArchived, query: query ?? '', limit: 50, page})

  return finalHtml(renderStudentsPage(flash, students, {withArchived, query: query ?? '', page}))
}

export function showStudentCreate(
  student: NewStudent | undefined,
  {error}: {error?: any} = {},
): ControllerResult {
  const banner = exceptionToBanner('Creating student error: ', error)

  return finalHtml(renderStudentsCreatePage(student, {banner}))
}

export async function showStudentUpdate(
  studentNumber: number,
  studentWithError: {student: Student | undefined; error: any; operation: string} | undefined,
  sql: Sql,
): Promise<ControllerResult> {
  const studentWithHistory = await queryStudentByNumber(studentNumber, sql)

  if (!studentWithHistory) {
    return {status: 404, body: 'Student not found'}
  }

  const banner = exceptionToBanner(
    `${studentWithError?.operation} student error: `,
    studentWithError?.error,
  )
  studentWithHistory.student = {
    ...studentWithHistory.student,
    ...studentWithError?.student,
  }

  return finalHtml(
    renderStudentUpdatePage(studentWithHistory.student, studentWithHistory.history, {banner}),
  )
}

export function showOngoingStudent(
  student: OngoingStudent,
  {manipulations}: {manipulations: StudentManipulations},
): ControllerResult {
  return finalHtml(renderStudentFormFields(student, manipulations, 'write'))
}

export async function showStudentInHistory(
  studentNumber: number,
  operationId: string,
  sql: Sql,
): Promise<ControllerResult> {
  const student = await queryStudentByHistoryId(studentNumber, operationId, sql)

  if (!student) {
    return {status: 404, body: 'Student not found'}
  }

  return finalHtml(renderStudentViewInHistoryPage(student.student, student.history))
}

export async function createStudent(student: NewStudent, sql: Sql): Promise<ControllerResult> {
  try {
    const smooveIntegration = requestContext.get('smooveIntegration')!

    const studentNumber = await model_createStudent(student, undefined, smooveIntegration, sql)

    return {htmxRedirect: `/students/${studentNumber}`}
  } catch (error) {
    const logger = requestContext.get('logger')!
    logger.error({err: error}, 'create-student')
    return showStudentCreate(student, {error})
  }
}

export async function updateStudent(student: Student, sql: Sql): Promise<ControllerResult> {
  const logger = requestContext.get('logger')!
  try {
    const smooveIntegration = requestContext.get('smooveIntegration')!
    const academyIntegration = requestContext.get('academyIntegration')!

    const studentNumber = await model_updateStudent(
      student,
      undefined,
      smooveIntegration,
      academyIntegration,
      sql,
    )

    if (!studentNumber) {
      return {status: 404, body: 'Student not found'}
    }

    return {htmxRedirect: `/students/${studentNumber}`}
  } catch (error) {
    logger.error({err: error}, 'update-student')
    return showStudentUpdate(student.studentNumber, {student, error, operation: 'Updating'}, sql)
  }
}

export async function deleteStudent(
  studentNumber: number,
  deleteOperation: 'delete' | 'restore',
  sql: Sql,
): Promise<ControllerResult> {
  try {
    const smooveIntegration = requestContext.get('smooveIntegration')!

    const operationId = await model_deleteStudent(
      studentNumber,
      undefined,
      deleteOperation,
      smooveIntegration,
      sql,
    )

    if (!operationId) {
      return {status: 404, body: 'Student not found'}
    }

    return {htmxRedirect: `/students/${studentNumber}`}
  } catch (error) {
    const logger = requestContext.get('logger')!
    logger.error({err: error}, `${deleteOperation}-student`)
    return retarget(
      await showStudentUpdate(
        studentNumber,
        {
          student: undefined,
          error,
          operation: deleteOperation === 'delete' ? 'Archiving' : 'Restoring',
        },
        sql,
      ),
      'body',
    )
  }
}
