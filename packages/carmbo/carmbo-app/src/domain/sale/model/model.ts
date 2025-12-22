import type {Sql} from 'postgres'
import z from 'zod'
import {type HistoryOperation} from '../../../commons/operation-type.ts'
import type {PendingQuery, Row} from 'postgres'
import {sqlTextSearch} from '../../../commons/sql-commons.ts'
import assert from 'node:assert'
import {TEST_executeHook} from '../../../commons/TEST_hooks.ts'
import type {StandingOrderPaymentResolution} from './model-sale.ts'

export const SaleSchema = z.object({
  saleNumber: z.coerce.number().int().positive(),
  timestamp: z.date().optional(),
  salesEventNumber: z.coerce.number().int().positive(),
  salesEventName: z.string().optional(),
  studentNumber: z.coerce.number().int().positive(),
  studentName: z.string().optional(),
  finalSaleRevenue: z.preprocess(
    (s) => (typeof s === 'string' ? (s ? parseFloat(s) : undefined) : s),
    z.number().optional(),
  ),
  isStandingOrder: z.coerce.boolean(),
  isNoInvoiceOrder: z.coerce.boolean().default(false),
  recurringOrderId: z.string().optional(),
  products: z
    .array(
      z.object({
        productNumber: z.coerce.number().int().positive(),
        productName: z.string().optional(),
        quantity: z.coerce.number().int().nonnegative(),
        unitPrice: z.coerce.number().nonnegative(),
      }),
    )
    .optional(),
  cardcomInvoiceNumber: z.string().optional(),
  cardcomInvoiceDocumentUrl: z.url().optional(),
  cardcomRefundTransactionId: z.string().optional(),
  manualSaleType: z.enum(['manual']).optional(),
  isActive: z.coerce.boolean(),
  hasDeliveryAddress: z.stringbool().optional(),
  deliveryAddress: z
    .object({
      city: z.string().optional(),
      street: z.string().optional(),
      streetNumber: z.string().optional(),
      entrance: z.string().optional(),
      floor: z.string().optional(),
      apartmentNumber: z.string().optional(),
      contactPhone: z.string().optional(),
      notesToDeliveryPerson: z.string().optional(),
    })
    .optional(),
})

export const NewSaleSchema = z.object({
  salesEventNumber: z.coerce.number().int().optional(),
  salesEventName: z.string().optional(),
  studentNumber: z.coerce.number().int().optional(),
  studentName: z.string().optional(),
  finalSaleRevenue: z.preprocess(
    (s) => (typeof s === 'string' ? (s ? parseFloat(s) : undefined) : s),
    z.number().optional(),
  ),
  isStandingOrder: z.literal(false).optional(),
  recurringOrderId: z.string().optional(),
  products: z
    .array(
      z.object({
        productNumber: z.coerce.number().int(),
        productName: z.string().optional(),
        quantity: z.coerce.number().int(),
        unitPrice: z.coerce.number(),
      }),
    )
    .optional(),
  cardcomInvoiceNumber: z.string().optional(),
  cardcomInvoiceDocumentUrl: z.url().optional(),
  manualSaleType: z.enum(['manual']).optional(),
  hasDeliveryAddress: z.stringbool().optional(),
  deliveryAddress: z
    .object({
      city: z.string().optional(),
      street: z.string().optional(),
      streetNumber: z.string().optional(),
      entrance: z.string().optional(),
      floor: z.string().optional(),
      apartmentNumber: z.string().optional(),
      contactPhone: z.string().optional(),
      notesToDeliveryPerson: z.string().optional(),
    })
    .optional(),
})

export const SaleHistoryOperationSchema = z.enum([
  'create',
  'update',
  'delete',
  'restore',
  'connect-sale',
  'refund-sale',
  'cancel-subscription',
  'removed-from-subscription',
  'disconnected-manually',
])

export type SaleHistoryOperation = z.infer<typeof SaleHistoryOperationSchema>

export const SaleWithHistoryInfoSchema = SaleSchema.extend({
  id: z.uuid(),
  historyOperation: SaleHistoryOperationSchema,
})

export type Sale = z.infer<typeof SaleSchema>
export type NewSale = z.infer<typeof NewSaleSchema>
export type SaleWithHistoryInfo = z.infer<typeof SaleWithHistoryInfoSchema>

export interface SaleForGrid {
  saleNumber: number
  timestamp: Date
  salesEventNumber: number
  saleEventName: string
  studentNumber: number
  studentName: string
  finalSaleRevenue?: number
  products: string[]
}

export interface SaleHistory {
  historyId: string
  operation: SaleHistoryOperation
  timestamp: Date
}

export async function listSales(
  sql: Sql,
  {
    withArchived,
    query,
    limit,
    page,
  }: {withArchived: boolean; query: string; limit: number; page: number},
): Promise<SaleForGrid[]> {
  const filters: PendingQuery<Row[]>[] = [sql`true`]

  if (!withArchived) {
    filters.push(sql`operation <> 'delete'`)
  }

  if (query) {
    filters.push(sql`searchable_text ${sqlTextSearch(query, sql)}`)
  }

  return await sql<SaleForGrid[]>`
    SELECT
      sale.sale_number AS sale_number,
      sale_data.timestamp AS timestamp,
      sale_data.sales_event_number AS sales_event_number,
      sales_event_data.name AS sale_event_name,
      sale_data.student_number AS student_number,
      CONCAT(student_name.first_name, ' ', student_name.last_name) AS student_name,
      COALESCE(
        sale_data_cardcom.cardcom_sale_revenue,
        sale_data_cardcom_manual.cardcom_sale_revenue,
        sale_data_no_invoice.sale_revenue) AS final_sale_revenue,
      COALESCE(products, json_build_array()) AS products
    FROM
      sale_history
    JOIN sale ON last_history_id = id

    LEFT JOIN sale_data_search ON sale_data_search.data_id = sale.last_data_id
    LEFT JOIN sale_data ON sale_data.data_id = sale.last_data_id

    LEFT JOIN sale_data_cardcom ON sale_data_cardcom.data_cardcom_id = sale.data_cardcom_id
    LEFT JOIN sale_data_no_invoice ON sale_data_no_invoice.data_no_invoice_id = sale.data_no_invoice_id
    LEFT JOIN sale_data_cardcom_manual ON sale_data_cardcom_manual.data_manual_id = sale_history.data_manual_id

    LEFT JOIN sales_event ON sales_event.sales_event_number = sale_data.sales_event_number
    LEFT JOIN sales_event_data ON sales_event_data.data_id = sales_event.last_data_id

    LEFT JOIN student ON student.student_number = sale_data.student_number
    LEFT JOIN student_name ON student_name.data_id = student.last_data_id AND student_name.item_order = 0

    LEFT JOIN LATERAL (
      SELECT
        json_agg(product_data.name ORDER BY item_order) AS products
      FROM
        sale_data_product
        JOIN product ON product.product_number = sale_data_product.product_number
        JOIN product_data ON product_data.data_id = product.last_data_id
      WHERE
        sale_data_product.data_product_id = sale.last_data_product_id
    ) products ON true
    ${filters.flatMap((filter, i) => (i === 0 ? [sql`WHERE`, filter] : [sql`AND`, filter]))}
    ORDER BY sale.sale_number DESC
    LIMIT ${limit} OFFSET ${page * limit}
  `.then((rows) =>
    rows.map((row) => ({
      ...row,
      finalSaleRevenue: row.finalSaleRevenue ? Number(row.finalSaleRevenue) : undefined,
    })),
  )
}

export async function querySaleByNumber(
  saleNumber: number,
  sql: Sql,
): Promise<{sale: SaleWithHistoryInfo; history: SaleHistory[]} | undefined> {
  const psale = sql<SaleWithHistoryInfo[]>`
    WITH parameters (current_history_id) AS (
      SELECT
        last_history_id
      FROM
        sale
      WHERE
        sale_number = ${saleNumber}
    )
    ${saleSelect(saleNumber, sql)}
  `.then((rows) =>
    rows.map((row) => ({
      ...row,
      finalSaleRevenue: row.finalSaleRevenue ? Number(row.finalSaleRevenue) : undefined,
      products: row.products?.map((p) => ({...p, unitPrice: Number(p.unitPrice)})) ?? [],
    })),
  )

  const phistory = saleHistorySelect(saleNumber, sql)
  const [sale, history] = await Promise.all([psale, phistory])

  if (sale.length === 0) {
    return undefined
  }

  assert(sale.length === 1, `More than one sale with ID ${saleNumber}`)

  return {sale: sale[0], history}
}

export type SaleWithPayments = {
  saleNumber: number
  payments: {
    timestamp: Date
    amount: string
    resolution: StandingOrderPaymentResolution
    invoiceDocumentNumber: string
    invoiceDocumentUrl: string
    cardcomStatus: string
  }[]
}

export async function querySalePayments(
  saleNumber: number,
  sql: Sql,
): Promise<SaleWithPayments | undefined> {
  const paymentsResultp = sql<SaleWithPayments['payments']>`
    SELECT
      ssop.timestamp,
      ssop.payment_revenue AS amount,
      ssop.resolution,
      ssocrp.invoice_document_number,
      ssocrp.invoice_document_url,
      ssocrp.status AS cardcom_status
    FROM
      sale_standing_order_payments ssop
    LEFT JOIN sale_standing_order_cardcom_recurring_payment ssocrp ON ssocrp.sale_standing_order_payment_id = ssop.id
    WHERE
      ssop.sale_number = ${saleNumber}
  `

  const saleResult = await sql<{saleNumber: string}[]>`
    SELECT
      sale_number
    FROM
      sale
    WHERE
      sale_number = ${saleNumber}
  `
  const paymentsResult = await paymentsResultp

  if (saleResult.length === 0) return undefined

  return {
    saleNumber,
    payments: [...paymentsResult],
  }
}

export async function querySaleByHistoryId(
  saleNumber: number,
  historyId: string,
  sql: Sql,
): Promise<{sale: SaleWithHistoryInfo; history: SaleHistory[]} | undefined> {
  const psale = sql<SaleWithHistoryInfo[]>`
    WITH parameters (current_history_id) AS (
      SELECT
        id
      FROM
        sale_history
      WHERE
        id = ${historyId}
    )
    ${saleSelect(saleNumber, sql)}
  `.then((rows) =>
    rows.map((row) => ({
      ...row,
      finalSaleRevenue: row.finalSaleRevenue ? Number(row.finalSaleRevenue) : undefined,
      products: row.products?.map((p) => ({...p, unitPrice: Number(p.unitPrice)})) ?? [],
    })),
  )

  const phistory = saleHistorySelect(saleNumber, sql)

  const [sale, history] = await Promise.all([psale, phistory])

  if (sale.length === 0) {
    return undefined
  }

  assert(sale.length === 1, `More than one sale with ID ${saleNumber}`)

  return {sale: sale[0], history}
}

export async function searchSalesEvents(
  q: string,
  sql: Sql,
): Promise<{salesEventNumber: number; name: string}[]> {
  return await sql<{salesEventNumber: number; name: string}[]>`
 SELECT
      se.sales_event_number,
      sed.name
    FROM
      sales_event se
    LEFT JOIN sales_event_history seh on seh.id = se.last_history_id
    LEFT JOIN sales_event_data sed on sed.data_id = se.last_data_id
    LEFT JOIN sales_event_search ses on ses.data_id = se.last_data_id
    WHERE
    ses.searchable_text ${sqlTextSearch(q, sql)}
    ORDER BY
      seh.timestamp DESC
  `
}

export async function searchStudents(
  q: string,
  sql: Sql,
): Promise<{studentNumber: number; name: string}[]> {
  return await sql<{studentNumber: number; name: string}[]>`
    SELECT
      s.student_number,
      CONCAT(sn.first_name, ' ', sn.last_name) as name
    FROM
      student s
    LEFT JOIN student_history sh on sh.id = s.last_history_id
    LEFT JOIN student_name sn on sn.data_id = s.last_data_id
    LEFT JOIN student_search ss on ss.data_id = s.last_data_id
    WHERE
      ss.searchable_text ${sqlTextSearch(q, sql)}
    ORDER BY
      sh.timestamp DESC
  `
}

export async function searchProducts(
  q: string,
  sql: Sql,
): Promise<{productNumber: number; name: string}[]> {
  return await sql<{productNumber: number; name: string}[]>`
    SELECT
      p.product_number,
      pd.name
    FROM
      product p
    LEFT JOIN product_history ph on ph.id = p.last_history_id
    LEFT JOIN product_data pd on pd.data_id = p.last_data_id
    LEFT JOIN product_search ps on ps.data_id = p.last_data_id
    WHERE
      ps.searchable_text ${sqlTextSearch(q, sql)}
    ORDER BY
      ph.timestamp DESC
  `
}

export async function fillInSale(sale: NewSale, sql: Sql): Promise<NewSale> {
  const fillResult = await sql<
    {
      salesEventName: string | null
      studentFirstName: string | null
      studentLastName: string | null
      products: Array<{
        productNumber: number
        productName: string
      }> | null
    }[]
  >`
    SELECT
      sed.name AS sales_event_name,
      sn.first_name as student_first_name,
      sn.last_name as student_last_name,
      COALESCE(products_agg.products, json_build_array()) AS products
    FROM
      (VALUES (1)) AS dummy(x)
      LEFT JOIN sales_event se ON se.sales_event_number = ${sale.salesEventNumber ?? 0}
      LEFT JOIN sales_event_data sed ON sed.data_id = se.last_data_id
      LEFT JOIN student s ON s.student_number = ${sale.studentNumber ?? 0}
      LEFT JOIN student_name sn ON sn.data_id = s.last_data_id AND sn.item_order = 0
      LEFT JOIN LATERAL (
        SELECT
          json_agg(
            json_build_object(
              'productNumber', sepfs.product_number,
              'productName', pd.name
            )
          ) AS products
        FROM
          sales_event_product_for_sale sepfs
        LEFT JOIN product p ON p.product_number = sepfs.product_number
        LEFT JOIN product_data pd ON pd.data_id = p.last_data_id
        WHERE
          sepfs.data_id = se.last_data_id
      ) products_agg ON true
  `

  if (!fillResult[0]) {
    return sale
  }

  const products = mergeSaleProducts(sale.products ?? [], fillResult[0].products ?? [])

  return {
    ...sale,
    ...(sale.hasDeliveryAddress && !sale.deliveryAddress ? {deliveryAddress: {}} : undefined),
    manualSaleType: 'manual',
    salesEventName: fillResult[0].salesEventName ?? '',
    studentName: fillResult[0].studentFirstName
      ? [fillResult[0].studentFirstName, fillResult[0].studentLastName].join(' ')
      : '',
    products,
  }
}

export function saleSelect(saleNumber: number, sql: Sql) {
  return sql<SaleWithHistoryInfo[]>`
    SELECT
      current_history_id as id,
      sh.operation as history_operation,
      sale_data.timestamp AS timestamp,
      ${saleNumber} as sale_number,
      sale_data.sales_event_number AS sales_event_number,
      sales_event_data.name AS sales_event_name,
      sale_data.student_number AS student_number,
      CONCAT(student_name.first_name, ' ', student_name.last_name) AS student_name,
      COALESCE(
        sale_data_cardcom.cardcom_sale_revenue,
        sale_data_cardcom_manual.cardcom_sale_revenue,
        sale_data_no_invoice.sale_revenue
      ) AS final_sale_revenue,
      COALESCE(sale_data_cardcom.invoice_number, sale_data_cardcom_manual.cardcom_invoice_number) AS cardcom_invoice_number,
      COALESCE(sale_data_cardcom.invoice_document_url, sale_data_cardcom_manual.invoice_document_url) AS cardcom_invoice_document_url,
      COALESCE(sale_data_cardcom.refund_transaction_id, sale_data_cardcom_manual.refund_transaction_id) AS cardcom_refund_transaction_id,
      COALESCE(sale_data_active.is_active, false) AS is_active,
      CASE WHEN sale_data_cardcom_manual.cardcom_invoice_number IS NOT NULL THEN 'manual' ELSE null END AS manual_sale_type,
      CASE WHEN sale_data_cardcom.recurring_order_id IS NOT NULL THEN true ELSE false END AS is_standing_order,
      CASE WHEN sale_data_no_invoice.sale_revenue IS NOT NULL THEN true ELSE false END AS is_no_invoice_order,
      sale_data_cardcom.recurring_order_id,
      COALESCE(products, json_build_array()) AS products,
      sale_data_delivery.data_id IS NOT NULL OR sale_data_delivery.data_cardcom_id IS NOT NULL AS has_delivery_address,
      json_build_object(
        'city', sale_data_delivery.city,
        'street', sale_data_delivery.street,
        'streetNumber', sale_data_delivery.street_number,
        'entrance', sale_data_delivery.entrance,
        'floor', sale_data_delivery.floor,
        'apartmentNumber', sale_data_delivery.apartment_number,
        'contactPhone', sale_data_delivery.contact_phone,
        'notesToDeliveryPerson', sale_data_delivery.notes_to_delivery_person
      ) AS delivery_address
    FROM
      parameters
    JOIN sale_history sh ON sh.id = current_history_id
    JOIN sale s ON s.sale_number = ${saleNumber}
    JOIN sale_data ON sale_data.data_id = sh.data_id
    LEFT JOIN sales_event ON sales_event.sales_event_number = sale_data.sales_event_number
    LEFT JOIN sales_event_data ON sales_event_data.data_id = sales_event.last_data_id
    LEFT JOIN student ON student.student_number = sale_data.student_number
    LEFT JOIN student_name ON student_name.data_id = student.last_data_id AND student_name.item_order = 0
    LEFT JOIN sale_data_cardcom ON sale_data_cardcom.data_cardcom_id = s.data_cardcom_id
    LEFT JOIN sale_data_active ON sale_data_active.data_active_id = sh.data_active_id
    LEFT JOIN sale_data_no_invoice ON sale_data_no_invoice.data_no_invoice_id = s.data_no_invoice_id
    LEFT JOIN sale_data_cardcom_manual ON sale_data_cardcom_manual.data_manual_id = sh.data_manual_id
    LEFT JOIN sale_data_delivery ON
        (sale_data_delivery.data_cardcom_id IS NULL AND sale_data_delivery.data_id = sh.data_id) OR
        (sale_data_delivery.data_id IS NULL AND sale_data_delivery.data_cardcom_id = s.data_cardcom_id)
    LEFT JOIN LATERAL (
      SELECT
        json_agg(
          json_build_object(
            'productNumber', sale_data_product.product_number,
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
        sale_data_product.data_product_id = sh.data_product_id
    ) products ON true
  `
}

function saleHistorySelect(saleNumber: number, sql: Sql) {
  return sql<SaleHistory[]>`
    SELECT
      id as history_id,
      operation,
      timestamp
    FROM
      sale_history
    WHERE
      sale_history.sale_number = ${saleNumber}
    ORDER BY
      timestamp DESC
  `
}

export async function createSale(sale: NewSale, reason: string | undefined, now: Date, sql: Sql) {
  await TEST_executeHook('createSale')

  // Validate required fields
  assert(sale.salesEventNumber, 'salesEventNumber is required')
  assert(sale.studentNumber, 'studentNumber is required')

  const salesEventNumber = sale.salesEventNumber
  if (!salesEventNumber) throw new Error('sales event is required')
  const studentNumber = sale.studentNumber
  if (!studentNumber) throw new Error('student number is required')

  return await sql.begin(async (sql) => {
    const historyId = crypto.randomUUID()
    const dataId = crypto.randomUUID()
    const dataProductId = crypto.randomUUID()
    const dataManualId = crypto.randomUUID()

    const saleNumberResult = await sql<{saleNumber: number}[]>`
      INSERT INTO sale_history VALUES
        (${historyId}, ${dataId}, ${dataProductId}, DEFAULT, ${now}, 'create', ${reason ?? null}, ${dataManualId})
      RETURNING sale_number
    `

    const studentResult = await sql<{studentName: string; studentEmail: string}[]>`
      SELECT
        first_name || ' ' || last_name as student_name,
        student_email.email as student_email
      FROM student_name
      LEFT JOIN student ON student.student_number = ${sale.studentNumber ?? 0}
      LEFT JOIN student_email ON student_email.data_id = student.last_data_id
      WHERE student_name.data_id = student.last_data_id
    `
    const salesEventNameResult = await sql<{salesEventName: string}[]>`
      SELECT name as sales_event_name
      FROM sales_event_data
      LEFT JOIN sales_event ON sales_event.sales_event_number = ${sale.salesEventNumber ?? 0}
      WHERE sales_event_data.data_id = sales_event.last_data_id
    `
    const productNamesResult = await sql<{productName: string}[]>`
      SELECT name as product_name
      FROM product_data
      LEFT JOIN product ON product.product_number IN ${sql(sale.products?.map((p) => p.productNumber ?? 0) ?? [])}
      WHERE product_data.data_id = product.last_data_id
    `

    const studentName = studentResult[0]?.studentName
    const studentEmail = studentResult[0]?.studentEmail
    const salesEventName = salesEventNameResult[0]?.salesEventName

    const saleNumber = saleNumberResult[0].saleNumber

    let ops = [] as Promise<unknown>[]

    ops = ops.concat(
      sql`
      INSERT INTO sale VALUES
        (${saleNumber}, ${historyId}, ${dataId}, ${dataProductId}, NULL, ${dataManualId})
    `,
    )

    const searchableText = `${saleNumber} ${studentName ?? ''} ${studentEmail ?? ''} ${salesEventName ?? ''} ${productNamesResult
      .map((p) => p.productName)
      .join(' ')}`

    ops = ops.concat(sql`
      INSERT INTO sale_data_search VALUES
        (${dataId}, ${searchableText})
    `)

    ops = ops.concat(
      sql`
      INSERT INTO sale_data ${sql({
        dataId,
        salesEventNumber,
        studentNumber,
        timestamp: now,
        saleType: sale.isStandingOrder ? 'standing-order' : 'one-time',
      })}
    `,
    )

    ops = ops.concat(sql`
      INSERT INTO sale_data_cardcom_manual ${sql({
        dataManualId,
        cardcomInvoiceNumber: sale.cardcomInvoiceNumber ?? null,
        cardcomSaleRevenue: sale.finalSaleRevenue ?? null,
      })}
    `)

    if (sale.hasDeliveryAddress && sale.deliveryAddress) {
      const deliveryAddress = sale.deliveryAddress

      ops = ops.concat(
        sql`
          INSERT INTO sale_data_delivery ${sql({
            dataId,
            city: deliveryAddress.city,
            street: deliveryAddress.street,
            streetNumber: deliveryAddress.streetNumber,
            entrance: deliveryAddress.entrance,
            floor: deliveryAddress.floor,
            apartmentNumber: deliveryAddress.apartmentNumber,
            contactPhone: deliveryAddress.contactPhone,
            notesToDeliveryPerson: deliveryAddress.notesToDeliveryPerson,
          })}
        `,
      )
    }

    // Insert sale_data_product
    ops = ops.concat(
      sale.products?.map((product, index) => {
        assert(product.productNumber, `product ${index} productNumber is required`)
        assert(product.quantity !== undefined, `product ${index} quantity is required`)
        assert(product.unitPrice !== undefined, `product ${index} unitPrice is required`)

        const productNumber = product.productNumber
        const quantity = product.quantity
        const unitPrice = product.unitPrice

        return sql`
          INSERT INTO sale_data_product VALUES
            (${dataProductId}, ${index}, ${productNumber}, ${quantity}, ${unitPrice})
        `
      }) ?? [],
    )

    await Promise.all(ops)

    return saleNumber
  })
}

export async function updateSale(
  sale: Sale,
  reason: string | undefined,
  now: Date,
  sql: Sql,
): Promise<number | undefined> {
  await TEST_executeHook('updateSale')

  // Validate required fields
  assert(sale.salesEventNumber, 'salesEventNumber is required')
  assert(sale.studentNumber, 'studentNumber is required')

  const salesEventNumber = sale.salesEventNumber
  const studentNumber = sale.studentNumber

  return await sql.begin(async (sql) => {
    const historyId = crypto.randomUUID()
    const dataId = crypto.randomUUID()
    const dataProductId = crypto.randomUUID()
    const dataManualId = crypto.randomUUID()

    await sql`
      INSERT INTO sale_history VALUES
        (${historyId}, ${dataId}, ${dataProductId}, ${sale.saleNumber}, ${now}, 'update', ${reason ?? null}, ${dataManualId})
    `

    const updateResult = await sql`
      UPDATE sale SET
        sale_number = ${sale.saleNumber},
        last_history_id = ${historyId},
        last_data_id = ${dataId},
        last_data_product_id = ${dataProductId}
      WHERE sale_number = ${sale.saleNumber}
      RETURNING 1
    `

    if (updateResult.length === 0) {
      return undefined
    }

    assert(updateResult.length === 1, `More than one sale with ID ${sale.saleNumber}`)

    const studentNameResult = await sql<{studentName: string}[]>`
      SELECT first_name || ' ' || last_name as student_name
      FROM student_name
      LEFT JOIN student ON student.student_number = ${sale.studentNumber ?? 0}
      WHERE student_name.data_id = student.last_data_id
    `
    const salesEventNameResult = await sql<{salesEventName: string}[]>`
      SELECT name as sales_event_name
      FROM sales_event_data
      LEFT JOIN sales_event ON sales_event.sales_event_number = ${sale.salesEventNumber ?? 0}
      WHERE sales_event_data.data_id = sales_event.last_data_id
    `
    const productNamesResult = await sql<{productName: string}[]>`
      SELECT name as product_name
      FROM product_data
      LEFT JOIN product ON product.product_number IN ${sql(sale.products?.map((p) => p.productNumber ?? 0) ?? [])}
      WHERE product_data.data_id = product.last_data_id
    `
    const studentName = studentNameResult[0]?.studentName
    const salesEventName = salesEventNameResult[0]?.salesEventName

    let ops = [] as Promise<unknown>[]

    ops = ops.concat(sql`
      INSERT INTO sale_data ${sql({
        dataId,
        salesEventNumber,
        studentNumber,
        timestamp: now,
        saleType: sale.isStandingOrder ? 'standing-order' : 'one-time',
      })}
    `)

    const searchableText = `${sale.saleNumber} ${salesEventName ?? ''} ${studentName ?? ''} ${
      productNamesResult.map((p) => p.productName).join(' ') ?? ''
    }`

    ops = ops.concat(sql`
      INSERT INTO sale_data_search VALUES
        (${dataId}, ${searchableText})
    `)

    ops = ops.concat(sql`
      INSERT INTO sale_data_cardcom_manual ${sql({
        dataManualId,
        cardcomInvoiceNumber: sale.cardcomInvoiceNumber ?? null,
        cardcomSaleRevenue: sale.finalSaleRevenue ?? null,
      })}
    `)

    if (sale.hasDeliveryAddress && sale.deliveryAddress) {
      const deliveryAddress = sale.deliveryAddress

      ops = ops.concat(
        sql`
          INSERT INTO sale_data_delivery ${sql({
            dataId,
            city: deliveryAddress.city,
            street: deliveryAddress.street,
            streetNumber: deliveryAddress.streetNumber,
            entrance: deliveryAddress.entrance,
            floor: deliveryAddress.floor,
            apartmentNumber: deliveryAddress.apartmentNumber,
            contactPhone: deliveryAddress.contactPhone,
            notesToDeliveryPerson: deliveryAddress.notesToDeliveryPerson,
          })}
        `,
      )
    }

    ops = ops.concat(
      sale.products?.map((product, index) => {
        assert(product.productNumber, `product ${index} productNumber is required`)
        assert(product.quantity !== undefined, `product ${index} quantity is required`)
        assert(product.unitPrice !== undefined, `product ${index} unitPrice is required`)

        const productNumber = product.productNumber
        const quantity = product.quantity
        const unitPrice = product.unitPrice

        return sql`
          INSERT INTO sale_data_product VALUES
            (${dataProductId}, ${index}, ${productNumber}, ${quantity}, ${unitPrice})
        `
      }) ?? [],
    )

    await Promise.all(ops)

    return sale.saleNumber
  })
}

export async function deleteSale(
  saleNumber: number,
  reason: string | undefined,
  deleteOperation: Extract<HistoryOperation, 'delete' | 'restore'>,
  now: Date,
  sql: Sql,
): Promise<string | undefined> {
  await TEST_executeHook(`${deleteOperation}Sale`)

  return await sql.begin(async (sql) => {
    const historyId = crypto.randomUUID()

    const dataIdResult = await sql<object[]>`
      INSERT INTO sale_history (id, data_id, data_product_id, sale_number, timestamp, operation, operation_reason)
      SELECT ${historyId}, sale.last_data_id as last_data_id, sale.last_data_product_id as last_data_product_id, sale.sale_number, ${now}, ${deleteOperation}, ${reason ?? null}
      FROM sale_history
      INNER JOIN sale ON sale.sale_number = ${saleNumber}
      WHERE id = sale.last_history_id
      RETURNING 1
    `

    if (dataIdResult.length === 0) {
      return undefined
    }

    if (dataIdResult.length > 1) {
      throw new Error(`More than one sale with ID ${saleNumber}`)
    }

    await sql`
      UPDATE sale SET
        sale_number = ${saleNumber},
        last_history_id = ${historyId}
      WHERE sale_number = ${saleNumber}
    `

    return historyId
  })
}

export function computeFinalSaleRevenue(
  saleProducts: Sale['products'] | NewSale['products'] | undefined,
): number {
  if (!saleProducts) {
    return 0
  }

  return saleProducts.reduce(
    (total, product) => total + (product.unitPrice ?? 0) * product.quantity,
    0,
  )
}

export async function findSalesEventAndStudentByEmail(
  email: string,
  salesEventNumber: number,
  sql: Sql,
) {
  const result = (await sql`
    SELECT
      sn.first_name AS student_first_name,
      sn.last_name AS student_last_name,
      pd.name AS product_name,
      sl.sale_number AS sale_number
    FROM
      student_email se
    LEFT JOIN student_history sh ON sh.data_id = se.data_id
    LEFT JOIN student s ON s.last_history_id = sh.id
    LEFT JOIN student_name sn ON sn.data_id = se.data_id

    LEFT JOIN sale_data sd ON sd.student_number = s.student_number
    LEFT JOIN sale_history slh ON slh.data_id = sd.data_id
    LEFT JOIN sale sl ON sl.sale_number = slh.sale_number

    LEFT JOIN sale_data_product sdp ON sdp.data_product_id = slh.data_product_id AND sdp.item_order = 0

    LEFT JOIN product p ON p.product_number = sdp.product_number
    LEFT JOIN product_data pd ON pd.data_id = p.last_data_id
    WHERE
      se.email = ${email}
      AND sd.sales_event_number = ${salesEventNumber}
  `) as {
    studentFirstName: string | null
    studentLastName: string | null
    productName: string | null
    saleNumber: number | null
  }[]

  if (result.length === 0) {
    return {studentName: undefined, productName: undefined, saleNumber: undefined}
  }

  return {
    studentName: result[0].studentFirstName
      ? `${result[0].studentFirstName} ${result[0].studentLastName}`
      : undefined,
    productName: result[0].productName ?? undefined,
    saleNumber: result[0].saleNumber ?? undefined,
  }
}

function mergeSaleProducts(
  originalProducts: NewSale['products'] = [],
  filledInProducts: Array<{productNumber: number; productName: string}>,
): NewSale['products'] {
  return filledInProducts.map((p, index) => ({
    productNumber: p.productNumber,
    productName: p.productName,
    quantity: originalProducts[index]?.quantity ?? 1,
    unitPrice: originalProducts[index]?.unitPrice ?? 0,
  }))
}
