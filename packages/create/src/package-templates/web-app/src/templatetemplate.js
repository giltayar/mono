import fastify from 'fastify'
import makeLogger from '@seasquared/pino-global'
import fastifyHelmet from 'fastify-helmet'
import logRequestFastifyPlugin from '@seasquared/log-request-fastify-plugin'
import requestIdFastifyPlugin from '@seasquared/request-id-fastify-plugin'
import requestIdLoggerFastifyPlugin from '@seasquared/request-id-logger-fastify-plugin'
import {healthz} from './controllers/healthz-controller.js'
const logger = makeLogger({name: 'webapp'})

/**
 * @param {{
 * }} options
 */
export async function makeWebApp({}) {
  const app = fastify()

  app.register(fastifyHelmet)
  app.register(logRequestFastifyPlugin, {logger})
  app.register(requestIdFastifyPlugin, {})
  app.register(requestIdLoggerFastifyPlugin, {logger})

  app.get('/healthz', healthz())

  return {app}
}
