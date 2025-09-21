import type {Sql} from 'postgres'
import type {HistoryOperation} from '../commons/operation-type.ts'
import {assert} from 'node:console'
import {z} from 'zod'

export const StudentSchema = z.object({
  studentNumber: z.coerce.number().int().positive(),
  names: z.array(z.object({firstName: z.string().min(1), lastName: z.string().min(1)})),
  birthday: z.iso.date().transform((s) => new Date(s)),
  emails: z.array(z.email()),
  phones: z.array(z.string().min(1)),
  facebookNames: z.array(z.string()).optional().default([]),
  cardcomCustomerId: z.union([z.string(), z.undefined()]),
})

export const NewStudentSchema = z.object({
  names: z.array(z.object({firstName: z.string(), lastName: z.string()})),
  birthday: z.iso.date().transform((s) => new Date(s)),
  emails: z.array(z.union([z.email(), z.string()])),
  phones: z.array(z.string()),
  facebookNames: z.array(z.string()),
  cardcomCustomerId: z.union([z.string(), z.undefined()]),
})

export type Student = z.infer<typeof StudentSchema>
export type NewStudent = z.infer<typeof NewStudentSchema>

export interface StudentForGrid {
  studentNumber: number
  names: {
    firstName: string
    lastName: string
  }[]
  birthday: Date
  emails: string[]
  phones: string[]
}

export interface StudentHistory {
  studentNumber: number
  operation: HistoryOperation
  timestamp: Date
}

export async function listStudents(sql: Sql): Promise<StudentForGrid[]> {
  const result = await sql<StudentForGrid[]>`
SELECT
  id,
  student.student_number,
  birthday,
  COALESCE(names, json_build_array()) AS names,
  COALESCE(emails, json_build_array()) AS emails,
  COALESCE(phones, json_build_array()) AS phones
FROM
  student_operation
  INNER JOIN student ON last_operation_id = id
  LEFT JOIN student_integration_cardcom ON operation_id = last_operation_id
  LEFT JOIN LATERAL (
    SELECT
      json_agg(json_build_object('firstName', first_name, 'lastName', last_name) ORDER BY item_order) AS names
    FROM
      student_name
    WHERE
      operation_id = last_operation_id
  ) names ON true
  LEFT JOIN LATERAL (
    SELECT
      json_agg(email ORDER BY item_order) AS emails
    FROM
      student_email
    WHERE
      operation_id = last_operation_id
  ) emails ON true
  LEFT JOIN LATERAL (
    SELECT
      json_agg(phone ORDER BY item_order) AS phones
    FROM
      student_phone
    WHERE
      operation_id = last_operation_id
  ) phones ON true
WHERE
  operation <> 'delete'  `

  return result
}

export async function fetchStudentByNumber(
  studentNumber: number,
  sql: Sql,
): Promise<Student | undefined> {
  const result = await sql<Student[]>`
SELECT
  id,
  student.student_number,
  birthday,
  student_integration_cardcom.customer_id AS cardcom_customer_id,
  COALESCE(names, json_build_array()) AS names,
  COALESCE(facebook_names, json_build_array()) AS facebook_names,
  COALESCE(emails, json_build_array()) AS emails,
  COALESCE(phones, json_build_array()) AS phones
FROM
  student_operation
  INNER JOIN student ON last_operation_id = id
  LEFT JOIN student_integration_cardcom ON operation_id = last_operation_id
  LEFT JOIN LATERAL (
    SELECT
      json_agg(json_build_object('firstName', first_name, 'lastName', last_name) ORDER BY item_order) AS names
    FROM
      student_name
    WHERE
      operation_id = last_operation_id
  ) names ON true
  LEFT JOIN LATERAL (
    SELECT
      json_agg(facebook_name ORDER BY item_order) AS facebook_names
    FROM
      student_facebook_name
    WHERE
      operation_id = last_operation_id
  ) facebook_names ON true
  LEFT JOIN LATERAL (
    SELECT
      json_agg(email ORDER BY item_order) AS emails
    FROM
      student_email
    WHERE
      operation_id = last_operation_id
  ) emails ON true
  LEFT JOIN LATERAL (
    SELECT
      json_agg(phone ORDER BY item_order) AS phones
    FROM
      student_phone
    WHERE
      operation_id = last_operation_id
  ) phones ON true
WHERE
  student.student_number = ${studentNumber}
  `

  if (result.length === 0) {
    return undefined
  }

  assert(result.length === 1, `More than one student with ID ${studentNumber}`)

  return result[0]
}

export async function createStudent(student: NewStudent, reason: string | undefined, sql: Sql) {
  return await sql.begin(async (sql) => {
    const now = new Date()
    const operationId = crypto.randomUUID()

    const studentNumberResult = await sql`
  INSERT INTO student_operation VALUES
    (${operationId}, DEFAULT, ${now}, 'create', ${reason ?? null}, ${student.birthday})
    RETURNING student_number
  `
    const studentNumber = studentNumberResult[0].studentNumber

    await sql`
  INSERT INTO student VALUES
    (${studentNumber}, ${operationId})
  `

    await addStudentStuff(student, operationId, sql)

    return studentNumber
  })
}

export async function updateStudent(
  student: Student,
  reason: string | undefined,
  sql: Sql,
): Promise<number | undefined> {
  return await sql.begin(async (sql) => {
    const now = new Date()
    const operationId = crypto.randomUUID()

    await sql`
  INSERT INTO student_operation VALUES
    (${operationId}, DEFAULT, ${now}, 'update', ${reason ?? null}, ${student.birthday})

  `
    const studentNumberResult = await sql`
        UPDATE student SET
          student_number = ${student.studentNumber},
          last_operation_id = ${operationId}
        WHERE student_number = ${student.studentNumber}
        RETURNING student_number
      `

    if (studentNumberResult.length === 0) {
      return undefined
    }

    assert(
      studentNumberResult.length === 1,
      `More than one student with ID ${student.studentNumber}`,
    )

    await addStudentStuff(student, operationId, sql)

    return student.studentNumber
  })
}

async function addStudentStuff(
  student: {
    birthday: Date
    names: {firstName: string; lastName: string}[]
    emails: string[]
    phones: string[]
    facebookNames: string[]
    cardcomCustomerId: string | undefined
  },
  operationId: string,
  sql: Sql,
) {
  let ops = [] as Promise<unknown>[]

  ops = ops.concat(
    student.names.map(
      (name, index) => sql`
    INSERT INTO student_name VALUES
      (${operationId}, ${index}, ${name.firstName}, ${name.lastName})
    `,
    ),
  )
  ops = ops.concat(
    student.emails.map(
      (email, index) => sql`
    INSERT INTO student_email VALUES
      (${operationId}, ${index}, ${email})
    `,
    ),
  )

  ops = ops.concat(
    student.phones.map(
      (phone, index) => sql`
    INSERT INTO student_phone VALUES
      (${operationId}, ${index}, ${phone})
    `,
    ),
  )
  ops = ops.concat(
    student.facebookNames.map(
      (facebookName, index) => sql`
    INSERT INTO student_facebook_name VALUES
      (${operationId}, ${index}, ${facebookName})
    `,
    ),
  )

  if (student.cardcomCustomerId) {
    ops = ops.concat(sql`
      INSERT INTO student_integration_cardcom VALUES
        (${operationId}, ${student.cardcomCustomerId})
      `)
  }

  await Promise.all(ops)
}
