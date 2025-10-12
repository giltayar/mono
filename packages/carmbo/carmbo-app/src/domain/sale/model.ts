import type {Sql} from 'postgres'
import z from 'zod'
import {HistoryOperationEnumSchema, type HistoryOperation} from '../../commons/operation-type.ts'
import type {PendingQuery, Row} from 'postgres'
import {sqlTextSearch} from '../../commons/sql-commons.ts'
import {assert} from 'node:console'

export const SaleSchema = z.object({
  saleNumber: z.coerce.number().int().positive(),
  timestamp: z.date(),
  saleEventNumber: z.coerce.number().int().positive(),
  salesEventName: z.string(),
  studentNumber: z.coerce.number().int().positive(),
  studentName: z.string(),
  finalSaleRevenue: z.coerce.number().positive().optional(),
  products: z
    .array(
      z.object({
        productNumber: z.coerce.number().int().positive(),
        productName: z.string(),
        quantity: z.coerce.number().int().nonnegative(),
        unitPrice: z.coerce.number().positive(),
      }),
    )
    .optional(),
  cardcomInvoiceNumber: z.string().optional(),
})

export const NewSaleSchema = SaleSchema.omit({saleNumber: true})

export const SaleWithHistoryInfoSchema = SaleSchema.extend({
  id: z.uuid(),
  historyOperation: HistoryOperationEnumSchema,
})

export type Sale = z.infer<typeof SaleSchema>
export type NewSale = z.infer<typeof NewSaleSchema>
export type SaleWithHistoryInfo = z.infer<typeof SaleWithHistoryInfoSchema>

export interface SaleForGrid {
  saleNumber: number
  timestamp: Date
  saleEventNumber: number
  saleEventName: string
  studentNumber: number
  studentName: string
  finalSaleRevenue?: number
  products: string[]
}

export interface SaleHistory {
  historyId: string
  operation: HistoryOperation
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
      sale_info.timestamp AS timestamp,
      sale_info.sale_event_number AS sale_event_number,
      sales_event_data.name AS sale_event_name,
      sale_info.student_number AS student_number,
      CONCAT(student_name.first_name, ' ', student_name.last_name) AS student_name,
      sale_info.final_sale_revenue AS final_sale_revenue,
      COALESCE(products, json_build_array()) AS products
    FROM
      sale_history
      INNER JOIN sale ON last_history_id = id
      LEFT JOIN sale_info_search ON sale_info_search.sale_number = sale.sale_number
      LEFT JOIN sale_info ON sale_info.sale_number = sale.sale_number
      LEFT JOIN sales_event ON sales_event.sales_event_number = sale_info.sale_event_number
      LEFT JOIN sales_event_data ON sales_event_data.data_id = sales_event.last_data_id
      LEFT JOIN student ON student.student_number = sale_info.student_number
      LEFT JOIN student_name ON student_name.data_id = student.last_data_id AND student_name.item_order = 0
      LEFT JOIN LATERAL (
        SELECT
          json_agg(product_data.name ORDER BY item_order) AS products
        FROM
          sale_info_product
          INNER JOIN product ON product.product_number = sale_info_product.product_number
          INNER JOIN product_data ON product_data.data_id = product.last_data_id
        WHERE
          sale_info_product.sale_number = sale.sale_number
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

function saleSelect(saleNumber: number, sql: Sql) {
  return sql<SaleWithHistoryInfo[]>`
    SELECT
      current_history_id as id,
      sale_history.operation as history_operation,
      sale_info.timestamp AS timestamp,
      ${saleNumber} as sale_number,
      sale_info.sale_event_number AS sale_event_number,
      sales_event_data.name AS sales_event_name,
      sale_info.student_number AS student_number,
      CONCAT(student_name.first_name, ' ', student_name.last_name) AS student_name,
      sale_info.final_sale_revenue AS final_sale_revenue,
      sale_info_cardcom.invoice_number AS cardcom_invoice_number,
      COALESCE(products, json_build_array()) AS products
    FROM
      parameters
      LEFT JOIN sale_history ON sale_history.id = current_history_id
      LEFT JOIN sale_info ON sale_info.sale_number = ${saleNumber}
      LEFT JOIN sales_event ON sales_event.sales_event_number = sale_info.sale_event_number
      LEFT JOIN sales_event_data ON sales_event_data.data_id = sales_event.last_data_id
      LEFT JOIN student ON student.student_number = sale_info.student_number
      LEFT JOIN student_name ON student_name.data_id = student.last_data_id AND student_name.item_order = 0
      LEFT JOIN sale_info_cardcom ON sale_info_cardcom.sale_number = ${saleNumber}
      LEFT JOIN LATERAL (
        SELECT
          json_agg(
            json_build_object(
              'productNumber', sale_info_product.product_number,
              'productName', product_data.name,
              'quantity', sale_info_product.quantity,
              'unitPrice', sale_info_product.unit_price
            )
            ORDER BY
              item_order
          ) AS products
        FROM
          sale_info_product
          INNER JOIN product ON product.product_number = sale_info_product.product_number
          INNER JOIN product_data ON product_data.data_id = product.last_data_id
        WHERE
          sale_info_product.sale_number = ${saleNumber}
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
