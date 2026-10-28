import type {Sql} from 'postgres'
import {z} from 'zod'
import {getFixedT} from 'i18next'
import {finalHtml} from '@giltayar/carmbo-commons/commons/controller-result'
import {exceptionToBanner} from '@giltayar/carmbo-commons/layout/banner'
import {createStudent, listStudents, NewStudentSchema, queryStudentByNumber} from './model.ts'
import type {StudentForGrid} from './model.ts'
import type {StudentControllerOptions} from './student-route-options.ts'
import type {
  PickerStudentView,
  StudentPickerOptions,
  StudentPickerSelection,
} from './view/student-picker-model.ts'
import {renderStudentPickerDialog, renderStudentPickerResults} from './view/student-picker.ts'

const t = getFixedT(null, 'student')

export type PickerResult = {selected: StudentPickerSelection} | {body: string}

function toSelection(
  student: Pick<StudentForGrid, 'studentNumber' | 'names' | 'emails'> & {
    phones?: string[]
  },
): StudentPickerSelection {
  const name = student.names[0]
  return {
    studentNumber: student.studentNumber,
    name: `${name.firstName} ${name.lastName}`,
    email: student.emails[0],
    phone: student.phones?.[0] ?? '',
  }
}

export async function searchPickerStudents(
  options: StudentPickerOptions,
  query: string,
  sql: Sql,
): Promise<string> {
  const students = query.trim()
    ? await listStudents(sql, {withArchived: false, query: query.trim(), limit: 20, page: 0})
    : []
  return finalHtml(renderStudentPickerResults(options, students.map(toSelection)))
}

export async function selectPickerStudent(
  options: StudentPickerOptions,
  studentNumber: number,
  sql: Sql,
  {logger}: StudentControllerOptions,
): Promise<PickerResult> {
  const found = await queryStudentByNumber(studentNumber, sql)
  if (!found || found.student.historyOperation === 'delete') {
    logger.warn({studentNumber}, 'student-picker-unavailable')
    return {
      body: finalHtml(
        renderStudentPickerDialog({
          ...options,
          banner: {type: 'error', message: t('picker.unavailable'), disappearing: false},
        }),
      ),
    }
  }
  return {selected: toSelection(found.student)}
}

export async function createPickerStudent(
  options: StudentPickerOptions,
  view: PickerStudentView,
  sql: Sql,
  {nowService, logger, smooveIntegration, ravmesserIntegration}: StudentControllerOptions,
): Promise<PickerResult> {
  try {
    const student = NewStudentSchema.parse({
      names: [{firstName: view.firstName.trim(), lastName: view.lastName.trim()}],
      emails: [view.email.trim()],
      phones: view.phone.trim() ? [view.phone.trim()] : undefined,
    })
    const studentNumber = await createStudent(
      student,
      'Created from student picker',
      smooveIntegration,
      ravmesserIntegration,
      nowService(),
      sql,
    )
    const found = await queryStudentByNumber(studentNumber, sql)
    if (!found) throw new Error(`Created student ${studentNumber} was not found`)
    return {selected: toSelection(found.student)}
  } catch (error) {
    logger.error({err: error}, 'create-student-picker')
    const localizedError =
      error instanceof z.ZodError
        ? new Error(t('picker.invalidInput'))
        : error instanceof Error &&
            error.message === 'Email or phone number already exists for another student'
          ? new Error(t('picker.duplicate'))
          : error
    return {
      body: finalHtml(
        renderStudentPickerDialog({
          ...options,
          student: view,
          banner: exceptionToBanner(t('picker.creatingError'), localizedError),
        }),
      ),
    }
  }
}
