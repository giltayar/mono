import type {PendingQuery, Row, Sql} from 'postgres'
import {HistoryOperationEnumSchema, type HistoryOperation} from '../../commons/operation-type.ts'
import {assert} from 'node:console'
import {z} from 'zod'
import {range} from '@giltayar/functional-commons'
import {sqlTextSearch} from '../../commons/sql-commons.ts'
import type {SmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/service'
import {assertNever} from '@giltayar/functional-commons'
import {normalizePhoneNumber} from '../../commons/phone.ts'
import {normalizeEmail} from '../../commons/email.ts'
import {TEST_executeHook} from '../../commons/TEST_hooks.ts'

export const StudentSchema = z.object({
  studentNumber: z.coerce.number().int().positive(),
  birthday: z.iso
    .date()
    .transform((s) => new Date(s))
    .optional(),
  names: z.array(z.object({firstName: z.string().min(1), lastName: z.string().min(1)})).min(1),
  emails: z.array(z.email()).min(1),
  phones: z.array(z.string().min(1)).optional(),
  facebookNames: z.array(z.string()).optional(),
  cardcomCustomerIds: z.array(z.number().int()).optional(),
})

export const NewStudentSchema = StudentSchema.omit({studentNumber: true})
export type NewStudent = z.infer<typeof NewStudentSchema>

export const StudentWithHistoryInfoSchema = StudentSchema.extend({
  id: z.uuid(),
  historyOperation: HistoryOperationEnumSchema,
})

export type Student = z.infer<typeof StudentSchema>
export type StudentWithHistoryInfo = z.infer<typeof StudentWithHistoryInfoSchema>

export interface StudentForGrid {
  studentNumber: number
  names: {
    firstName: string
    lastName: string
  }[]
  emails: string[]
  phones: string[]
}

export interface StudentHistory {
  historyId: string
  operation: HistoryOperation
  timestamp: Date
}

export async function listStudents(
  sql: Sql,
  {
    withArchived,
    query,
    limit,
    page,
  }: {withArchived: boolean; query: string; limit: number; page: number},
): Promise<StudentForGrid[]> {
  const filters: PendingQuery<Row[]>[] = [sql`true`]

  if (!withArchived) {
    filters.push(sql`operation <> 'delete'`)
  }

  if (query) {
    filters.push(sql`searchable_text ${sql`${sqlTextSearch(query, sql)}`}`)
  }

  const result = await sql<StudentForGrid[]>`
    SELECT
      student.student_number,
      COALESCE(names, json_build_array()) AS names,
      COALESCE(emails, json_build_array()) AS emails,
      COALESCE(phones, json_build_array()) AS phones
    FROM
      student_history
      INNER JOIN student ON last_history_id = id
      LEFT JOIN student_search USING (data_id)
      LEFT JOIN LATERAL (
        SELECT
          json_agg(json_build_object('firstName', first_name, 'lastName', last_name) ORDER BY item_order) AS names
        FROM
          student_name
        WHERE
          student_name.data_id = student_history.data_id
      ) names ON true
      LEFT JOIN LATERAL (
        SELECT
          json_agg(email ORDER BY item_order) AS emails
        FROM
          student_email
        WHERE
          student_email.data_id = student_history.data_id
      ) emails ON true
      LEFT JOIN LATERAL (
        SELECT
          json_agg(phone ORDER BY item_order) AS phones
        FROM
          student_phone
        WHERE
          student_phone.data_id = student_history.data_id
      ) phones ON true
    ${filters.flatMap((filter, i) => (i === 0 ? [sql`WHERE`, filter] : [sql`AND`, filter]))}
    ORDER BY student.student_number
    LIMIT ${limit} OFFSET ${page * limit}
    `

  return result
}

export async function createStudent(
  student: NewStudent,
  reason: string | undefined,
  smooveIntegration: SmooveIntegrationService | undefined,
  sql: Sql,
) {
  await TEST_executeHook('createStudent')

  const normalizedStudent = normalizeStudent(student)

  return await sql.begin(async (sql) => {
    const now = new Date()
    const historyId = crypto.randomUUID()
    const dataId = crypto.randomUUID()

    const studentNumberResult = await sql<{studentNumber: number}[]>`
      INSERT INTO student_history VALUES
        (${historyId}, ${dataId}, DEFAULT, ${now}, 'create', ${reason ?? null})
      RETURNING student_number
    `
    const studentNumber = studentNumberResult[0].studentNumber

    const result = await smooveIntegration?.createSmooveContact({
      email: normalizedStudent.emails[0],
      firstName: normalizedStudent.names[0].firstName,
      lastName: normalizedStudent.names[0].lastName,
      telephone: normalizedStudent.phones?.[0],
      birthday: normalizedStudent.birthday,
    })

    await sql`
      INSERT INTO student VALUES
        (${studentNumber}, ${historyId}, ${dataId})
    `

    await addStudentStuff(
      studentNumber,
      normalizedStudent,
      typeof result === 'object' || typeof result === 'undefined' ? result?.smooveId : undefined,
      dataId,
      sql,
    )

    return studentNumber
  })
}

export async function updateStudent(
  student: Student,
  reason: string | undefined,
  smooveIntegration: SmooveIntegrationService,
  sql: Sql,
): Promise<number | undefined> {
  await TEST_executeHook('updateStudent')

  const normalizedStudent = normalizeStudent(student)

  return await sql.begin(async (sql) => {
    const smooveId = await getSmooveId(normalizedStudent.studentNumber, sql)

    const now = new Date()
    const historyId = crypto.randomUUID()
    const dataId = crypto.randomUUID()

    await sql`
      INSERT INTO student_history VALUES
        (${historyId}, ${dataId}, ${normalizedStudent.studentNumber}, ${now}, 'update', ${reason ?? null})
    `
    const updateResult = await sql`
        UPDATE student SET
          student_number = ${normalizedStudent.studentNumber},
          last_history_id = ${historyId},
          last_data_id = ${dataId}
        WHERE student_number = ${normalizedStudent.studentNumber}
        RETURNING 1
      `

    if (updateResult.length === 0) {
      return undefined
    }

    assert(
      updateResult.length === 1,
      `More than one student with ID ${normalizedStudent.studentNumber}`,
    )

    await addStudentStuff(normalizedStudent.studentNumber, normalizedStudent, smooveId, dataId, sql)

    if (smooveId > 0)
      await smooveIntegration.updateSmooveContact(smooveId, {
        email: normalizedStudent.emails[0],
        birthday: normalizedStudent.birthday,
        firstName: normalizedStudent.names?.[0].firstName ?? '',
        lastName: normalizedStudent.names?.[0].lastName ?? '',
        telephone: normalizedStudent.phones?.[0] ?? '',
      })

    return student.studentNumber
  })
}

async function getSmooveId(studentNumber: number, sql: Sql) {
  const smooveIdResult = await sql<{smooveContactId: string}[]>`
    SELECT smoove_contact_id
    FROM student_integration_smoove sis
    JOIN student s ON s.last_data_id = sis.data_id
    WHERE s.student_number = ${studentNumber}
  `

  return parseInt(smooveIdResult[0].smooveContactId)
}

export async function deleteStudent(
  studentNumber: number,
  reason: string | undefined,
  deleteOperation: Extract<HistoryOperation, 'delete' | 'restore'>,
  smooveIntegration: SmooveIntegrationService,
  sql: Sql,
): Promise<string | undefined> {
  await TEST_executeHook(`${deleteOperation}Student`)

  return await sql.begin(async (sql) => {
    const now = new Date()
    const historyId = crypto.randomUUID()
    const dataIdResult = await sql<{dataId: string}[]>`
      INSERT INTO student_history (id, data_id, student_number, timestamp, operation, operation_reason)
      SELECT ${historyId}, student.last_data_id as last_data_id, student.student_number, ${now}, ${deleteOperation}, ${reason ?? null}
      FROM student_history
      INNER JOIN student ON student.student_number = ${studentNumber}
      WHERE id = student.last_history_id
      RETURNING student_history.data_id as data_id
    `

    if (dataIdResult.length === 0) {
      return undefined
    }

    if (dataIdResult.length > 1) {
      throw new Error(`More than one student with ID ${studentNumber}`)
    }
    const smooveId = await getSmooveId(studentNumber, sql)

    await sql`
        UPDATE student SET
          student_number = ${studentNumber},
          last_history_id = ${historyId},
          last_data_id = ${dataIdResult[0].dataId}
        WHERE student_number = ${studentNumber}
     `

    if (deleteOperation === 'delete') {
      await smooveIntegration.deleteSmooveContact(smooveId)
    } else if (deleteOperation === 'restore') {
      await smooveIntegration.restoreSmooveContact(smooveId)
    } else {
      assertNever(deleteOperation)
    }

    return historyId
  })
}

export async function queryStudentByNumber(
  studentNumber: number,
  sql: Sql,
): Promise<{student: StudentWithHistoryInfo; history: StudentHistory[]} | undefined> {
  const pstudent = sql<StudentWithHistoryInfo[]>`
    WITH parameters (current_data_id, current_history_id) AS (
      SELECT
        last_data_id, last_history_id
      FROM
        student
      WHERE
        student_number = ${studentNumber}
    )
    ${studentSelect(studentNumber, sql)}
  `

  const phistory = studentHistorySelect(studentNumber, sql)
  const [student, history] = await Promise.all([pstudent, phistory])

  if (student.length === 0) {
    return undefined
  }

  assert(student.length === 1, `More than one student with ID ${studentNumber}`)

  return {student: student[0], history}
}

export async function queryStudentByHistoryId(
  studentNumber: number,
  historyId: string,
  sql: Sql,
): Promise<{student: StudentWithHistoryInfo; history: StudentHistory[]} | undefined> {
  const pstudent = sql<StudentWithHistoryInfo[]>`
    WITH parameters (current_data_id, current_history_id) AS (
      SELECT
        data_id, id
      FROM
        student_history
      WHERE
        id = ${historyId}
    )
    ${studentSelect(studentNumber, sql)}
  `

  const phistory = studentHistorySelect(studentNumber, sql)

  const [student, history] = await Promise.all([pstudent, phistory])

  if (student.length === 0) {
    return undefined
  }

  assert(student.length === 1, `More than one student with ID ${studentNumber}`)

  return {student: student[0], history}
}

function studentSelect(studentNumber: number, sql: Sql) {
  return sql<StudentWithHistoryInfo[]>`
SELECT
  current_history_id as id,
  student_history.operation as history_operation,
  ${studentNumber} as student_number,
  birthday,
  COALESCE(names, json_build_array()) AS names,
  COALESCE(facebook_names, json_build_array()) AS facebook_names,
  COALESCE(emails, json_build_array()) AS emails,
  COALESCE(phones, json_build_array()) AS phones,
  COALESCE(cardcom_customer_ids, json_build_array()) AS cardcom_customer_ids
FROM
  parameters
  LEFT JOIN student_history ON student_history.id = current_history_id
  LEFT JOIN student_data ON student_data.data_id = current_data_id
  LEFT JOIN LATERAL (
    SELECT
      json_agg(
        json_build_object('firstName', first_name, 'lastName', last_name)
        ORDER BY
          item_order
      ) AS names
    FROM
      student_name
    WHERE
      student_name.data_id = current_data_id
  ) names ON true
  LEFT JOIN LATERAL (
    SELECT
      json_agg(
        facebook_name
        ORDER BY
          item_order
      ) AS facebook_names
    FROM
      student_facebook_name
    WHERE
      student_facebook_name.data_id = current_data_id
  ) facebook_names ON true
  LEFT JOIN LATERAL (
    SELECT
      json_agg(
        email
        ORDER BY
          item_order
      ) AS emails
    FROM
      student_email
    WHERE
      student_email.data_id = current_data_id
  ) emails ON true
  LEFT JOIN LATERAL (
    SELECT
      json_agg(
        phone
        ORDER BY
          item_order
      ) AS phones
    FROM
      student_phone
    WHERE
      student_phone.data_id = current_data_id
  ) phones ON true
  LEFT JOIN LATERAL (
    SELECT
      json_agg(
        DISTINCT COALESCE(sdc.customer_id, sdm.cardcom_customer_id)
        ORDER BY
          COALESCE(sdc.customer_id, sdm.cardcom_customer_id)
      ) AS cardcom_customer_ids
    FROM
      sale_data sd
      JOIN sale s ON s.last_data_id = sd.data_id
      LEFT JOIN sale_data_cardcom sdc ON sdc.data_cardcom_id = s.data_cardcom_id
      LEFT JOIN sale_data_manual sdm ON sdm.data_manual_id = s.last_data_manual_id
    WHERE
      sd.student_number = ${studentNumber}
      AND (sdc.customer_id IS NOT NULL OR sdm.cardcom_customer_id IS NOT NULL)
  ) cardcom_customer_ids ON true
       `
}

function studentHistorySelect(studentNumber: number, sql: Sql) {
  return sql<StudentHistory[]>`
SELECT
  id as history_id,
  operation,
  timestamp
FROM
  student_history
WHERE
  student_history.student_number = ${studentNumber}
ORDER BY
  timestamp DESC
  `
}

async function addStudentStuff(
  studentNumber: number,
  student: Student | NewStudent,
  smooveId: number | undefined,
  dataId: string,
  sql: Sql,
) {
  let ops = [] as Promise<unknown>[]

  ops = ops.concat(sql`
    INSERT INTO student_search VALUES
      (${dataId}, ${searchableStudentText(studentNumber, student)})
  `)

  ops = ops.concat(sql`
    INSERT INTO student_data VALUES
      (${dataId}, ${student.birthday ?? null})
  `)

  ops = ops.concat(
    student.emails?.map(
      (email, index) => sql`
        INSERT INTO student_email VALUES
          (${dataId}, ${index}, ${email})
      `,
    ) ?? [],
  )
  ops = ops.concat(
    student.names?.map(
      (name, index) => sql`
        INSERT INTO student_name VALUES
          (${dataId}, ${index}, ${name.firstName}, ${name.lastName})
      `,
    ) ?? [],
  )

  ops = ops.concat(
    student.phones?.map(
      (phone, index) => sql`
        INSERT INTO student_phone VALUES
          (${dataId}, ${index}, ${phone})
      `,
    ) ?? [],
  )
  ops = ops.concat(
    student.facebookNames?.map(
      (facebookName, index) => sql`
        INSERT INTO student_facebook_name VALUES
          (${dataId}, ${index}, ${facebookName})
      `,
    ) ?? [],
  )

  if (smooveId !== undefined) {
    ops = ops.concat(sql`INSERT INTO student_integration_smoove VALUES (${dataId}, ${smooveId})`)
  }

  await Promise.all(ops)
}

function searchableStudentText(studentNumber: number, student: Student | NewStudent): string {
  const names = student.names?.map((name) => `${name.firstName} ${name.lastName}`).join(' ') ?? ''
  const emails = student.emails?.join(' ') ?? ''
  const phones = student.phones?.join(' ') ?? ''
  const facebookNames = student.facebookNames?.join(' ') ?? ''

  return `${studentNumber} ${names} ${emails} ${phones} ${facebookNames}`.trim()
}

export async function TEST_seedStudents(
  sql: Sql,
  smooveIntegration: SmooveIntegrationService | undefined,
  count: number,
) {
  const chance = new (await import('chance')).Chance(0)

  for (const i of range(0, count)) {
    if (i % 1000 === 0) {
      console.log(`Seeding student ${i}`)
    }
    await createStudent(
      {
        emails: [chance.email(), chance.email()],
        facebookNames: [chance.name()],
        names: [
          {firstName: chance.first(), lastName: chance.last()},
          {firstName: chance.first(), lastName: chance.last()},
          {firstName: chance.first(), lastName: chance.last()},
        ],
        phones: [chance.phone(), chance.phone(), chance.phone()],
        birthday: chance.date(),
      },
      chance.word(),
      smooveIntegration,
      sql,
    )
  }
}

function normalizeStudent<TStudent extends Student | NewStudent>(student: TStudent): TStudent {
  return {
    ...student,
    emails: student.emails.map(normalizeEmail),
    phones: student.phones?.map(normalizePhoneNumber),
  }
}
