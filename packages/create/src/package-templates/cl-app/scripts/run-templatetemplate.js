#!/usr/bin/env node
'use strict'

const {logger, close} = require('@applitools/loggly-pino').createLogger({
  appName: 'templatetemplate',
  clusterName: 'codeless',
  logName: 'applitools:templatetemplate:main',
  prettyPrint: true,
  quiet: false,
})

const webApp = require('../')

async function main() {
  const app = await webApp({logger})
  await app.listen(process.env.PORT || 3000, '0.0.0.0')
  await app.ready()
  console.log(`Listening on port ${app.server.address().port}`)
}

async function shutdown() {
  logger.info('Shutting down logger...')
  await close()
}

process.on('SIGTERM', async () => {
  logger.info('got SIGTERM')
  await shutdown()
  process.exit(0)
})

main().catch(async err => {
  try {
    console.error('Webserver crashed' + err + err.stack)
    logger.error({error: err, error_stack: err.stack, msg: 'Server crashed!'})
    await shutdown()
  } finally {
    process.exit(1)
  }
})
