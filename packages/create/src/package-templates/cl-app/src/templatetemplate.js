'use strict'
const fastify = require('fastify')
const {requestLoggerPlugin} = require('@applitools/fastify-request-logger')
const {
  requestIdPlugin,
  logContributor: reqIdlogContributor,
} = require('@applitools/fastify-request-id')

module.exports = createApp

async function createApp({logger}) {
  const app = fastify()

  app.register(requestIdPlugin)
  app.register(requestLoggerPlugin, {
    logger: logger,
    logContirbutors: [reqIdlogContributor],
  })

  app.setErrorHandler(function(error, request, reply) {
    if (reply.res.statusCode === 500) {
      request.logger.error({
        msg: 'Fatal API error caught in error handler',
        error,
        stack: error.stack,
      })
      console.error(error)
      reply.send({
        statusCode: 500,
        error: 'Internal Server Error',
      })
    } else {
      request.logger.warn({
        msg: 'Non fatal API error caught in error handler',
        error,
        stack: error.stack,
      })
      reply.send(error)
    }
  })

  app.get('/', async () => {
    return {hello: 'codeless'}
  })

  return app
}
