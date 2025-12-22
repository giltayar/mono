import type {AcademyIntegrationService} from '@giltayar/carmel-tools-academy-integration/service'
import type {CardcomIntegrationService} from '@giltayar/carmel-tools-cardcom-integration/service'
import type {SmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/service'
import {makeError} from '@giltayar/functional-commons'
import type {FastifyBaseLogger} from 'fastify'
import type {Sql} from 'postgres'
import {
  subscribeStudentInSmooveLists,
  connectStudentWithAcademyCourses,
  disconnectStudentFromAcademyCourses,
  moveStudentToSmooveRemovedSubscriptionList,
  removeStudentFromWhatsAppGroups,
} from './model-external-providers.ts'
import type {WhatsAppIntegrationService} from '@giltayar/carmel-tools-whatsapp-integration/service'
import {registerJobHandler, type JobSubmitter} from '../../job/job-handlers.ts'

export type SaleConnectionToStudent = {
  studentNumber: number
  saleNumber: number
}

export type DisconnectSalePayload = {
  saleNumber: number
  reason: 'removed-from-subscription' | 'disconnected-manually'
}

export let submitConnectionJob: JobSubmitter<SaleConnectionToStudent> | undefined

export async function initializeJobHandlers(
  academyIntegration: AcademyIntegrationService,
  smooveIntegration: SmooveIntegrationService,
) {
  submitConnectionJob = registerJobHandler<SaleConnectionToStudent>(
    'connecting-cardcom-one-time-sale',
    async (payload, _attempt, logger, sql) => {
      await connectSaleToExternalProviders(
        payload,
        academyIntegration,
        smooveIntegration,
        sql,
        logger,
      )
    },
  )
}

export async function connectSale(
  saleNumber: number,
  now: Date,
  sql: Sql,
  cardcomIntegration: CardcomIntegrationService,
  smooveIntegration: SmooveIntegrationService,
  academyIntegration: AcademyIntegrationService,
  loggerParent: FastifyBaseLogger,
) {
  const logger = loggerParent.child({
    saleNumber,
    jobId: crypto.randomUUID(),
    job: 'connect-sale',
  })
  logger.info('connect-sale-started')
  return await sql.begin(async (sql) => {
    const historyId = crypto.randomUUID()
    const dataManualId = crypto.randomUUID()
    const dataActiveId = crypto.randomUUID()
    const dataConnectedId = crypto.randomUUID()
    const sale = await querySaleForConnectingSale(saleNumber, sql)

    if (sale === undefined) throw makeError(`Sale ${saleNumber} does not exist`, {httpStatus: 404})

    logger.info({invoiceUrl: sale.cardcomInvoiceDocumentUrl}, 'connect-sale-succeeded')

    await connectSaleToExternalProviders(
      {studentNumber: parseInt(sale.studentNumber), saleNumber},
      academyIntegration,
      smooveIntegration,
      sql,
      logger,
    )

    await connectSaleToCardcom(sale, logger, cardcomIntegration, now, sql, dataManualId)

    await sql`INSERT INTO sale_data_active ${sql({dataActiveId, isActive: true})}`
    await sql`INSERT INTO sale_data_connected ${sql({dataConnectedId, isConnected: true})}`

    const dataIdResult = await sql<object[]>`
      INSERT INTO sale_history (id, data_id, data_product_id, data_active_id, data_manual_id, data_connected_id, sale_number, timestamp, operation, operation_reason)
      SELECT
        ${historyId},
        sale.last_data_id as last_data_id,
        sale.last_data_product_id as last_data_product_id,
        ${dataActiveId} as data_active_id,
        ${dataManualId},
        ${dataConnectedId},
        sale.sale_number,
        ${now},
        'connect-sale',
        'manual connection of sale'
      FROM sale_history
      INNER JOIN sale ON sale.sale_number = ${saleNumber}
      WHERE id = sale.last_history_id
      RETURNING 1
    `

    if (dataIdResult.length !== 1) {
      throw new Error(`Zero or more than one sale with ID ${saleNumber}`)
    }

    logger.info({historyId, dataManualId}, 'sale-history-record-created')

    await sql`
      UPDATE sale SET
        last_history_id = ${historyId},
        last_data_manual_id = ${dataManualId}
      WHERE sale_number = ${saleNumber}
    `

    logger.info('connect-sale-completed')

    return {url: sale.cardcomInvoiceDocumentUrl}
  })
}

export async function disconnectSale(
  {saleNumber, reason}: DisconnectSalePayload,
  academyIntegration: AcademyIntegrationService,
  smooveIntegration: SmooveIntegrationService,
  whatsappIntegration: WhatsAppIntegrationService,
  now: Date,
  sql: Sql,
  parentLogger: FastifyBaseLogger,
) {
  const dataConnectedId = crypto.randomUUID()
  const logger = parentLogger.child({saleNumber})

  logger.info('disconnect-sale-from-external-providers-started')
  const studentResult = await sql<{studentNumber: number; email: string; phone: string | null}[]>`
    SELECT
      s.student_number,
      se.email,
      sp.phone
    FROM student s
    JOIN sale sl ON sl.sale_number = ${saleNumber}
    JOIN sale_history slh ON slh.id = sl.last_history_id
    JOIN sale_data sd ON sd.data_id = slh.data_id
    JOIN student_history sh ON sh.id = s.last_history_id
    JOIN student_email se ON se.data_id = sh.data_id AND se.item_order = 0
    LEFT JOIN student_phone sp ON sp.data_id = sh.data_id AND sp.item_order = 0
    WHERE s.student_number = sd.student_number
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
    student.studentNumber,
    saleNumber,
    smooveIntegration,
    sql,
    logger,
  )

  const whatsappConnectionP = student.phone
    ? removeStudentFromWhatsAppGroups(
        student.studentNumber,
        student.phone,
        whatsappIntegration,
        sql,
        logger,
      )
    : undefined

  const [academyConnectionResult, smooveConnectionResult, whatsappConnectionResult] =
    await Promise.allSettled([academyConnectionP, smooveConnectionP, whatsappConnectionP])

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

  if (whatsappConnectionResult.status === 'rejected') {
    logger.error(
      {err: whatsappConnectionResult.reason},
      'removing-student-from-whatsapp-groups-failed',
    )
  } else {
    logger.info('removing-student-from-whatsapp-groups-succeeded')
  }

  if (
    academyConnectionResult.status === 'rejected' ||
    smooveConnectionResult.status === 'rejected' ||
    whatsappConnectionResult.status === 'rejected'
  ) {
    throw new Error('Disconnecting sale from external providers failed')
  }

  await sql`INSERT INTO sale_data_connected ${sql({dataConnectedId, isConnected: false})}`

  const historyId = crypto.randomUUID()
  await sql`
    INSERT INTO sale_history
      (id, data_id, data_product_id, data_manual_id, data_active_id, data_connected_id, sale_number, timestamp, operation, operation_reason)
    SELECT
      ${historyId},
      sh.data_id,
      sh.data_product_id,
      sh.data_manual_id,
      sh.data_active_id,
      ${dataConnectedId},
      sh.sale_number,
      ${now},
      ${reason},
      null
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

async function connectSaleToCardcom(
  sale: {
    studentCardcomCustomerId: string | null
    studentNumber: string
    studentEmail: string
    studentPhone: string | null
    studentFirstName: string
    studentLastName: string
    products: Array<{
      productNumber: string
      productName: string
      quantity: number
      unitPrice: number
    }>
    timestamp: Date | null
    finalSaleRevenue: string | null
    cardcomCustomerId: string | null
    cardcomInvoiceDocumentUrl: string | null
    cardcomInvoiceNumber: string | null
  },
  logger: FastifyBaseLogger,
  cardcomIntegration: CardcomIntegrationService,
  now: Date,
  sql: Sql,
  dataManualId: string,
) {
  if (!sale.cardcomInvoiceNumber) {
    logger.info('creating-cardcom-invoice-document')
    const transactionRevenueInCents = parseFloat(sale.finalSaleRevenue ?? '0') * 100
    const {cardcomCustomerId, cardcomDocumentLink, cardcomInvoiceNumber} =
      await cardcomIntegration.createTaxInvoiceDocument(
        {
          cardcomCustomerId: sale.studentCardcomCustomerId
            ? parseInt(sale.studentCardcomCustomerId)
            : undefined,
          customerEmail: sale.studentEmail,
          customerName: sale.studentFirstName + ' ' + sale.studentLastName,
          customerPhone: sale.studentPhone ?? undefined,
          productsSold:
            sale.products?.map((p) => ({
              productId: p.productNumber,
              productName: p.productName,
              quantity: p.quantity,
              unitPriceInCents: p.unitPrice * 100,
            })) ?? [],
          transactionDate: sale.timestamp ?? now,
          transactionRevenueInCents,
        },
        {sendInvoiceByMail: true},
      )

    logger.info(
      {cardcomDocumentLink, cardcomCustomerId, cardcomInvoiceNumber},
      'cardcom-invoice-document-created',
    )

    sale.cardcomInvoiceDocumentUrl = cardcomDocumentLink

    await sql`
        INSERT INTO sale_data_cardcom_manual ${sql({
          dataManualId,
          cardcomInvoiceNumber,
          invoiceDocumentUrl: cardcomDocumentLink,
          cardcomCustomerId,
          cardcomSaleRevenue: transactionRevenueInCents / 100,
        })}
      `
    logger.info({cardcomInvoiceNumber}, 'cardcom-invoice-document-updated-in-sale')
  } else if (!sale.cardcomInvoiceDocumentUrl) {
    logger.info(
      {cardcomInvoiceNumber: sale.cardcomInvoiceNumber},
      'creating-cardcom-invoice-document-url',
    )
    sale.cardcomInvoiceDocumentUrl = (
      await cardcomIntegration.createTaxInvoiceDocumentUrl(sale.cardcomInvoiceNumber)
    ).url
    await sql`
        INSERT INTO sale_data_cardcom_manual ${sql({
          dataManualId,
          cardcomInvoiceNumber: sale.cardcomInvoiceNumber,
          invoiceDocumentUrl: sale.cardcomInvoiceDocumentUrl,
          cardcomCustomerId: sale.cardcomCustomerId,
          cardcomSaleRevenue: parseFloat(sale.finalSaleRevenue ?? '0'),
        })}
      `

    logger.info(
      {invoiceUrl: sale.cardcomInvoiceDocumentUrl},
      'created-cardcom-invoice-document-url',
    )
  } else {
    logger.info('sale-already-connected-no-action-needed')
  }
}

async function querySaleForConnectingSale(saleNumber: number, sql: Sql) {
  const result = (await sql`
    SELECT
      COALESCE(
        sale_data_cardcom.customer_id,
        sale_data_cardcom_manual.cardcom_customer_id
      ) AS student_cardcom_customer_id,
      COALESCE(
        sale_data_cardcom.invoice_document_url,
        sale_data_cardcom_manual.invoice_document_url
      ) AS cardcom_invoice_document_url,
      COALESCE(
        sale_data_cardcom.invoice_number,
        sale_data_cardcom_manual.cardcom_invoice_number
      ) AS cardcom_invoice_number,
      COALESCE(
        sale_data_cardcom.customer_id,
        sale_data_cardcom_manual.cardcom_customer_id
      ) AS cardcom_customer_id,
      student.student_number AS student_number,
      student_email.email AS student_email,
      student_phone.phone AS student_phone,
      student_name.first_name AS student_first_name,
      student_name.last_name AS student_last_name,
      sale_data.timestamp AS timestamp,
      COALESCE(
        sale_data_cardcom.cardcom_sale_revenue,
        sale_data_cardcom_manual.cardcom_sale_revenue
      ) AS final_sale_revenue,
      COALESCE(products, json_build_array()) AS products
    FROM
      sale
      JOIN sale_history ON sale_history.id = sale.last_history_id
      JOIN sale_data ON sale_data.data_id = sale_history.data_id
      LEFT JOIN sale_data_cardcom ON sale_data_cardcom.data_cardcom_id = sale.data_cardcom_id
      LEFT JOIN sale_data_cardcom_manual ON sale_data_cardcom_manual.data_manual_id = sale_history.data_manual_id
      JOIN student ON student.student_number = sale_data.student_number
      JOIN student_name ON student_name.data_id = student.last_data_id AND student_name.item_order = 0
      JOIN student_email ON student_email.data_id = student.last_data_id AND student_email.item_order = 0
      LEFT JOIN student_phone ON student_phone.data_id = student.last_data_id AND student_phone.item_order = 0
      LEFT JOIN LATERAL (
        SELECT
          json_agg(
            json_build_object(
              'productNumber', sale_data_product.product_number::text,
              'productName', product_data.name,
              'quantity', sale_data_product.quantity,
              'unitPrice', sale_data_product.unit_price
            )
            ORDER BY
              item_order
          ) AS products
        FROM
          sale_data_product
          INNER JOIN product ON product.product_number = sale_data_product.product_number
          INNER JOIN product_data ON product_data.data_id = product.last_data_id
        WHERE
          sale_data_product.data_product_id = sale.last_data_product_id
      ) products ON true
    WHERE
      sale.sale_number = ${saleNumber}
  `) as {
    studentCardcomCustomerId: string | null
    studentNumber: string
    studentEmail: string
    studentPhone: string | null
    studentFirstName: string
    studentLastName: string
    products: Array<{
      productNumber: string
      productName: string
      quantity: number
      unitPrice: number
    }>
    timestamp: Date | null
    finalSaleRevenue: string | null
    cardcomCustomerId: string | null
    cardcomInvoiceDocumentUrl: string | null
    cardcomInvoiceNumber: string | null
  }[]

  if (result.length === 0) return undefined

  if (result.length > 1) {
    throw new Error(`found more than one ${saleNumber} sale`)
  }

  return result[0]
}

async function connectSaleToExternalProviders(
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
