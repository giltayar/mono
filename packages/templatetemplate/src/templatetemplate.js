import fastify from 'fastify'
import pg from 'pg'
import retry from 'p-retry'
import {
  deleteEntity,
  getEntity,
  insertEntity,
  listEntities,
  updateEntity,
} from './controllers/entity-controller.js'
import {healthz} from './controllers/healthz-controller.js'
import {makeMammothDb} from './models/entity-model.js'
const {Pool} = pg

/**
 * @param {{
 *  postgresConnectionString: string
 * }} options
 */
export async function makeWebApp({postgresConnectionString}) {
  const app = fastify()
  const pool = await connectToPostgres(postgresConnectionString)
  const db = makeMammothDb(pool)

  app.addHook('onClose', async () => await pool.end())

  app.get('/healthz', healthz(pool))

  app.get('/entity', listEntities(db))
  app.get('/entity/:id', getEntity(db))
  app.post('/entity', insertEntity(db))
  app.put('/entity/:id', updateEntity(db))
  app.delete('/entity/:id', deleteEntity(db))

  return {app, pool}
}

/**
 * @param {string} connectionString
 */
export async function connectToPostgres(connectionString) {
  const pool = new Pool({connectionString})

  await retry(() => pool.query('select 42'))

  return pool
}
