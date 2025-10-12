import type {AcademyIntegrationService} from '@giltayar/carmel-tools-academy-integration/service'
import type {SmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/service'
import {makeError} from '@giltayar/functional-commons'
import type {Sql} from 'postgres'
import {presult, unwrapPresult} from '@giltayar/promise-commons'
import retry from 'p-retry'
import z from 'zod'
import {normalizeEmail} from '../../commons/email.ts'
import {normalizePhoneNumber} from '../../commons/phone.ts'

export const CardcomSaleWebhookJsonSchema = z.object({
  ApprovelNumber: z.string(),
  CardOwnerName: z.string(),
  CardOwnerPhone: z.string(),
  CouponNumber: z.string().optional(),
  DealDate: z.string(),
  DealTime: z.string(),
  internaldealnumber: z.string(),
  invoicenumber: z.string(),
  terminalnumber: z.string(),
  responsecode: z.string(),
  UserEmail: z.email(),

  suminfull: z.string(),

  ProdTotalLines: z.string(),

  ProdPrice: z.string(),
  ProdQuantity: z.string(),
  ProductID: z.string(),

  ProdPrice1: z.string().optional(),
  ProdQuantity1: z.string().optional(),
  ProductID1: z.string().optional(),

  ProdPrice2: z.string().optional(),
  ProdQuantity2: z.string().optional(),
  ProductID2: z.string().optional(),

  ProdPrice3: z.string().optional(),
  ProdQuantity3: z.string().optional(),
  ProductID3: z.string().optional(),

  ProdPrice4: z.string().optional(),
  ProdQuantity4: z.string().optional(),
  ProductID4: z.string().optional(),

  ProdPrice5: z.string().optional(),
  ProdQuantity5: z.string().optional(),
  ProductID5: z.string().optional(),

  ProdPrice6: z.string().optional(),
  ProdQuantity6: z.string().optional(),
  ProductID6: z.string().optional(),

  ProdPrice7: z.string().optional(),
  ProdQuantity7: z.string().optional(),
  ProductID7: z.string().optional(),
})

export type CardcomSaleWebhookJson = z.infer<typeof CardcomSaleWebhookJsonSchema>

export async function handleCardcomOneTimeSale(
  salesEventNumber: number,
  cardcomSaleWebhookJson: CardcomSaleWebhookJson,
  now: Date,
  academyIntegration: AcademyIntegrationService,
  smooveIntegration: SmooveIntegrationService,
  sql: Sql,
) {
  const student = await sql.begin(async (sql) => {
    const hasSalesEvent = await doesSalesEventExist(salesEventNumber, sql)
    if (!hasSalesEvent) {
      throw makeError(`Sales event not found: ${salesEventNumber}`, {httpStatus: 400})
    }

    const student = await findStudent(
      cardcomSaleWebhookJson.UserEmail,
      cardcomSaleWebhookJson.CardOwnerPhone,
      sql,
    )
    const finalStudent =
      student ??
      (await createStudentFromCardcomSale(cardcomSaleWebhookJson, now, smooveIntegration, sql))

    await createSale(finalStudent.studentNumber, salesEventNumber, cardcomSaleWebhookJson, now, sql)

    return finalStudent
  })

  const academyConnectionP = connectStudentWithAcademyCourses(
    salesEventNumber,
    {
      email: student.email,
      name: student.firstName + ' ' + student.lastName,
      phone: student.phone,
    },
    academyIntegration,
    sql,
  )
  const smooveConnectionP = subscribeStudentToSmooveLists(
    student.studentNumber,
    salesEventNumber,
    smooveIntegration,
    sql,
  )

  await Promise.all([academyConnectionP, smooveConnectionP])
}

async function doesSalesEventExist(salesEventNumber: number, sql: Sql): Promise<boolean> {
  const result =
    await sql`SELECT 1 FROM sales_event WHERE sales_event_number = ${salesEventNumber} LIMIT 1`

  return result.length > 0
}

async function findStudent(
  email: string,
  phone: string,
  sql: Sql,
): Promise<
  | {
      studentNumber: number
      email: string
      firstName: string
      lastName: string
      phone: string
    }
  | undefined
> {
  const finalEmail = normalizeEmail(email)
  const finalPhone = normalizePhoneNumber(phone)

  const result = await sql<
    {
      studentNumber: number
      email: string
      firstName: string
      lastName: string
      phone: string
    }[]
  >`
    SELECT DISTINCT
      s.student_number,
      se.email,
      sn.first_name,
      sn.last_name,
      sp.phone
    FROM student s
    INNER JOIN student_email se ON se.data_id = s.last_data_id AND se.item_order = 0
    INNER JOIN student_name sn ON sn.data_id = s.last_data_id AND sn.item_order = 0
    INNER JOIN student_phone sp ON sp.data_id = s.last_data_id AND sp.item_order = 0
    WHERE s.last_data_id IN (
      SELECT se2.data_id FROM student_email se2 WHERE se2.email = ${finalEmail}
      UNION
      SELECT sp2.data_id FROM student_phone sp2 WHERE sp2.phone = ${finalPhone}
    )
    LIMIT 1
  `

  if (result.length === 0) {
    return undefined
  }

  return result[0]
}

async function createStudentFromCardcomSale(
  cardcomSaleWebhookJson: CardcomSaleWebhookJson,
  now: Date,
  smooveIntegration: SmooveIntegrationService,
  sql: Sql,
): Promise<{
  studentNumber: number
  email: string
  firstName: string
  lastName: string
  phone: string
}> {
  const email = normalizeEmail(cardcomSaleWebhookJson.UserEmail)
  const phone = normalizePhoneNumber(cardcomSaleWebhookJson.CardOwnerPhone)

  return await sql.begin(async (sql) => {
    const historyId = crypto.randomUUID()
    const dataId = crypto.randomUUID()
    const {firstName, lastName} = generateNameFromCardcomSale(cardcomSaleWebhookJson)

    const smoovePresult = presult(
      smooveIntegration.createSmooveContact({
        email,
        telephone: phone,
        firstName,
        lastName,
        birthday: undefined,
      }),
    )

    // Create student history record and get student number
    const studentNumberResult = await sql<{student_number: number}[]>`
      INSERT INTO student_history VALUES
        (${historyId}, ${dataId}, DEFAULT, ${now}, 'create', 'Created from Cardcom sale')
      RETURNING student_number
    `
    const studentNumber = studentNumberResult[0].student_number
    let ops = [] as Promise<unknown>[]

    ops = ops.concat(sql`
      INSERT INTO student VALUES
        (${studentNumber}, ${historyId}, ${dataId})
    `)

    ops = ops.concat(sql`
      INSERT INTO student_name VALUES
        (${dataId}, 0, ${firstName}, ${lastName})
    `)

    ops = ops.concat(sql`
      INSERT INTO student_email VALUES
        (${dataId}, 0, ${email})
    `)

    ops = ops.concat(sql`
      INSERT INTO student_phone VALUES
        (${dataId}, 0, ${phone})
    `)

    const searchableText = `${studentNumber} ${firstName} ${lastName} ${email} ${phone}`.trim()
    ops = ops.concat(sql`
      INSERT INTO student_search VALUES
        (${dataId}, ${searchableText})
    `)

    await Promise.all(ops)
    await unwrapPresult(smoovePresult)

    return {studentNumber, email, firstName, lastName, phone}
  })
}

async function createSale(
  studentNumber: number,
  saleEventNumber: number,
  cardcomSaleWebhookJson: CardcomSaleWebhookJson,
  now: Date,
  sql: Sql,
): Promise<number> {
  const historyId = crypto.randomUUID()
  const dataId = crypto.randomUUID()

  // Create sale history record and get sale number
  const saleNumberResult = await sql<{saleNumber: string}[]>`
      INSERT INTO sale_history VALUES
        (${historyId}, ${dataId}, DEFAULT, ${now}, 'create', 'Created from Cardcom sale')
      RETURNING sale_number
    `
  const saleNumber = parseInt(saleNumberResult[0].saleNumber)

  const saleTimestamp = new Date(
    `${cardcomSaleWebhookJson.DealDate} ${cardcomSaleWebhookJson.DealTime}`,
  )

  const finalSaleRevenue = cardcomSaleWebhookJson.suminfull

  let ops = [] as Promise<unknown>[]

  ops = ops.concat(sql`
      INSERT INTO sale VALUES
        (${saleNumber}, ${historyId}, ${dataId})
    `)

  ops = ops.concat(sql`
      INSERT INTO sale_info VALUES
        (${saleNumber}, ${saleEventNumber}, ${studentNumber}, ${now}, ${finalSaleRevenue})
    `)

  ops = ops.concat(sql`
      INSERT INTO sale_info_cardcom VALUES
        (${saleNumber}, ${JSON.stringify(cardcomSaleWebhookJson)}, ${cardcomSaleWebhookJson.invoicenumber},
         ${cardcomSaleWebhookJson.terminalnumber}, ${cardcomSaleWebhookJson.ApprovelNumber},
         ${saleTimestamp}, ${cardcomSaleWebhookJson.UserEmail}, ${cardcomSaleWebhookJson.CouponNumber ?? null})
    `)

  const products = extractProductsFromCardcom(cardcomSaleWebhookJson)
  ops = ops.concat(
    products.map(
      (product, index) => sql`
        INSERT INTO sale_info_product VALUES
          (${saleNumber}, ${index}, ${product.productId}, ${product.quantity}, ${product.price})
      `,
    ),
  )

  const searchableText =
    `${saleNumber} ${cardcomSaleWebhookJson.CardOwnerName} ${normalizeEmail(cardcomSaleWebhookJson.UserEmail)} ${cardcomSaleWebhookJson.invoicenumber}`.trim()
  ops = ops.concat(sql`
      INSERT INTO sale_info_search VALUES
        (${saleNumber}, ${searchableText})
    `)

  await Promise.all(ops)

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

    const productId = cardcomSaleWebhookJson[productIdKey]
    const quantity = cardcomSaleWebhookJson[quantityKey]
    const price = cardcomSaleWebhookJson[priceKey]

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
function generateNameFromCardcomSale(cardcomSaleWebhookJson: CardcomSaleWebhookJson) {
  const nameParts = cardcomSaleWebhookJson.CardOwnerName.trim().split(/\s+/, 2)

  const firstName = nameParts[0]
  const lastName = nameParts[1] ?? '?'

  return {firstName, lastName}
}

async function connectStudentWithAcademyCourses(
  saleEventNumber: number,
  student: {email: string; name: string; phone: string},
  academyIntegration: AcademyIntegrationService,
  sql: Sql,
): Promise<void> {
  // Get student info and all academy courses for products in the sale's sales event
  const courses = await sql<{courseId: string}[]>`
    SELECT DISTINCT
      pac.workshop_id as course_id
    FROM sales_event sev
    INNER JOIN sales_event_product_for_sale sepfs ON sepfs.data_id = sev.last_data_id
    INNER JOIN product p ON p.product_number = sepfs.product_number
    INNER JOIN product_academy_course pac ON pac.data_id = p.last_data_id
    WHERE sev.sales_event_number = ${saleEventNumber}
    ORDER BY pac.workshop_id
  `

  await Promise.all(
    courses.map(({courseId}) =>
      retry(() => academyIntegration.addStudentToCourse(student, parseInt(courseId)), {
        retries: 5,
        minTimeout: 1000,
        maxTimeout: 5000,
      }),
    ),
  )
}

async function subscribeStudentToSmooveLists(
  studentNumber: number,
  salesEventNumber: number,
  smooveIntegration: SmooveIntegrationService,
  sql: Sql,
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
      pis.cancelling_list_id as cancellingListId,
      pis.cancelled_list_id as cancelledListId,
      pis.removed_list_id as removedListId
    FROM sales_event sev
    INNER JOIN sales_event_product_for_sale sepfs ON sepfs.data_id = sev.last_data_id
    INNER JOIN product p ON p.product_number = sepfs.product_number
    INNER JOIN product_integration_smoove pis ON pis.data_id = p.last_data_id
    WHERE sev.sales_event_number = ${salesEventNumber};
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
    return
  }

  for (const smooveProductLists of smooveProductsLists) {
    await smooveIntegration.changeContactLinkedLists(parseInt(smooveContactId), {
      subscribeTo: [parseInt(smooveProductLists.listId)],
      unsubscribeFrom: [
        parseInt(smooveProductLists.cancellingListId),
        parseInt(smooveProductLists.cancelledListId),
        parseInt(smooveProductLists.removedListId),
      ],
    })
  }
}
