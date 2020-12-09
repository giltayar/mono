import fastify from 'fastify'
import pg from 'pg'
import retry from 'p-retry'
import makeLogger, {enterWithChildLogger, exitFromChildLogger} from '@seasquared/pino-global'
import {v4 as uuid} from 'uuid'
import fastifyHelmet from 'fastify-helmet'
import logRequestFastifyPlugin from '@seasquared/log-request-fastify-plugin'
import {
  deleteEntityRoute,
  getEntityRoute,
  addEntityRoute,
  listEntitiesRoute,
  updateEntityRoute,
} from './controllers/entity-controller.js'
import {healthz} from './controllers/healthz-controller.js'
import {makeMammothDb} from './models/entity-model.js'
import {ZodError} from 'zod'
const {Pool} = pg
const logger = makeLogger({name: 'webapp'})

/**
 * @param {{
 *  postgresConnectionString: string
 * }} options
 */
export async function makeWebApp({postgresConnectionString}) {
  const app = fastify()
  const pool = await connectToPostgres(postgresConnectionString)
  const db = makeMammothDb(pool)

  app.register(fastifyHelmet)
  app.register(logRequestFastifyPlugin, {logger})

  app.addHook('onClose', async () => await pool.end())

  app.addHook('onError', zodErrorHandler)

  app.decorateRequest('requestId', '')
  app.addHook('onRequest', setRequestIdHandler)

  app.addHook('onRequest', logWithRequestIdEnterHandler)
  app.addHook('onResponse', logWithRequestIdExitHandler)

  app.get('/healthz', healthz(pool))

  app.get('/entity', listEntitiesRoute(db))
  app.get('/entity/:id', getEntityRoute(db))
  app.post('/entity', addEntityRoute(db))
  app.put('/entity/:id', updateEntityRoute(db))
  app.delete('/entity/:id', deleteEntityRoute(db))

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

/**
 * @param {import('fastify').FastifyRequest} _req
 * @param {import('fastify').FastifyReply} reply
 * @param {Error} error
 * @param {import('fastify').HookHandlerDoneFunction} done
 */
function zodErrorHandler(_req, reply, error, done) {
  if (error instanceof ZodError) {
    reply.status(400)
  }

  done()
}

/**
 * @param {import('fastify').FastifyRequest} req
 * @param {any} _reply
 * @param {import('fastify').HookHandlerDoneFunction} done
 */
function setRequestIdHandler(req, _reply, done) {
  const requestId = /**@type{string}*/ (req.headers['x-request-id'] ?? uuid())

  req.requestId = requestId

  done()
}

/**
 * @param {import('fastify').FastifyRequest} req
 * @param {any} _reply
 * @param {import('fastify').HookHandlerDoneFunction} done
 */
function logWithRequestIdEnterHandler(req, _reply, done) {
  const requestId = /**@type{string}*/ (req.headers['x-request-id'] ?? uuid())

  enterWithChildLogger(logger.child({requestId}))

  done()
}

/**
 * @param {import('fastify').FastifyRequest} _req
 * @param {any} _reply
 * @param {import('fastify').HookHandlerDoneFunction} done
 */
function logWithRequestIdExitHandler(_req, _reply, done) {
  exitFromChildLogger(done)
}
