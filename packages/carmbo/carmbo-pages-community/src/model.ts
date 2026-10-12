import type {PendingQuery, Row, Sql} from 'postgres'
import assert from 'node:assert'
import {z} from 'zod'
import {
  HistoryOperationEnumSchema,
  type HistoryOperation,
} from '@giltayar/carmbo-commons/commons/operation-type'
import {sqlTextSearch} from '@giltayar/carmbo-commons/commons/sql-commons'
import {TEST_executeHook} from '@giltayar/carmbo-commons/commons/TEST_hooks'

export const CommunitySchema = z.object({
  communityNumber: z.number().int().positive(),
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
})

export const NewCommunitySchema = CommunitySchema.omit({communityNumber: true})

export type Community = z.infer<typeof CommunitySchema>
export type NewCommunity = z.infer<typeof NewCommunitySchema>

export const CommunityWithHistoryInfoSchema = CommunitySchema.extend({
  id: z.uuid(),
  historyOperation: HistoryOperationEnumSchema,
})

export type CommunityWithHistoryInfo = z.infer<typeof CommunityWithHistoryInfoSchema>

export interface CommunityForGrid {
  communityNumber: number
  name: string
  description: string | undefined
}

export interface CommunityHistory {
  historyId: string
  operation: HistoryOperation
  timestamp: Date
}

export async function listCommunities(
  sql: Sql,
  {
    withArchived,
    query,
    limit,
    page,
  }: {withArchived: boolean; query: string; limit: number; page: number},
): Promise<CommunityForGrid[]> {
  const filters: PendingQuery<Row[]>[] = [sql`true`]

  if (!withArchived) {
    filters.push(sql`operation <> 'delete'`)
  }

  if (query) {
    filters.push(sql`searchable_text ${sql`${sqlTextSearch(query, sql)}`}`)
  }

  const result = await sql<{communityNumber: number; name: string; description: string | null}[]>`
    SELECT
      community.community_number,
      community_data.name,
      community_data.description
    FROM
      community_history
      INNER JOIN community ON last_history_id = id
      LEFT JOIN community_data USING (data_id)
      LEFT JOIN community_search USING (data_id)
    ${filters.flatMap((filter, i) => (i === 0 ? [sql`WHERE`, filter] : [sql`AND`, filter]))}
    ORDER BY community.community_number DESC
    LIMIT ${limit} OFFSET ${page * limit}
  `

  return result.map((row) => ({
    communityNumber: row.communityNumber,
    name: row.name,
    description: row.description ?? undefined,
  }))
}

export async function createCommunity(
  community: NewCommunity,
  reason: string | undefined,
  now: Date,
  sql: Sql,
): Promise<number> {
  await TEST_executeHook('createCommunity')

  const validCommunity = NewCommunitySchema.parse(community)

  return await sql.begin(async (sql) => {
    const historyId = crypto.randomUUID()
    const dataId = crypto.randomUUID()

    const communityNumberResult = await sql<{communityNumber: number}[]>`
      INSERT INTO community_history VALUES
        (${historyId}, ${dataId}, DEFAULT, ${now}, 'create', ${reason ?? null})
      RETURNING community_number
    `
    const communityNumber = communityNumberResult[0].communityNumber

    await sql`
      INSERT INTO community VALUES
        (${communityNumber}, ${historyId}, ${dataId})
    `

    await addCommunityData(communityNumber, validCommunity, dataId, sql)

    return communityNumber
  })
}

export async function updateCommunity(
  community: Community,
  reason: string | undefined,
  now: Date,
  sql: Sql,
): Promise<number | undefined> {
  await TEST_executeHook('updateCommunity')

  const validCommunity = CommunitySchema.parse(community)
  const {communityNumber} = validCommunity

  return await sql.begin(async (sql) => {
    const historyId = crypto.randomUUID()
    const dataId = crypto.randomUUID()

    const updateResult = await sql`
      UPDATE community SET
        last_history_id = ${historyId},
        last_data_id = ${dataId}
      WHERE community_number = ${communityNumber}
      RETURNING 1
    `

    if (updateResult.length === 0) {
      return undefined
    }

    assert(updateResult.length === 1, `More than one community with ID ${communityNumber}`)

    await sql`
      INSERT INTO community_history VALUES
        (${historyId}, ${dataId}, ${communityNumber}, ${now}, 'update', ${reason ?? null})
    `

    await addCommunityData(communityNumber, validCommunity, dataId, sql)

    return communityNumber
  })
}

export async function deleteCommunity(
  communityNumber: number,
  reason: string | undefined,
  deleteOperation: Extract<HistoryOperation, 'delete' | 'restore'>,
  now: Date,
  sql: Sql,
): Promise<string | undefined> {
  await TEST_executeHook(`${deleteOperation}Community`)

  return await sql.begin(async (sql) => {
    const historyId = crypto.randomUUID()
    const dataIdResult = await sql<{dataId: string}[]>`
      INSERT INTO community_history (id, data_id, community_number, timestamp, operation, operation_reason)
      SELECT ${historyId}, community.last_data_id, community.community_number, ${now}, ${deleteOperation}, ${reason ?? null}
      FROM community
      WHERE community.community_number = ${communityNumber}
      RETURNING community_history.data_id AS data_id
    `

    if (dataIdResult.length === 0) {
      return undefined
    }

    assert(dataIdResult.length === 1, `More than one community with ID ${communityNumber}`)

    await sql`
      UPDATE community SET
        last_history_id = ${historyId}
      WHERE community_number = ${communityNumber}
    `

    return historyId
  })
}

export async function queryCommunityByNumber(
  communityNumber: number,
  sql: Sql,
): Promise<{community: CommunityWithHistoryInfo; history: CommunityHistory[]} | undefined> {
  const pcommunity = sql<CommunityRow[]>`
    WITH parameters (current_data_id, current_history_id) AS (
      SELECT last_data_id, last_history_id
      FROM community
      WHERE community_number = ${communityNumber}
    )
    ${communitySelect(communityNumber, sql)}
  `

  return await queryCommunity(communityNumber, pcommunity, sql)
}

export async function queryCommunityByHistoryId(
  communityNumber: number,
  historyId: string,
  sql: Sql,
): Promise<{community: CommunityWithHistoryInfo; history: CommunityHistory[]} | undefined> {
  const pcommunity = sql<CommunityRow[]>`
    WITH parameters (current_data_id, current_history_id) AS (
      SELECT data_id, id
      FROM community_history
      WHERE id = ${historyId} AND community_number = ${communityNumber}
    )
    ${communitySelect(communityNumber, sql)}
  `

  return await queryCommunity(communityNumber, pcommunity, sql)
}

type CommunityRow = Omit<CommunityWithHistoryInfo, 'description'> & {description: string | null}

async function queryCommunity(
  communityNumber: number,
  pcommunity: Promise<CommunityRow[]>,
  sql: Sql,
): Promise<{community: CommunityWithHistoryInfo; history: CommunityHistory[]} | undefined> {
  const [community, history] = await Promise.all([
    pcommunity,
    communityHistorySelect(communityNumber, sql),
  ])

  if (community.length === 0) {
    return undefined
  }

  assert(community.length === 1, `More than one community with ID ${communityNumber}`)

  const {description, ...rest} = community[0]

  return {community: {...rest, description: description ?? undefined}, history}
}

function communitySelect(communityNumber: number, sql: Sql) {
  return sql`
    SELECT
      current_history_id AS id,
      community_history.operation AS history_operation,
      ${communityNumber}::integer AS community_number,
      community_data.name,
      community_data.description
    FROM
      parameters
      INNER JOIN community_history ON community_history.id = current_history_id
      LEFT JOIN community_data ON community_data.data_id = current_data_id
  `
}

function communityHistorySelect(communityNumber: number, sql: Sql) {
  return sql<CommunityHistory[]>`
    SELECT
      id AS history_id,
      operation,
      timestamp
    FROM
      community_history
    WHERE
      community_number = ${communityNumber}
    ORDER BY
      timestamp DESC
  `
}

async function addCommunityData(
  communityNumber: number,
  community: NewCommunity,
  dataId: string,
  sql: Sql,
): Promise<void> {
  await Promise.all([
    sql`
      INSERT INTO community_data VALUES
        (${dataId}, ${community.name}, ${community.description || null})
    `,
    sql`
      INSERT INTO community_search VALUES
        (${dataId}, ${searchableCommunityText(communityNumber, community)})
    `,
  ])
}

function searchableCommunityText(communityNumber: number, community: NewCommunity): string {
  return [String(communityNumber), community.name, community.description ?? ''].join(' ')
}
