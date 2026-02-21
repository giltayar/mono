import type {SmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/service'
import type {SmooveContactInList} from '@giltayar/carmel-tools-smoove-integration/types'
import type {FastifyBaseLogger} from 'fastify'
import type {Sql, TransactionSql} from 'postgres'
import {normalizeEmail, normalizePhoneNumber} from '../../../commons/normalize-input.ts'
import {submitConnectionJob} from '../../sale/model/model-connect.ts'
import {triggerJobsExecution} from '../../job/job-executor.ts'
import {createNoInvoiceSale} from '../../sale/model/model-sale.ts'
import {delay} from '@giltayar/promise-commons'

export type ImportResult = {
  total: number
  successful: number
  skipped: number
  errors: Array<{contact: {email: string; firstName: string; lastName: string}; error: string}>
}

export async function importFromSmooveList(
  salesEventNumber: number,
  smooveListId: number,
  now: Date,
  smooveIntegration: SmooveIntegrationService,
  sql: Sql,
  loggerParent: FastifyBaseLogger,
): Promise<ImportResult> {
  const logger = loggerParent.child({
    salesEventNumber,
    smooveListId,
    jobId: crypto.randomUUID(),
    job: 'import-from-smoove-list',
  })

  logger.info('import-from-smoove-list-started')

  // Verify sales event exists
  const hasSalesEvent = await doesSalesEventExist(salesEventNumber, sql, logger)
  if (!hasSalesEvent) {
    return {
      total: 0,
      successful: 0,
      skipped: 0,
      errors: [
        {
          contact: {email: '', firstName: '', lastName: ''},
          error: `Sales event ${salesEventNumber} not found`,
        },
      ],
    }
  }

  // Fetch contacts from Smoove list
  let contacts: SmooveContactInList[]
  try {
    contacts = await smooveIntegration.fetchContactsOfList(smooveListId)
    logger.info({contactCount: contacts.length}, 'fetched-smoove-contacts')
  } catch (error) {
    const errorMessage =
      'message' in (error as any) ? (error as any).message : 'Unknown error fetching contacts'
    return {
      total: 0,
      successful: 0,
      skipped: 0,
      errors: [{contact: {email: '', firstName: '', lastName: ''}, error: errorMessage}],
    }
  }

  const total = contacts.length
  let successful = 0
  let skipped = 0
  const errors: Array<{
    contact: {email: string; firstName: string; lastName: string}
    error: string
  }> = []

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i]
    const contactInfo = {
      email: contact.email,
      firstName: contact.firstName,
      lastName: contact.lastName,
    }

    try {
      const result = await importSingleContact(salesEventNumber, contact, now, sql, logger)

      if (result === 'created') {
        successful++
      } else if (result === 'skipped') {
        skipped++
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error({err: error, contact: contactInfo}, 'import-contact-failed')
      errors.push({contact: contactInfo, error: errorMessage})
    }

    // Rate limiting: 300ms delay between contacts
    if (i < contacts.length - 1) {
      await delay(300)
    }
  }

  triggerJobsExecution(() => now)

  logger.info(
    {total, successful, skipped, errorCount: errors.length},
    'import-from-smoove-list-completed',
  )

  return {total, successful, skipped, errors}
}

async function importSingleContact(
  salesEventNumber: number,
  contact: SmooveContactInList,
  now: Date,
  sql: Sql,
  logger: FastifyBaseLogger,
): Promise<'created' | 'skipped'> {
  return await sql.begin(async (txSql) => {
    const email = normalizeEmail(contact.email)
    const phone = contact.telephone ? normalizePhoneNumber(contact.telephone) : undefined

    // Find existing student
    const student = await findStudent(email, phone, txSql)

    // Check if sale already exists for this student + sales event
    if (student && (await hasSaleWithStudent(student.studentNumber, salesEventNumber, txSql))) {
      logger.info(
        {studentId: student.studentNumber, email: contact.email},
        'sale-already-exists-for-student',
      )

      // Even if sale exists, ensure connection job is submitted
      const saleNumber = await getSaleNumberForStudent(
        student.studentNumber,
        salesEventNumber,
        txSql,
      )
      if (saleNumber && submitConnectionJob) {
        const isConnected = await isSaleConnected(saleNumber, txSql)
        if (!isConnected) {
          await submitConnectionJob({studentNumber: student.studentNumber, saleNumber}, {})
          logger.info({saleNumber}, 'connection-job-submitted-for-existing-sale')
        }
      }

      return 'skipped'
    }

    const finalStudent = student ?? (await createStudentFromSmooveContact(contact, now, txSql))

    logger.info({studentId: finalStudent.studentNumber}, 'final-student-determined')

    const saleNumber = await createNoInvoiceSale(
      finalStudent.studentNumber,
      salesEventNumber,
      'Created from Smoove import',
      now,
      txSql,
      logger,
    )

    logger.info({saleNumber}, 'sale-created-from-smoove-import')

    if (submitConnectionJob) {
      await submitConnectionJob({studentNumber: finalStudent.studentNumber, saleNumber}, {})
    }

    return 'created'
  })
}

async function doesSalesEventExist(
  salesEventNumber: number,
  sql: Sql,
  logger: FastifyBaseLogger,
): Promise<boolean> {
  logger.info({salesEventNumber}, 'checking-if-sales-event-exists')
  const result =
    await sql`SELECT 1 FROM sales_event WHERE sales_event_number = ${salesEventNumber} LIMIT 1`
  return result.length > 0
}

type StudentInfoFound = {
  studentNumber: number
  email: string
  firstName: string
  lastName: string
  phone: string | undefined
}

async function findStudent(
  email: string,
  phone: string | undefined,
  sql: TransactionSql,
): Promise<StudentInfoFound | undefined> {
  const resultByEmailAndPhone = await sql<StudentInfoFound[]>`
    SELECT DISTINCT
      s.student_number,
      se.email,
      sn.first_name,
      sn.last_name,
      sp.phone
    FROM student s
    JOIN student_email se ON se.data_id = s.last_data_id AND se.item_order = 0
    JOIN student_name sn ON sn.data_id = s.last_data_id AND sn.item_order = 0
    LEFT JOIN student_phone sp ON sp.data_id = s.last_data_id AND sp.item_order = 0
    WHERE s.last_data_id IN (
      SELECT se2.data_id FROM student_email se2 WHERE se2.email = ${email}
      UNION
      SELECT sp2.data_id FROM student_phone sp2 WHERE sp2.phone = ${phone ?? null}
    )
    LIMIT 1
  `

  if (resultByEmailAndPhone.length === 0) {
    return undefined
  }

  return resultByEmailAndPhone[0]
}

async function hasSaleWithStudent(
  studentNumber: number,
  salesEventNumber: number,
  sql: TransactionSql,
): Promise<boolean> {
  const result = await sql`
    SELECT 1 FROM sale
    JOIN sale_history ON sale_history.id = sale.last_history_id
    JOIN sale_data ON sale_data.data_id = sale_history.data_id
    WHERE sale_data.student_number = ${studentNumber}
      AND sale_data.sales_event_number = ${salesEventNumber}
    LIMIT 1
  `
  return result.length > 0
}

async function getSaleNumberForStudent(
  studentNumber: number,
  salesEventNumber: number,
  sql: TransactionSql,
): Promise<number | undefined> {
  const result = await sql<{saleNumber: number}[]>`
    SELECT sale.sale_number FROM sale
    JOIN sale_history ON sale_history.id = sale.last_history_id
    JOIN sale_data ON sale_data.data_id = sale_history.data_id
    WHERE sale_data.student_number = ${studentNumber}
      AND sale_data.sales_event_number = ${salesEventNumber}
    LIMIT 1
  `
  return result.length > 0 ? result[0].saleNumber : undefined
}

async function isSaleConnected(saleNumber: number, sql: TransactionSql): Promise<boolean> {
  const result = await sql<{isConnected: boolean}[]>`
    SELECT sdc.is_connected FROM sale
    JOIN sale_history ON sale_history.id = sale.last_history_id
    JOIN sale_data_connected sdc ON sdc.data_connected_id = sale_history.data_connected_id
    WHERE sale.sale_number = ${saleNumber}
    LIMIT 1
  `
  return result.length > 0 && result[0].isConnected
}

async function createStudentFromSmooveContact(
  contact: SmooveContactInList,
  now: Date,
  sql: TransactionSql,
): Promise<StudentInfoFound> {
  const email = normalizeEmail(contact.email)
  const phone = contact.telephone ? normalizePhoneNumber(contact.telephone) : undefined

  const historyId = crypto.randomUUID()
  const dataId = crypto.randomUUID()
  const studentNumberResult = await sql<{studentNumber: string}[]>`
    INSERT INTO student_history VALUES
      (${historyId}, ${dataId}, DEFAULT, ${now}, 'create', 'Created from Smoove import')
    RETURNING student_number
  `
  const studentNumber = parseInt(studentNumberResult[0].studentNumber)

  // Use existing Smoove contact ID if available
  const smooveId = contact.id

  let ops = [] as Promise<unknown>[]

  ops = ops.concat(sql`
    INSERT INTO student VALUES
      (${studentNumber}, ${historyId}, ${dataId})
  `)

  if (contact.firstName || contact.lastName)
    ops = ops.concat(sql`
      INSERT INTO student_name VALUES
        (${dataId}, 0, ${contact.firstName ?? ''}, ${contact.lastName ?? ''})
    `)

  ops = ops.concat(sql`
    INSERT INTO student_email VALUES
      (${dataId}, 0, ${email})
  `)

  if (phone)
    ops = ops.concat(sql`
      INSERT INTO student_phone VALUES
        (${dataId}, 0, ${phone})
    `)

  const searchableText =
    `${studentNumber} ${contact.firstName ?? ''} ${contact.lastName ?? ''} ${email} ${phone ?? ''}`.trim()
  ops = ops.concat(sql`
    INSERT INTO student_search VALUES
      (${dataId}, ${searchableText})
  `)

  if (smooveId) {
    ops = ops.concat(sql`INSERT INTO student_integration_smoove VALUES (${dataId}, ${smooveId})`)
  }

  await Promise.all(ops)

  return {
    studentNumber,
    email,
    firstName: contact.firstName ?? '',
    lastName: contact.lastName ?? '',
    phone,
  }
}
