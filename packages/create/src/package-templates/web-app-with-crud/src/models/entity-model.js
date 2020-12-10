import * as m from '@ff00ff/mammoth'
import * as z from 'zod'

export const entityTable = m.defineTable({
  id: m.uuid().primaryKey().default(`gen_random_uuid()`),
  name: m.text().notNull(),
  value: m.integer().notNull(),
  lastModified: m.timestamp().notNull(),
  data: m.jsonb().notNull(),
})

export const entityDbSchema = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TABLE IF NOT EXISTS entity_table (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  value INTEGER NOT NULL,
  last_modified TIMESTAMP NOT NULL,
  data JSONB NOT NULL
)
`

export const baseMetadataSchema = z.object({
  id: z.string(),
  lastModified: z.date(),
})
export const entityDataSchena = z.object({
  more: z.number(),
  stuff: z.string(),
})

export const entitySchema = z.object({
  name: z.string(),
  value: z.number(),
  data: entityDataSchena,
})

export const entityWithMetadataSchema = baseMetadataSchema.merge(entitySchema)

/**@typedef {z.infer<typeof entitySchema>} Entity */
/**@typedef {z.infer<typeof entityWithMetadataSchema>} EntityWithMetadata */
/**@typedef {z.infer<typeof entityDataSchena>} EntityData */

/**
 * @param {import('pg').Pool} pool
 */
export function makeMammothDb(pool) {
  return m.defineDb({entityTable}, async (query, parameters) => {
    const result = await pool.query(query, parameters)

    return {
      affectedCount: result.rowCount,
      rows: result.rows,
    }
  })
}
