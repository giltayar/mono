import type {AcademyIntegrationService} from '@giltayar/carmel-tools-academy-integration/service'
import type {SmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/service'
import type {FastifyBaseLogger} from 'fastify'
import type {Sql} from 'postgres'
import {
  type SaleConnectionToStudent,
  connectStudentWithAcademyCourses,
  disconnectStudentFromAcademyCourses,
  subscribeStudentInSmooveLists,
} from './model-sale.ts'

export async function connectSaleToExternalProviders(
  {studentNumber, saleNumber}: SaleConnectionToStudent,
  academyIntegration: AcademyIntegrationService,
  smooveIntegration: SmooveIntegrationService,
  sql: Sql,
  parentLogger: FastifyBaseLogger,
) {
  const logger = parentLogger.child({saleNumber, studentNumber})

  logger.info('connect-sale-to-external-providers-started')
  const studentResult = await sql<
    {email: string; firstName: string; lastName: string; phone: string | undefined}[]
  >`
    SELECT
      se.email,
      sn.first_name,
      sn.last_name,
      sp.phone
    FROM student s
    JOIN student_email se ON se.data_id = s.last_data_id AND se.item_order = 0
    JOIN student_name sn ON sn.data_id = s.last_data_id AND sn.item_order = 0
    LEFT JOIN student_phone sp ON sp.data_id = s.last_data_id AND sp.item_order = 0
    WHERE s.student_number = ${studentNumber}
  `

  const student = studentResult[0]

  if (!student)
    throw new Error(`cannot connect student in sale to external providers because not found`)

  logger.info(
    {email: student.email, phone: student.phone, name: student.firstName + ' ' + student.lastName},
    'student-found-for-connecting-to-external-providers',
  )

  const academyConnectionP = connectStudentWithAcademyCourses(
    saleNumber,
    {
      email: student.email,
      name: student.firstName + ' ' + student.lastName,
      phone: student.phone ?? '',
    },
    academyIntegration,
    sql,
    logger,
  )
  const smooveConnectionP = subscribeStudentInSmooveLists(
    studentNumber,
    saleNumber,
    smooveIntegration,
    sql,
    logger,
  )

  const [academyConnectionResult, smooveConnectionResult] = await Promise.allSettled([
    academyConnectionP,
    smooveConnectionP,
  ])

  if (academyConnectionResult.status === 'rejected') {
    logger.error(
      {err: academyConnectionResult.reason},
      'connecting-student-with-academy-courses-failed',
    )
  } else {
    logger.info('connecting-student-with-academy-courses-succeeded')
  }

  if (smooveConnectionResult.status === 'rejected') {
    logger.error({err: smooveConnectionResult.reason}, 'subscribing-student-to-smoove-lists-failed')
  } else {
    logger.info('subscribing-student-to-smoove-lists-succeeded')
  }

  if (
    academyConnectionResult.status === 'rejected' ||
    smooveConnectionResult.status === 'rejected'
  ) {
    throw new Error('Connecting sale to external providers failed')
  }
}
export async function disconnectSaleFromExternalProviders(
  {studentNumber, saleNumber}: SaleConnectionToStudent,
  academyIntegration: AcademyIntegrationService,
  smooveIntegration: SmooveIntegrationService,
  now: Date,
  sql: Sql,
  parentLogger: FastifyBaseLogger,
) {
  const logger = parentLogger.child({saleNumber, studentNumber})

  logger.info('disconnect-subscription-from-external-providers-started')
  const studentResult = await sql<{email: string}[]>`
    SELECT
      se.email
    FROM student s
    JOIN student_email se ON se.data_id = s.last_data_id AND se.item_order = 0
    WHERE s.student_number = ${studentNumber}
  `

  const student = studentResult[0]

  if (!student)
    throw new Error(`cannot disconnect student in sale from external providers because not found`)

  logger.info({email: student.email}, 'student-found-for-disconnecting-from-external-providers')

  const academyConnectionP = disconnectStudentFromAcademyCourses(
    saleNumber,
    student.email,
    academyIntegration,
    sql,
    logger,
  )
  const smooveConnectionP = moveStudentToSmooveRemovedSubscriptionList(
    studentNumber,
    saleNumber,
    smooveIntegration,
    sql,
    logger,
  )

  const [academyConnectionResult, smooveConnectionResult] = await Promise.allSettled([
    academyConnectionP,
    smooveConnectionP,
  ])

  if (academyConnectionResult.status === 'rejected') {
    logger.error(
      {err: academyConnectionResult.reason},
      'disconnecting-student-from-academy-courses-failed',
    )
  } else {
    logger.info('disconnecting-student-from-academy-courses-succeeded')
  }

  if (smooveConnectionResult.status === 'rejected') {
    logger.error(
      {err: smooveConnectionResult.reason},
      'unsubscribing-student-from-smoove-lists-failed',
    )
  } else {
    logger.info('unsubscribing-student-from-smoove-lists-succeeded')
  }

  if (
    academyConnectionResult.status === 'rejected' ||
    smooveConnectionResult.status === 'rejected'
  ) {
    throw new Error('Disconnecting sale from external providers failed')
  }

  const historyId = crypto.randomUUID()
  await sql`
    INSERT INTO sale_history
      (id, data_id, data_product_id, sale_number, timestamp, operation, operation_reason, data_manual_id, data_active_id)
    SELECT
      ${historyId},
      sh.data_id,
      sh.data_product_id,
      sh.sale_number,
      ${now},
      'removed-from-subscription',
      null,
      sh.data_manual_id,
      sh.data_active_id
    FROM
      sale_history sh
    WHERE sh.id = (
      SELECT s.last_history_id
      FROM sale s
      WHERE s.sale_number = ${saleNumber}
    )
  `

  await sql`
    UPDATE sale
    SET last_history_id = ${historyId}
    WHERE sale_number = ${saleNumber}
  `
}
export async function moveStudentToSmooveCancelledSubscriptionList(
  studentNumber: number,
  saleNumber: number,
  smooveIntegration: SmooveIntegrationService,
  sql: Sql,
  logger: FastifyBaseLogger,
) {
  const smooveProductsLists = await sql<
    {
      listId: string
      cancellingListId: string
      cancelledListId: string
      removedListId: string
    }[]
  >`
    SELECT
      pis.list_id as list_id,
      pis.cancelling_list_id,
      pis.cancelled_list_id,
      pis.removed_list_id
    FROM sale_data_product sip
    JOIN sale s ON s.last_data_product_id = sip.data_product_id
    JOIN product p ON p.product_number = sip.product_number
    JOIN product_integration_smoove pis ON pis.data_id = p.last_data_id
    WHERE s.sale_number = ${saleNumber};
  `

  const smooveContactIdResult = await sql<{smooveContactId: string}[]>`
    SELECT
      smoove_contact_id
    FROM student
    INNER JOIN student_integration_smoove sis ON sis.data_id = student.last_data_id
    WHERE student_number = ${studentNumber}
  `

  const smooveContactId =
    smooveContactIdResult.length > 0 ? smooveContactIdResult[0].smooveContactId : undefined

  if (!smooveContactId) {
    logger.info('smoove-contact-id-not-found-skipping-move')
    return
  }

  const result = await Promise.allSettled(
    smooveProductsLists.map((smooveProductLists) =>
      smooveIntegration.changeContactLinkedLists(parseInt(smooveContactId), {
        subscribeTo: [parseInt(smooveProductLists.cancelledListId)],
        unsubscribeFrom: [
          parseInt(smooveProductLists.listId),
          parseInt(smooveProductLists.cancellingListId),
          parseInt(smooveProductLists.removedListId),
        ],
      }),
    ),
  )

  for (const [is, res] of Object.entries(result)) {
    const i = parseInt(is)
    if (res.status === 'rejected') {
      logger.error(
        {err: res.reason, courseId: smooveProductsLists[i].listId, i, studentNumber},
        'adding-student-to-academy-course-failed',
      )
    } else {
      logger.info(
        {courseId: smooveProductsLists[i].listId, i, studentNumber},
        'adding-student-to-academy-course-succeeded',
      )
    }
  }
}
export async function moveStudentToSmooveRemovedSubscriptionList(
  studentNumber: number,
  saleNumber: number,
  smooveIntegration: SmooveIntegrationService,
  sql: Sql,
  logger: FastifyBaseLogger,
) {
  const smooveProductsLists = await sql<
    {
      listId: string
      cancellingListId: string
      cancelledListId: string
      removedListId: string
    }[]
  >`
    SELECT
      pis.list_id as list_id,
      pis.cancelling_list_id,
      pis.cancelled_list_id,
      pis.removed_list_id
    FROM sale_data_product sip
    JOIN sale s ON s.last_data_product_id = sip.data_product_id
    JOIN product p ON p.product_number = sip.product_number
    JOIN product_integration_smoove pis ON pis.data_id = p.last_data_id
    WHERE s.sale_number = ${saleNumber};
  `

  const smooveContactIdResult = await sql<{smooveContactId: string}[]>`
    SELECT
      smoove_contact_id
    FROM student
    INNER JOIN student_integration_smoove sis ON sis.data_id = student.last_data_id
    WHERE student_number = ${studentNumber}
  `

  const smooveContactId =
    smooveContactIdResult.length > 0 ? smooveContactIdResult[0].smooveContactId : undefined

  if (!smooveContactId) {
    logger.info('smoove-contact-id-not-found-skipping-move')
    return
  }

  const result = await Promise.allSettled(
    smooveProductsLists.map((smooveProductLists) =>
      smooveIntegration.changeContactLinkedLists(parseInt(smooveContactId), {
        subscribeTo: [parseInt(smooveProductLists.removedListId)],
        unsubscribeFrom: [
          parseInt(smooveProductLists.listId),
          parseInt(smooveProductLists.cancellingListId),
          parseInt(smooveProductLists.cancelledListId),
        ],
      }),
    ),
  )

  for (const [is, res] of Object.entries(result)) {
    const i = parseInt(is)
    if (res.status === 'rejected') {
      logger.error(
        {err: res.reason, courseId: smooveProductsLists[i].listId, i, studentNumber},
        'adding-student-to-academy-course-failed',
      )
    } else {
      logger.info(
        {courseId: smooveProductsLists[i].listId, i, studentNumber},
        'adding-student-to-academy-course-succeeded',
      )
    }
  }
}
