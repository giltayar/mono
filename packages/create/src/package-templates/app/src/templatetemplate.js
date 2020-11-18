'use strict'
const fastify = require('fastify')
const {version} = require('../package.json')

module.exports = createApp

function createApp({logger}) {
  const app = fastify()

  app.get('/healthz', async () => ({version}))

  logger.info({action: 'create-app', success: true})

  return app
}
