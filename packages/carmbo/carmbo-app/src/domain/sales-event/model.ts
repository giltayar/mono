import type {PendingQuery, Row, Sql} from 'postgres'
import {HistoryOperationEnumSchema, type HistoryOperation} from '../../commons/operation-type.ts'
import {assert} from 'node:console'
import {z} from 'zod'
import {sqlTextSearch} from '../../commons/sql-commons.ts'

export const SalesEventSchema = z.object({
  salesEventNumber: z.coerce.number().int().positive(),
  name: z.string().min(1),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  landingPageUrl: z.url().optional(),
  productsForSale: z.array(z.coerce.number().int().positive().optional()).optional(),
})

export const NewSalesEventSchema = SalesEventSchema.omit({salesEventNumber: true})

export const SalesEventWithHistoryInfoSchema = SalesEventSchema.extend({
  id: z.uuid(),
  historyOperation: HistoryOperationEnumSchema,
})

export type SalesEvent = z.infer<typeof SalesEventSchema>
export type NewSalesEvent = z.infer<typeof NewSalesEventSchema>
export type SalesEventWithHistoryInfo = z.infer<typeof SalesEventWithHistoryInfoSchema>

export interface SalesEventForGrid {
  salesEventNumber: number
  name: string
  fromDate?: Date
  toDate?: Date
  productsForSale: {id: number; name: string}[]
}

export interface SalesEventHistory {
  historyId: string
  operation: HistoryOperation
  timestamp: Date
}

export async function listSalesEvents(
  sql: Sql,
  {
    withArchived,
    query,
    limit,
    page,
  }: {withArchived: boolean; query: string; limit: number; page: number},
): Promise<SalesEventForGrid[]> {
  const filters: PendingQuery<Row[]>[] = [sql`true`]

  if (!withArchived) {
    filters.push(sql`operation <> 'delete'`)
  }

  if (query) {
    filters.push(sql`searchable_text ${sql`${sqlTextSearch(query, sql)}`} || '%'`)
  }

  return await sql<SalesEventForGrid[]>`
    SELECT
      sales_event.sales_event_number AS sales_event_number,
      sales_event_data.name AS name,
      from_date,
      to_date,
      COALESCE(products_for_sale, json_build_array()) AS products_for_sale
    FROM
      sales_event_history
      INNER JOIN sales_event ON last_history_id = id
      LEFT JOIN sales_event_search USING (data_id)
      LEFT JOIN sales_event_data USING (data_id)
      LEFT JOIN LATERAL (
        SELECT
          json_agg(product_number ORDER BY item_order) AS products_for_sale
        FROM
          sales_event_product_for_sale
        WHERE
          sales_event_product_for_sale.data_id = sales_event_history.data_id
      ) products_for_sale ON true
    ${filters.flatMap((filter, i) => (i === 0 ? [sql`WHERE`, filter] : [sql`AND`, filter]))}
    ORDER BY sales_event.sales_event_number
    LIMIT ${limit} OFFSET ${page * limit}
    `
}

export async function createSalesEvent(
  salesEvent: NewSalesEvent,
  reason: string | undefined,
  sql: Sql,
) {
  return await sql.begin(async (sql) => {
    const now = new Date()
    const historyId = crypto.randomUUID()
    const dataId = crypto.randomUUID()

    const salesEventNumberResult = await sql<{salesEventNumber: number}[]>`
      INSERT INTO sales_event_history VALUES
        (${historyId}, ${dataId}, DEFAULT, ${now}, 'create', ${reason ?? null})
      RETURNING sales_event_number
    `
    const salesEventNumber = salesEventNumberResult[0].salesEventNumber

    await sql`
      INSERT INTO sales_event VALUES
        (${salesEventNumber}, ${historyId}, ${dataId})
    `

    await addSalesEventStuff(salesEventNumber, salesEvent, dataId, sql)

    return salesEventNumber
  })
}

export async function updateSalesEvent(
  salesEvent: SalesEvent,
  reason: string | undefined,
  sql: Sql,
): Promise<number | undefined> {
  return await sql.begin(async (sql) => {
    const now = new Date()
    const historyId = crypto.randomUUID()
    const dataId = crypto.randomUUID()

    await sql`
      INSERT INTO sales_event_history VALUES
        (${historyId}, ${dataId}, ${salesEvent.salesEventNumber}, ${now}, 'update', ${reason ?? null})
    `
    const updateResult = await sql`
        UPDATE sales_event SET
          sales_event_number = ${salesEvent.salesEventNumber},
          last_history_id = ${historyId},
          last_data_id = ${dataId}
        WHERE sales_event_number = ${salesEvent.salesEventNumber}
        RETURNING 1
      `

    if (updateResult.length === 0) {
      return undefined
    }

    assert(
      updateResult.length === 1,
      `More than one sales event with ID ${salesEvent.salesEventNumber}`,
    )

    await addSalesEventStuff(salesEvent.salesEventNumber, salesEvent, dataId, sql)

    return salesEvent.salesEventNumber
  })
}

export async function deleteSalesEvent(
  salesEventNumber: number,
  reason: string | undefined,
  deleteOperation: Extract<HistoryOperation, 'delete' | 'restore'>,
  sql: Sql,
): Promise<string | undefined> {
  return await sql.begin(async (sql) => {
    const now = new Date()
    const historyId = crypto.randomUUID()
    const dataIdResult = await sql<{dataId: string}[]>`
      INSERT INTO sales_event_history (id, data_id, sales_event_number, timestamp, operation, operation_reason)
      SELECT ${historyId}, sales_event.last_data_id as last_data_id, sales_event.sales_event_number, ${now}, ${deleteOperation}, ${reason ?? null}
      FROM sales_event_history
      INNER JOIN sales_event ON sales_event.sales_event_number = ${salesEventNumber}
      WHERE id = sales_event.last_history_id
      RETURNING sales_event_history.data_id as data_id
    `

    if (dataIdResult.length === 0) {
      return undefined
    }

    if (dataIdResult.length > 1) {
      throw new Error(`More than one sales event with ID ${salesEventNumber}`)
    }

    await sql`
        UPDATE sales_event SET
          sales_event_number = ${salesEventNumber},
          last_history_id = ${historyId},
          last_data_id = ${dataIdResult[0].dataId}
        WHERE sales_event_number = ${salesEventNumber}
     `

    return historyId
  })
}

export async function querySalesEventByNumber(
  salesEventNumber: number,
  sql: Sql,
): Promise<{salesEvent: SalesEventWithHistoryInfo; history: SalesEventHistory[]} | undefined> {
  const psalesEvent = sql<SalesEventWithHistoryInfo[]>`
    WITH parameters (current_data_id, current_history_id) AS (
      SELECT
        last_data_id, last_history_id
      FROM
        sales_event
      WHERE
        sales_event_number = ${salesEventNumber}
    )
    ${salesEventSelect(salesEventNumber, sql)}
  `

  const phistory = salesEventHistorySelect(salesEventNumber, sql)
  const [salesEvent, history] = await Promise.all([psalesEvent, phistory])

  if (salesEvent.length === 0) {
    return undefined
  }

  assert(salesEvent.length === 1, `More than one sales event with ID ${salesEventNumber}`)

  return {salesEvent: salesEvent[0], history}
}

export async function querySalesEventByHistoryId(
  salesEventNumber: number,
  historyId: string,
  sql: Sql,
): Promise<{salesEvent: SalesEventWithHistoryInfo; history: SalesEventHistory[]} | undefined> {
  const psalesEvent = sql<SalesEventWithHistoryInfo[]>`
    WITH parameters (current_data_id, current_history_id) AS (
      SELECT
        data_id, id
      FROM
        sales_event_history
      WHERE
        id = ${historyId}
    )
    ${salesEventSelect(salesEventNumber, sql)}
  `

  const phistory = salesEventHistorySelect(salesEventNumber, sql)

  const [salesEvent, history] = await Promise.all([psalesEvent, phistory])

  if (salesEvent.length === 0) {
    return undefined
  }

  assert(salesEvent.length === 1, `More than one sales event with ID ${salesEventNumber}`)

  return {salesEvent: salesEvent[0], history}
}

function salesEventSelect(salesEventNumber: number, sql: Sql) {
  return sql<SalesEventWithHistoryInfo[]>`
    SELECT
      current_history_id as id,
      sales_event_history.operation as history_operation,
      ${salesEventNumber} as sales_event_number,
      sales_event_data.name AS name,
      sales_event_data.from_date AS from_date,
      sales_event_data.to_date AS to_date,
      sales_event_data.landing_page_url AS landing_page_url,
      COALESCE(products_for_sale, json_build_array()) AS products_for_sale
    FROM
      parameters
      LEFT JOIN sales_event_history ON sales_event_history.id = current_history_id
      LEFT JOIN sales_event_data ON sales_event_data.data_id = current_data_id
      LEFT JOIN LATERAL (
        SELECT
          json_agg(
            sales_event_product_for_sale.product_number
            ORDER BY
              item_order
          ) AS products_for_sale
        FROM
          sales_event_product_for_sale
        JOIN product ON product.product_number = sales_event_product_for_sale.product_number
        JOIN product_data ON product_data.data_id = product.last_data_id
        WHERE
          sales_event_product_for_sale.data_id = current_data_id
      ) products_for_sale ON true
  `
}

function salesEventHistorySelect(salesEventNumber: number, sql: Sql) {
  return sql<SalesEventHistory[]>`
SELECT
  id as history_id,
  operation,
  timestamp
FROM
  sales_event_history
WHERE
  sales_event_history.sales_event_number = ${salesEventNumber}
ORDER BY
  timestamp DESC
  `
}

async function addSalesEventStuff(
  salesEventNumber: number,
  salesEvent: SalesEvent | NewSalesEvent,
  dataId: string,
  sql: Sql,
) {
  let ops = [] as Promise<unknown>[]

  ops = ops.concat(sql`
    INSERT INTO sales_event_search VALUES
      (${dataId}, ${searchableSalesEventText(salesEventNumber, salesEvent)})
  `)

  ops = ops.concat(sql`
    INSERT INTO sales_event_data VALUES
      (${dataId}, ${salesEvent.name ?? ''}, ${salesEvent.fromDate ?? null}, ${salesEvent.toDate ?? null}, ${salesEvent.landingPageUrl ?? null})
  `)

  ops = ops.concat(
    salesEvent.productsForSale
      ?.filter((product) => product !== undefined)
      .map(
        (product, index) => sql`
        INSERT INTO sales_event_product_for_sale VALUES
          (${dataId}, ${index}, ${product ?? ''})
      `,
      ) ?? [],
  )

  await Promise.all(ops)
}

function searchableSalesEventText(
  salesEventNumber: number,
  salesEvent: SalesEvent | NewSalesEvent,
): string {
  const name = salesEvent.name
  const landingPageUrl = salesEvent.landingPageUrl ?? ''
  const fromDate = salesEvent.fromDate?.toISOString() ?? ''
  const toDate = salesEvent.toDate?.toISOString() ?? ''

  return `${salesEventNumber} ${name} ${landingPageUrl} ${fromDate} ${toDate}`.trim()
}

export async function TEST_seedSalesEvents(sql: Sql, count: number, productCount: number) {
  // eslint-disable-next-line n/no-unpublished-import
  const chance = new (await import('chance')).Chance(0)

  for (const i of range(0, count)) {
    if (i % 1000 === 0) {
      console.log(`Seeding sales event ${i}`)
    }
    await createSalesEvent(
      {
        name: `${chance.word()} ${chance.word()}`,
        fromDate: chance.date(),
        toDate: chance.date(),
        landingPageUrl: chance.url(),
        productsForSale: [
          chance.integer({min: 1, max: productCount}),
          chance.integer({min: 1, max: productCount}),
        ],
      },
      chance.word(),
      sql,
    )
  }
}

export async function listProductsForChoosing(sql: Sql): Promise<{id: number; name: string}[]> {
  return await sql<{id: number; name: string}[]>`
      SELECT product.product_number as id, name
      FROM product_data
      JOIN product ON product.last_data_id = product_data.data_id
      ORDER BY product.product_number
  `
}

function range(start: number, end: number): number[] {
  return Array.from({length: end - start}, (_, i) => i + start)
}
