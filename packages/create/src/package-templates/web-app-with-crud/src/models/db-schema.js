import {entityDbSchema} from './entity-model.js'

/**
 * @param {import('pg').Pool} pool
 */
export async function createDbSchema(pool) {
  await pool.query(entityDbSchema)
}
