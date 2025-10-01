import type {PendingQuery, Row, Sql} from 'postgres'
import {HistoryOperationEnumSchema, type HistoryOperation} from '../commons/operation-type.ts'
import {assert} from 'node:console'
import {z} from 'zod'

const ProductTypeSchema = z.enum(['recorded', 'challenge', 'club', 'bundle'])
export type ProductType = z.infer<typeof ProductTypeSchema>

export const ProductSchema = z.object({
  productNumber: z.coerce.number().int().positive(),
  name: z.string().min(1),
  productType: ProductTypeSchema,
  academyCourses: z.array(z.coerce.number().int().positive()).optional(),
  whatsappGroups: z
    .array(
      z.object({
        id: z.string().regex(/[0-9]+\@g\.us/),
        timedMessagesGoogleSheetUrl: z.string().url(),
      }),
    )
    .optional(),
  facebookGroups: z.array(z.string().min(1)).optional(),
  smooveListId: z.coerce.number().int().positive().optional(),
  smooveCancellingListId: z.coerce.number().int().positive().optional(),
  smooveCancelledListId: z.coerce.number().int().positive().optional(),
  smooveRemovedListId: z.coerce.number().int().positive().optional(),
  cardcomProductId: z.union([z.string(), z.undefined()]),
})

export const ProductWithHistoryInfoSchema = ProductSchema.extend({
  id: z.uuid(),
  historyOperation: HistoryOperationEnumSchema,
})

export const NewProductSchema = z.object({
  name: z.string().min(1),
  productType: ProductTypeSchema.optional(),
  academyCourses: z.array(z.coerce.number().int().positive()).optional(),
  whatsappGroups: z
    .array(
      z.object({
        id: z.string().regex(/[0-9]+\@g\.us/),
        timedMessagesGoogleSheetUrl: z.string().url(),
      }),
    )
    .optional(),
  facebookGroups: z.array(z.string().min(1)).optional(),
  smooveListId: z.coerce.number().int().positive().optional(),
  smooveCancellingListId: z.coerce.number().int().positive().optional(),
  smooveCancelledListId: z.coerce.number().int().positive().optional(),
  smooveRemovedListId: z.coerce.number().int().positive().optional(),
  cardcomProductId: z.union([z.string(), z.undefined()]).optional(),
})

export type Product = z.infer<typeof ProductSchema>
export type ProductWithHistoryInfo = z.infer<typeof ProductWithHistoryInfoSchema>
export type NewProduct = z.infer<typeof NewProductSchema>

export interface ProductForGrid {
  productNumber: number
  name: string
  productType: ProductType
}

export interface ProductHistory {
  historyId: string
  operation: HistoryOperation
  timestamp: Date
}

export async function listProducts(
  sql: Sql,
  {
    withArchived,
    query,
    limit,
    page,
  }: {withArchived: boolean; query: string; limit: number; page: number},
): Promise<ProductForGrid[]> {
  const filters: PendingQuery<Row[]>[] = [sql`true`]

  if (!withArchived) {
    filters.push(sql`operation <> 'delete'`)
  }

  if (query) {
    filters.push(sql`searchable_text LIKE '%' || ${sql`${likeEscape(query)}`} || '%'`)
  }

  return await sql<ProductForGrid[]>`
    SELECT
      product.product_number AS product_number,
      product_data.name AS name,
      product_type
    FROM
      product_history
      INNER JOIN product ON last_history_id = id
      LEFT JOIN product_search USING (data_id)
      LEFT JOIN product_data USING (data_id)
    ${filters.flatMap((filter, i) => (i === 0 ? [sql`WHERE`, filter] : [sql`AND`, filter]))}
    ORDER BY product.product_number
    LIMIT ${limit} OFFSET ${page * limit}
    `
}

export async function createProduct(product: NewProduct, reason: string | undefined, sql: Sql) {
  return await sql.begin(async (sql) => {
    const now = new Date()
    const historyId = crypto.randomUUID()
    const dataId = crypto.randomUUID()

    const productNumberResult = await sql<{productNumber: number}[]>`
      INSERT INTO product_history VALUES
        (${historyId}, ${dataId}, DEFAULT, ${now}, 'create', ${reason ?? null})
      RETURNING product_number
    `
    const productNumber = productNumberResult[0].productNumber

    await sql`
      INSERT INTO product VALUES
        (${productNumber}, ${historyId}, ${dataId})
    `

    await addProductStuff(product, dataId, sql)

    return productNumber
  })
}

export async function updateProduct(
  product: Product,
  reason: string | undefined,
  sql: Sql,
): Promise<number | undefined> {
  return await sql.begin(async (sql) => {
    const now = new Date()
    const historyId = crypto.randomUUID()
    const dataId = crypto.randomUUID()

    await sql`
      INSERT INTO product_history VALUES
        (${historyId}, ${dataId}, ${product.productNumber}, ${now}, 'update', ${reason ?? null})
    `
    const updateResult = await sql`
        UPDATE product SET
          product_number = ${product.productNumber},
          last_history_id = ${historyId},
          last_data_id = ${dataId}
        WHERE product_number = ${product.productNumber}
        RETURNING 1
      `

    if (updateResult.length === 0) {
      return undefined
    }

    assert(updateResult.length === 1, `More than one product with ID ${product.productNumber}`)

    await addProductStuff(product, dataId, sql)

    return product.productNumber
  })
}

export async function deleteProduct(
  productNumber: number,
  reason: string | undefined,
  deleteOperation: Extract<HistoryOperation, 'delete' | 'restore'>,
  sql: Sql,
): Promise<string | undefined> {
  return await sql.begin(async (sql) => {
    const now = new Date()
    const historyId = crypto.randomUUID()
    const dataIdResult = await sql<{dataId: string}[]>`
      INSERT INTO product_history (id, data_id, product_number, timestamp, operation, operation_reason)
      SELECT ${historyId}, product.last_data_id as last_data_id, product.product_number, ${now}, ${deleteOperation}, ${reason ?? null}
      FROM product_history
      INNER JOIN product ON product.product_number = ${productNumber}
      WHERE id = product.last_history_id
      RETURNING product_history.data_id as data_id
    `

    if (dataIdResult.length === 0) {
      return undefined
    }

    if (dataIdResult.length > 1) {
      throw new Error(`More than one product with ID ${productNumber}`)
    }

    await sql`
        UPDATE product SET
          product_number = ${productNumber},
          last_history_id = ${historyId},
          last_data_id = ${dataIdResult[0].dataId}
        WHERE product_number = ${productNumber}
     `

    return historyId
  })
}

export async function queryProductByNumber(
  productNumber: number,
  sql: Sql,
): Promise<{product: ProductWithHistoryInfo; history: ProductHistory[]} | undefined> {
  const pproduct = sql<ProductWithHistoryInfo[]>`
    WITH parameters (current_data_id, current_history_id) AS (
      SELECT
        last_data_id, last_history_id
      FROM
        product
      WHERE
        product_number = ${productNumber}
    )
    ${productSelect(productNumber, sql)}
  `

  const phistory = productHistorySelect(productNumber, sql)
  const [product, history] = await Promise.all([pproduct, phistory])

  if (product.length === 0) {
    return undefined
  }

  assert(product.length === 1, `More than one product with ID ${productNumber}`)

  return {product: product[0], history}
}

export async function queryProductByHistoryId(
  productNumber: number,
  historyId: string,
  sql: Sql,
): Promise<{product: ProductWithHistoryInfo; history: ProductHistory[]} | undefined> {
  const pproduct = sql<ProductWithHistoryInfo[]>`
    WITH parameters (current_data_id, current_history_id) AS (
      SELECT
        data_id, id
      FROM
        product_history
      WHERE
        id = ${historyId}
    )
    ${productSelect(productNumber, sql)}
  `

  const phistory = productHistorySelect(productNumber, sql)

  const [product, history] = await Promise.all([pproduct, phistory])

  if (product.length === 0) {
    return undefined
  }

  assert(product.length === 1, `More than one product with ID ${productNumber}`)

  return {product: product[0], history}
}

function productSelect(productNumber: number, sql: Sql) {
  return sql<ProductWithHistoryInfo[]>`
SELECT
  current_history_id as id,
  product_history.operation as history_operation,
  ${productNumber} as product_number,
  product_data.name AS name,
  product_data.product_type AS product_type,
  product_integration_cardcom.product_id AS cardcom_product_id,
  product_integration_smoove.list_id AS smoove_list_id,
  product_integration_smoove.cancelling_list_id AS smoove_cancelling_list_id,
  product_integration_smoove.cancelled_list_id AS smoove_cancelled_list_id,
  product_integration_smoove.removed_list_id AS smoove_removed_list_id,
  COALESCE(academy_courses, json_build_array()) AS academy_courses,
  COALESCE(whatsapp_groups, json_build_array()) AS whatsapp_groups,
  COALESCE(facebook_groups, json_build_array()) AS facebook_groups
FROM
  parameters
  LEFT JOIN product_history ON product_history.id = current_history_id
  LEFT JOIN product_data ON product_data.data_id = current_data_id
  LEFT JOIN product_integration_cardcom ON product_integration_cardcom.data_id = current_data_id
  LEFT JOIN product_integration_smoove ON product_integration_smoove.data_id = current_data_id
  LEFT JOIN LATERAL (
    SELECT
      json_agg(
        workshop_id
        ORDER BY
          item_order
      ) AS academy_courses
    FROM
      product_academy_course
    WHERE
      product_academy_course.data_id = current_data_id
  ) academy_courses ON true
  LEFT JOIN LATERAL (
    SELECT
      json_agg(
        json_build_object(
          'id', whatsapp_group_id,
          'timedMessagesGoogleSheetUrl', messages_google_sheet_url
        )
        ORDER BY
          item_order
      ) AS whatsapp_groups
    FROM
      product_whatsapp_group
    WHERE
      product_whatsapp_group.data_id = current_data_id
  ) whatsapp_groups ON true
  LEFT JOIN LATERAL (
    SELECT
      json_agg(
        facebook_group_id
        ORDER BY
          item_order
      ) AS facebook_groups
    FROM
      product_facebook_group
    WHERE
      product_facebook_group.data_id = current_data_id
  ) facebook_groups ON true
       `
}

function productHistorySelect(productNumber: number, sql: Sql) {
  return sql<ProductHistory[]>`
SELECT
  id as history_id,
  operation,
  timestamp
FROM
  product_history
WHERE
  product_history.product_number = ${productNumber}
ORDER BY
  timestamp DESC
  `
}

async function addProductStuff(product: Product | NewProduct, dataId: string, sql: Sql) {
  let ops = [] as Promise<unknown>[]

  ops = ops.concat(sql`
    INSERT INTO product_search VALUES
      (${dataId}, ${searchableProductText(product)})
  `)

  ops = ops.concat(sql`
    INSERT INTO product_data VALUES
      (${dataId}, ${product.name}, ${product.productType ?? 'recorded'})
  `)

  ops = ops.concat(
    product.academyCourses?.map(
      (workshopId, index) => sql`
        INSERT INTO product_academy_course VALUES
          (${dataId}, ${index}, ${workshopId})
      `,
    ) ?? [],
  )

  ops = ops.concat(
    product.whatsappGroups?.map(
      (whatsappGroup, index) => sql`
        INSERT INTO product_whatsapp_group VALUES
          (${dataId}, ${index}, ${whatsappGroup.id}, ${whatsappGroup.timedMessagesGoogleSheetUrl})
      `,
    ) ?? [],
  )

  ops = ops.concat(
    product.facebookGroups?.map(
      (facebookGroupId, index) => sql`
        INSERT INTO product_facebook_group VALUES
          (${dataId}, ${index}, ${facebookGroupId})
      `,
    ) ?? [],
  )

  if (
    product.smooveListId !== undefined ||
    product.smooveCancellingListId !== undefined ||
    product.smooveCancelledListId !== undefined ||
    product.smooveRemovedListId !== undefined
  ) {
    ops = ops.concat(sql`
        INSERT INTO product_integration_smoove VALUES
          (
            ${dataId},
            ${product.smooveListId ?? null},
            ${product.smooveCancellingListId ?? null},
            ${product.smooveCancelledListId ?? null},
            ${product.smooveRemovedListId ?? null}
          )
      `)
  }

  if (product.cardcomProductId) {
    ops = ops.concat(sql`
        INSERT INTO product_integration_cardcom VALUES
          (${dataId}, ${product.cardcomProductId})
      `)
  }

  await Promise.all(ops)
}

function searchableProductText(product: Product | NewProduct): string {
  const name = product.name
  const productType = product.productType
  const whatsappGroups = product.whatsappGroups?.map((g) => g.id).join(' ') ?? ''
  const facebookGroups = product.facebookGroups?.join(' ') ?? ''
  const cardcomProductId = product.cardcomProductId ?? ''
  const smoveListIds = [
    product.smooveListId,
    product.smooveCancelledListId,
    product.smooveCancellingListId,
    product.smooveCancelledListId,
    product.smooveRemovedListId,
  ]
    .filter((x) => x !== undefined)
    .map((x) => x.toString())
    .join(' ')

  return `${name} ${productType} ${whatsappGroups} ${facebookGroups} ${cardcomProductId} ${smoveListIds}`.trim()
}

function likeEscape(s: string): string {
  return s.replace(/[%_\\]/g, (m) => `\\${m}`)
}

export async function TEST_seedProducts(sql: Sql, count: number) {
  // eslint-disable-next-line n/no-unpublished-import
  const chance = new (await import('chance')).Chance(0)

  const productTypes: ProductType[] = ['recorded', 'challenge', 'club', 'bundle']

  for (const i of range(0, count)) {
    if (i % 1000 === 0) {
      console.log(`Seeding product ${i}`)
    }
    await createProduct(
      {
        name: `${chance.word()} ${chance.word()}`,
        productType: chance.pickone(productTypes),
        academyCourses: [
          chance.integer({min: 1000, max: 9999}),
          chance.integer({min: 1000, max: 9999}),
        ],
        whatsappGroups: [
          {
            id: `${chance.integer({min: 100000000, max: 999999999})}@g.us`,
            timedMessagesGoogleSheetUrl: chance.url(),
          },
        ],
        facebookGroups: [chance.word()],
        smooveListId: chance.integer({min: 1, max: 9999}),
        smooveCancellingListId: chance.integer({min: 1, max: 9999}),
        smooveCancelledListId: chance.integer({min: 1, max: 9999}),
        smooveRemovedListId: chance.integer({min: 1, max: 9999}),
        cardcomProductId: chance.string({length: 8, alpha: true, numeric: true}),
      },
      chance.word(),
      sql,
    )
  }
}

function range(start: number, end: number): number[] {
  return Array.from({length: end - start}, (_, i) => i + start)
}
