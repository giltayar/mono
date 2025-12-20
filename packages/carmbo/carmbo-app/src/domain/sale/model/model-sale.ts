import type {AcademyIntegrationService} from '@giltayar/carmel-tools-academy-integration/service'
import type {SmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/service'
import {makeError} from '@giltayar/functional-commons'
import type {Sql, TransactionSql} from 'postgres'
import {normalizeEmail, normalizePhoneNumber} from '../../../commons/normalize-input.ts'
import type {CardcomIntegrationService} from '@giltayar/carmel-tools-cardcom-integration/service'
import type {CardcomSaleWebhookJson} from '@giltayar/carmel-tools-cardcom-integration/types'
import type {FastifyBaseLogger} from 'fastify'
import {registerJobHandler, type JobSubmitter} from '../../job/job-handlers.ts'
import {triggerJobsExecution} from '../../job/job-executor.ts'
import {
  connectSaleToExternalProviders,
  connectStudentWithAcademyCourses,
  subscribeStudentInSmooveLists,
} from './model-external-providers.ts'

export type StandingOrderPaymentResolution = 'payed' | 'failure-but-retrying' | 'failed' | 'on-hold'

export type SaleConnectionToStudent = {
  studentNumber: number
  saleNumber: number
}

let submitConnectionJob: JobSubmitter<SaleConnectionToStudent> | undefined

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

export async function addCardcomSale(
  salesEventNumber: number,
  cardcomSaleWebhookJson: CardcomSaleWebhookJson,
  now: Date,
  smooveIntegration: SmooveIntegrationService,
  cardcomIntegration: CardcomIntegrationService,
  sql: Sql,
  loggerParent: FastifyBaseLogger,
) {
  const logger = loggerParent.child({
    salesEventNumber,
    jobId: crypto.randomUUID(),
    job: 'handle-cardcom-sale',
  })
  logger.info('handle-cardcom-sale-started')
  await sql.begin(async (sql) => {
    const [hasSaleWithInvoiceNumber_, hasSalesEvent] = await Promise.all([
      hasSaleWithInvoiceNumber(cardcomSaleWebhookJson.invoicenumber, sql, logger),
      doesSalesEventExist(salesEventNumber, sql, logger),
    ])

    if (hasSaleWithInvoiceNumber_) {
      logger.info({invoiceNumber: cardcomSaleWebhookJson.invoicenumber}, 'sale-already-exists')
      return
    }
    if (!hasSalesEvent) {
      throw makeError(`Sales event not found: ${salesEventNumber}`, {httpStatus: 400})
    }
    logger.info({hasSalesEvent}, 'does-sales-event-exist')

    const student = await findStudent(
      cardcomSaleWebhookJson.UserEmail,
      cardcomSaleWebhookJson.CardOwnerPhone,
      sql,
    )
    logger.info({studentId: student?.studentNumber}, 'finding-student-result')
    const finalStudent =
      student ??
      (await createStudentFromStudentInfo(
        generateStudentInfoFromCardcomSale(cardcomSaleWebhookJson),
        now,
        smooveIntegration,
        sql,
      ))
    logger.info({studentId: finalStudent.studentNumber}, 'final-student-determined')

    const {url} = await cardcomIntegration.createTaxInvoiceDocumentUrl(
      cardcomSaleWebhookJson.invoicenumber,
    )
    logger.info({url}, 'tax-invoice-document-url-created')

    const saleNumber = await createSaleFromCardcomData(
      finalStudent.studentNumber,
      salesEventNumber,
      cardcomSaleWebhookJson,
      url,
      now,
      sql,
      logger,
    )
    logger.info({saleNumber}, 'sale-created')

    if (!submitConnectionJob) throw new Error('Job handlers not initialized')

    await submitConnectionJob({studentNumber: finalStudent.studentNumber, saleNumber}, sql, {})

    logger.info('sql-transaction-completed')
  })

  triggerJobsExecution(() => now)
}

interface StudentInfoForASale {
  email: string
  firstName: string | undefined
  lastName: string | undefined
  phone: string | undefined
  cellPhone: string | undefined
}

export async function addNoInvoiceSale(
  salesEventNumber: number,
  studentInfo: StudentInfoForASale,
  now: Date,
  smooveIntegration: SmooveIntegrationService,
  sql: Sql,
  loggerParent: FastifyBaseLogger,
) {
  const logger = loggerParent.child({
    salesEventNumber,
    jobId: crypto.randomUUID(),
    job: 'handle-cardcom-sale',
  })
  logger.info('handle-no-invoice-sale-started')
  await sql.begin(async (sql) => {
    const hasSalesEvent = await doesSalesEventExist(salesEventNumber, sql, logger)
    if (!hasSalesEvent) {
      throw makeError(`Sales event not found: ${salesEventNumber}`, {httpStatus: 400})
    }

    logger.info({hasSalesEvent}, 'does-sales-event-exist')

    const student = await findStudent(
      studentInfo.email,
      studentInfo.phone || studentInfo.cellPhone,
      sql,
    )
    logger.info({studentId: student?.studentNumber}, 'finding-student-result')

    logger.info({student}, 'searching-for-existing-sale')
    if (student && (await hasSaleWithStudent(student.studentNumber, salesEventNumber, sql))) {
      logger.info({studentId: student.studentNumber}, 'sale-already-exists-for-student')
      return
    }

    const finalStudent =
      student ?? (await createStudentFromStudentInfo(studentInfo, now, smooveIntegration, sql))
    logger.info({studentId: finalStudent.studentNumber}, 'final-student-determined')

    const saleNumber = await createNoInvoiceSale(
      finalStudent.studentNumber,
      salesEventNumber,
      now,
      sql,
      logger,
    )
    logger.info({saleNumber}, 'sale-created')

    if (!submitConnectionJob) throw new Error('Job handlers not initialized')

    await submitConnectionJob({studentNumber: finalStudent.studentNumber, saleNumber}, sql, {})

    logger.info('sql-transaction-completed')
  })

  triggerJobsExecution(() => now)
}

async function doesSalesEventExist(
  salesEventNumber: number,
  sql: Sql,
  logger: FastifyBaseLogger,
): Promise<boolean> {
  logger.info({salesEventNumber}, 'checking-if-sales-event-exists')
  const result =
    await sql`SELECT 1 FROM sales_event WHERE sales_event_number = ${salesEventNumber} LIMIT 1`

  logger.info({exists: result.length > 0}, 'sales-event-existence-checked')

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
  sql: Sql,
): Promise<StudentInfoFound | undefined> {
  const finalEmail = normalizeEmail(email)
  const finalPhone = phone ? normalizePhoneNumber(phone) : undefined

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
      SELECT se2.data_id FROM student_email se2 WHERE se2.email = ${finalEmail}
      UNION
      SELECT sp2.data_id FROM student_phone sp2 WHERE sp2.phone = ${finalPhone ?? null}
    )
    LIMIT 1
  `

  if (resultByEmailAndPhone.length === 0) {
    return undefined
  }

  return resultByEmailAndPhone[0]
}

async function createStudentFromStudentInfo(
  studentInfo: StudentInfoForASale,
  now: Date,
  smooveIntegration: SmooveIntegrationService,
  sql: Sql,
): Promise<{
  studentNumber: number
  email: string
  firstName: string
  lastName: string
  phone: string | undefined
}> {
  const email = normalizeEmail(studentInfo.email)
  const studentPhone = studentInfo.phone || studentInfo.cellPhone
  const phone = studentPhone ? normalizePhoneNumber(studentPhone) : undefined

  const historyId = crypto.randomUUID()
  const dataId = crypto.randomUUID()
  const studentNumberResult = await sql<{studentNumber: string}[]>`
      INSERT INTO student_history VALUES
        (${historyId}, ${dataId}, DEFAULT, ${now}, 'create', 'Created from Cardcom sale')
      RETURNING student_number
    `
  const studentNumber = parseInt(studentNumberResult[0].studentNumber)

  const result = await smooveIntegration.createSmooveContact({
    email,
    telephone: phone,
    firstName: studentInfo.firstName ?? '',
    lastName: studentInfo.lastName ?? '',
    birthday: undefined,
  })

  let ops = [] as Promise<unknown>[]

  ops = ops.concat(sql`
      INSERT INTO student VALUES
        (${studentNumber}, ${historyId}, ${dataId})
    `)

  if (studentInfo.firstName || studentInfo.lastName)
    ops = ops.concat(sql`
      INSERT INTO student_name VALUES
        (${dataId}, 0, ${studentInfo.firstName ?? ''}, ${studentInfo.lastName ?? ''})
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
    `${studentNumber} ${studentInfo.firstName ?? ''} ${studentInfo.lastName ?? ''} ${email} ${phone}`.trim()
  ops = ops.concat(sql`
      INSERT INTO student_search VALUES
        (${dataId}, ${searchableText})
    `)

  if (typeof result === 'object') {
    const {smooveId} = result

    ops = ops.concat(sql`INSERT INTO student_integration_smoove VALUES (${dataId}, ${smooveId})`)
  }

  await Promise.all(ops)

  return {
    studentNumber,
    email,
    firstName: studentInfo.firstName ?? '',
    lastName: studentInfo.lastName ?? '',
    phone,
  }
}

async function createSaleFromCardcomData(
  studentNumber: number,
  salesEventNumber: number,
  cardcomSaleWebhookJson: CardcomSaleWebhookJson,
  invoiceDocumentUrl: string,
  now: Date,
  sql: Sql,
  logger: FastifyBaseLogger,
): Promise<number> {
  const historyId = crypto.randomUUID()
  const dataId = crypto.randomUUID()
  const dataProductId = crypto.randomUUID()
  const dataCardcomId = crypto.randomUUID()
  const dataActiveId = crypto.randomUUID()

  logger.info({historyId, dataId, dataProductId, dataCardcomId}, 'sale-ids-generated')

  const products = extractProductsFromCardcom(cardcomSaleWebhookJson)

  logger.info({products}, 'products-extracted-from-cardcom')

  // Create sale history record and get sale number
  const saleNumberResult = await sql<{saleNumber: string}[]>`
      INSERT INTO sale_history ${sql({
        id: historyId,
        dataId,
        dataProductId,
        timestamp: now,
        operation: 'create',
        operationReason: 'Created from Cardcom sale',
        dataActiveId,
      })}
      RETURNING sale_number
    `
  const saleNumber = parseInt(saleNumberResult[0].saleNumber)

  logger.info({saleNumber}, 'sale-history-generated')

  const saleTimestamp = new Date(
    `${cardcomSaleWebhookJson.DealDate} ${cardcomSaleWebhookJson.DealTime}`,
  )

  const finalSaleRevenue = cardcomSaleWebhookJson.suminfull

  logger.info({finalSaleRevenue, saleTimestamp}, 'final-sale-revenue-calculated')

  const studentNameResult = await sql<{studentName: string}[]>`
      SELECT first_name || ' ' || last_name as student_name
      FROM student_name
      JOIN student ON student.student_number = ${studentNumber ?? 0}
      WHERE student_name.data_id = student.last_data_id
    `
  const salesEventNameResult = await sql<{salesEventName: string}[]>`
      SELECT name as sales_event_name
      FROM sales_event_data
      JOIN sales_event ON sales_event.sales_event_number = ${salesEventNumber ?? 0}
      WHERE sales_event_data.data_id = sales_event.last_data_id
    `
  const productNamesResult = await sql<{productName: string}[]>`
      SELECT name as product_name
      FROM product_data
      JOIN product ON product.product_number IN ${sql(products.map((p) => p.productId ?? 0) ?? [])}
      WHERE product_data.data_id = product.last_data_id
    `
  const studentName = studentNameResult[0]?.studentName
  const salesEventName = salesEventNameResult[0]?.salesEventName

  logger.info({salesEventName, studentName}, 'names-determined')

  let ops = [] as Promise<unknown>[]

  ops = ops.concat(sql`
      INSERT INTO sale VALUES
        (${saleNumber}, ${historyId}, ${dataId}, ${dataProductId}, ${dataCardcomId})
    `)

  ops = ops.concat(sql`
      INSERT INTO sale_data ${sql({
        dataId,
        salesEventNumber,
        studentNumber,
        timestamp: now,
        saleType: cardcomSaleWebhookJson.RecurringOrderID ? 'standing-order' : 'one-time',
      })}
    `)

  const searchableText = `${saleNumber} ${studentName ?? ''} ${salesEventName ?? ''} ${productNamesResult
    .map((p) => p.productName)
    .join(' ')}`

  ops = ops.concat(sql`
    INSERT INTO sale_data_search VALUES
        (${dataId}, ${searchableText})
    `)

  ops = ops.concat(sql`
      INSERT INTO sale_data_cardcom ${sql({
        dataCardcomId,
        responseJson: JSON.stringify(cardcomSaleWebhookJson),
        invoiceNumber: cardcomSaleWebhookJson.invoicenumber,
        coupon: cardcomSaleWebhookJson.CouponNumber ?? null,
        internalDealNumber: cardcomSaleWebhookJson.internaldealnumber,
        customerId: cardcomSaleWebhookJson.RecurringAccountID ?? null,
        invoiceDocumentUrl: invoiceDocumentUrl,
        cardcomSaleRevenue: finalSaleRevenue,
        recurringOrderId: cardcomSaleWebhookJson.RecurringOrderID ?? null,
      })}
    `)

  ops = ops.concat(
    products.map(
      (product, index) => sql`
        INSERT INTO sale_data_product VALUES
          (${dataProductId}, ${index}, ${product.productId}, ${product.quantity}, ${product.price})
      `,
    ),
  )

  if (cardcomSaleWebhookJson.DeliveryCity) {
    await sql`
      INSERT INTO sale_data_delivery ${sql({
        dataCardcomId,
        city: cardcomSaleWebhookJson.DeliveryCity ?? '',
        street: cardcomSaleWebhookJson.DeliveryStreet ?? '',
        streetNumber: cardcomSaleWebhookJson.DeliveryBuilding ?? '',
        apartmentNumber: cardcomSaleWebhookJson.DeliveryApartment ?? '',
        floor: cardcomSaleWebhookJson.DeliveryFloor ?? '',
        entrance: cardcomSaleWebhookJson.DeliveryEntrance ?? '',
        contactPhone: cardcomSaleWebhookJson.CardOwnerPhone ?? '',
        notesToDeliveryPerson: cardcomSaleWebhookJson.DeliveryNotes,
      })}`
  }

  ops = ops.concat(sql`INSERT INTO sale_data_active ${sql({dataActiveId, isActive: true})}`)

  if (cardcomSaleWebhookJson.RecurringOrderID) {
    const standOrderPaymentId = crypto.randomUUID()

    ops = ops.concat(
      sql`INSERT INTO sale_standing_order_payments ${sql({
        id: standOrderPaymentId,
        saleNumber,
        saleDataId: dataId,
        timestamp: saleTimestamp,
        paymentRevenue: finalSaleRevenue,
        resolution: 'payed',
        isFirstPayment: true,
      })}`,
    )

    ops = ops.concat(
      sql`INSERT INTO sale_standing_order_cardcom_recurring_payment ${sql({
        saleStandingOrderPaymentId: standOrderPaymentId,
        status: 'SUCCESSFUL',
        invoiceDocumentNumber: cardcomSaleWebhookJson.invoicenumber,
        internalDealNumber: cardcomSaleWebhookJson.internaldealnumber,
      })}`,
    )
  }

  logger.info('executing-sale-creation-operations')
  await Promise.all(ops)
  logger.info('executed-sale-creation-operations')

  return saleNumber
}

async function createNoInvoiceSale(
  studentNumber: number,
  salesEventNumber: number,
  now: Date,
  sql: Sql,
  logger: FastifyBaseLogger,
): Promise<number> {
  const historyId = crypto.randomUUID()
  const dataId = crypto.randomUUID()
  const dataProductId = crypto.randomUUID()
  const dataNoInvoiceId = crypto.randomUUID()
  const dataActiveId = crypto.randomUUID()

  logger.info(
    {historyId, dataId, dataProductId, dataNoInvoiceId, dataActiveId},
    'sale-ids-generated',
  )

  // Create sale history record and get sale number
  const saleNumberResult = await sql<{saleNumber: string}[]>`
      INSERT INTO sale_history ${sql({
        id: historyId,
        dataId,
        dataProductId,
        timestamp: now,
        operation: 'create',
        operationReason: 'Created from "No Invoice" sale',
        dataActiveId,
      })}
      RETURNING sale_number
    `
  const saleNumber = parseInt(saleNumberResult[0].saleNumber)

  logger.info({saleNumber}, 'sale-history-generated')

  const saleTimestamp = now
  const finalSaleRevenue = 0

  logger.info({finalSaleRevenue, saleTimestamp}, 'final-sale-revenue-calculated')

  const studentNameResult = await sql<{studentName: string}[]>`
      SELECT first_name || ' ' || last_name as student_name
      FROM student_name
      JOIN student ON student.student_number = ${studentNumber ?? 0}
      WHERE student_name.data_id = student.last_data_id
    `
  const salesEventNameResult = await sql<{salesEventName: string}[]>`
      SELECT name as sales_event_name
      FROM sales_event_data
      JOIN sales_event ON sales_event.sales_event_number = ${salesEventNumber ?? 0}
      WHERE sales_event_data.data_id = sales_event.last_data_id
    `
  const studentName = studentNameResult[0]?.studentName
  const salesEventName = salesEventNameResult[0]?.salesEventName

  logger.info({salesEventName, studentName}, 'names-determined')

  let ops = [] as Promise<unknown>[]

  ops = ops.concat(sql`
    INSERT INTO sale ${sql({
      saleNumber,
      lastHistoryId: historyId,
      lastDataId: dataId,
      lastDataProductId: dataProductId,
      dataNoInvoiceId,
    })}
  `)

  ops = ops.concat(sql`
      INSERT INTO sale_data ${sql({
        dataId,
        salesEventNumber,
        studentNumber,
        timestamp: now,
        saleType: 'one-time',
      })}
    `)

  ops = ops.concat(sql`
      INSERT INTO sale_data_no_invoice ${sql({
        dataNoInvoiceId,
        saleRevenue: finalSaleRevenue,
      })}
  `)

  ops = ops.concat(sql`
    INSERT INTO sale_data_product (data_product_id, item_order, product_number, quantity, unit_price)
    SELECT
      ${dataProductId},
      sepfs.item_order,
      sepfs.product_number,
      1,
      0
    FROM sales_event_product_for_sale sepfs
    JOIN sales_event se ON se.sales_event_number = ${salesEventNumber}
    WHERE sepfs.data_id = se.last_data_id
  `)

  const searchableText = `${saleNumber} ${studentName ?? ''} ${salesEventName ?? ''}`

  ops = ops.concat(sql`
    INSERT INTO sale_data_search VALUES
        (${dataId}, ${searchableText})
    `)

  ops = ops.concat(sql`INSERT INTO sale_data_active ${sql({dataActiveId, isActive: true})}`)
  logger.info('executing-sale-creation-operations')
  await Promise.all(ops)
  logger.info('executed-sale-creation-operations')

  return saleNumber
}

function extractProductsFromCardcom(cardcomSaleWebhookJson: CardcomSaleWebhookJson) {
  const products = []

  products.push({
    productId: cardcomSaleWebhookJson.ProductID,
    quantity: cardcomSaleWebhookJson.ProdQuantity,
    price: cardcomSaleWebhookJson.ProdPrice,
  })

  for (let i = 1; i <= parseInt(cardcomSaleWebhookJson.ProdTotalLines); i++) {
    const productIdKey = `ProductID${i}` as keyof CardcomSaleWebhookJson
    const quantityKey = `ProdQuantity${i}` as keyof CardcomSaleWebhookJson
    const priceKey = `ProdPrice${i}` as keyof CardcomSaleWebhookJson

    const productId = cardcomSaleWebhookJson[productIdKey] as string
    const quantity = cardcomSaleWebhookJson[quantityKey] as string
    const price = cardcomSaleWebhookJson[priceKey] as string

    if (productId && quantity && price) {
      products.push({
        productId: productId,
        quantity: quantity,
        price: price,
      })
    }
  }

  return products
}
function generateStudentInfoFromCardcomSale(
  cardcomSaleWebhookJson: CardcomSaleWebhookJson,
): StudentInfoForASale {
  const cardcomSaleName = cardcomSaleWebhookJson.intTo || cardcomSaleWebhookJson.CardOwnerName
  const nameParts = cardcomSaleName.trim().split(/\s+/)

  const firstName = nameParts[0]
  const lastName = nameParts.slice(1).join(' ')

  return {
    firstName,
    lastName,
    email: cardcomSaleWebhookJson.UserEmail,
    phone: cardcomSaleWebhookJson.CardOwnerPhone,
    cellPhone: undefined,
  }
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
    const sale = await querySaleForConnectingSale(saleNumber, sql)

    if (sale === undefined) throw makeError(`Sale ${saleNumber} does not exist`, {httpStatus: 404})

    logger.info({invoiceUrl: sale.cardcomInvoiceDocumentUrl}, 'connect-sale-succeeded')

    const [smooveConnectionResult, academyConnectionResult] = await Promise.allSettled([
      subscribeStudentInSmooveLists(
        parseInt(sale.studentNumber),
        saleNumber,
        smooveIntegration,
        sql,
        logger,
      ),
      connectStudentWithAcademyCourses(
        saleNumber,
        {
          email: sale.studentEmail,
          name: sale.studentFirstName + ' ' + sale.studentLastName,
          phone: sale.studentPhone ?? '',
        },
        academyIntegration,
        sql,
        logger,
      ),
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
      logger.error(
        {err: smooveConnectionResult.reason},
        'subscribing-student-to-smoove-lists-failed',
      )
    } else {
      logger.info('subscribing-student-to-smoove-lists-succeeded')
    }

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
      logger.info(
        {
          cardcomInvoiceNumber: sale.cardcomInvoiceNumber,
          invoiceDocumentUrl: sale.cardcomInvoiceDocumentUrl,
          cardcomCustomerId: sale.cardcomCustomerId,
        },
        'sale-already-connected-no-action-needed-creating-sale-data-manual-record',
      )
      await sql`
        INSERT INTO sale_data_cardcom_manual ${sql({
          dataManualId,
          cardcomInvoiceNumber: sale.cardcomInvoiceNumber,
          invoiceDocumentUrl: sale.cardcomInvoiceDocumentUrl,
          cardcomCustomerId: sale.cardcomCustomerId,
          cardcomSaleRevenue: parseFloat(sale.finalSaleRevenue ?? '0'),
        })}
      `
      logger.info('sale-already-connected-no-action-needed')
    }

    await sql`INSERT INTO sale_data_active ${sql({dataActiveId, isActive: true})}`

    const dataIdResult = await sql<object[]>`
      INSERT INTO sale_history (id, data_id, data_product_id, data_active_id, data_manual_id, sale_number, timestamp, operation, operation_reason)
      SELECT
        ${historyId},
        sale.last_data_id as last_data_id,
        sale.last_data_product_id as last_data_product_id,
        ${dataActiveId} as data_active_id,
        ${dataManualId},
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

export async function refundSale(
  saleNumber: number,
  now: Date,
  sql: Sql,
  cardcomIntegration: CardcomIntegrationService,
  loggerParent: FastifyBaseLogger,
) {
  const logger = loggerParent.child({
    saleNumber,
    jobId: crypto.randomUUID(),
    job: 'refund-sale',
  })
  logger.info('refund-sale-started')

  return await sql.begin(async (sql) => {
    const historyId = crypto.randomUUID()
    const dataActiveId = crypto.randomUUID()
    const sale = await querySaleForRefund(saleNumber, sql)

    if (sale === undefined) throw makeError(`Sale ${saleNumber} does not exist`, {httpStatus: 404})

    if (!sale.isActive)
      throw new Error(
        `Sale ${saleNumber} is already refunded or was never active: ${sale.isActive}`,
      )

    if (sale.dataCardcomId) {
      // Can only refund cardcom sales that are not manual because I cannot get the transaction id from  manual sales
      const {refundTransactionId} = await cardcomIntegration.refundTransaction(
        sale.internalDealNumber,
      )
      logger.info({refundTransactionId}, 'cardcom-transaction-refunded')
      const result = await sql`
        UPDATE sale_data_cardcom SET
          refund_transaction_id = ${refundTransactionId}
        WHERE data_cardcom_id = ${sale.dataCardcomId}
      `

      if (result.count !== 1)
        throw new Error(
          `Failed to update refund transaction ID for sale ${saleNumber}. length: ${result.count}`,
        )

      logger.info({result}, 'sale-data-cardcom-updated-with-refund-transaction-id')
    }

    const dataIdResult = await sql`
      INSERT INTO sale_history (id, data_id, data_product_id, data_manual_id, data_active_id, sale_number, timestamp, operation, operation_reason)
      SELECT
        ${historyId},
        sale_history.data_id,
        sale_history.data_product_id,
        sale_history.data_manual_id,
        ${dataActiveId} as data_active_id,
        sale_history.sale_number,
        ${now},
        'refund-sale',
        'manual refund of sale'
      FROM sale_history
      INNER JOIN sale ON sale.sale_number = ${saleNumber}
      WHERE id = sale.last_history_id
      RETURNING 1
    `

    if (dataIdResult.length !== 1)
      throw new Error(`Zero or more than one sale with ID ${saleNumber}`)

    logger.info({historyId, dataActiveId}, 'sale-history-record-created')

    logger.info('refund-sale-completed')
  })
}

async function querySaleForRefund(saleNumber: number, sql: Sql) {
  const result = (await sql`
    SELECT
      sale_data_active.is_active AS is_active,
      sale_data_cardcom.internal_deal_number AS internal_deal_number,
      sale.data_cardcom_id AS data_cardcom_id
    FROM
      sale
    JOIN sale_history ON sale_history.id = sale.last_history_id
    LEFT JOIN sale_data_active ON sale_data_active.data_active_id = sale_history.data_active_id
    LEFT JOIN sale_data_cardcom ON sale_data_cardcom.data_cardcom_id = sale.data_cardcom_id
    WHERE
      sale.sale_number = ${saleNumber}
  `) as {
    isActive: boolean
    internalDealNumber: string
    dataCardcomId: string | null
  }[]

  if (result.length === 0) return undefined

  if (result.length > 1) {
    throw new Error(`found more than one ${saleNumber} sale`)
  }

  return result[0]
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

async function hasSaleWithInvoiceNumber(
  invoicenumber: string,
  sql: Sql,
  logger: FastifyBaseLogger,
): Promise<boolean> {
  logger.info({invoicenumber}, 'checking-if-sale-with-invoice-number-exists')
  const result = await sql<{count: string}[]>`
    SELECT 1 FROM sale_data_cardcom WHERE invoice_number = ${invoicenumber} LIMIT 1
  `
  logger.info(
    {exists: result.length > 0, invoicenumber},
    'sale-with-invoice-number-existence-checked',
  )

  return result.length > 0
}
async function hasSaleWithStudent(
  studentNumber: number,
  salesEventNumber: number,
  sql: TransactionSql,
): Promise<boolean> {
  const result = await sql<{count: string}[]>`
    SELECT 1
    FROM sale
    JOIN sale_history ON sale_history.id = sale.last_history_id
    JOIN sale_data ON sale_data.data_id = sale_history.data_id
    WHERE sale_data.student_number = ${studentNumber}
      AND sale_data.sales_event_number = ${salesEventNumber}
    LIMIT 1
  `

  return result.length > 0
}
