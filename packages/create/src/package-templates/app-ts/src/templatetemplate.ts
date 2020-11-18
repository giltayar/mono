import fastify from 'fastify'
const {version} = require('../package.json')

export interface CreateApp {
  logger: any
}

export default function createApp({logger}: CreateApp) {
  const app = fastify()

  app.get('/healthz', async () => ({version}))

  logger.info({action: 'create-app', success: true})

  return app
}
