#!/usr/bin/env node
'use strict'
import {createLogger} from '@applitools/loggly-pino'
const {logger, close} = createLogger({
  appName: 'templatetemplate',
  logName: 'applitools:templatetemplate:run',
  prettyPrint: true,
  quiet: false,
})
import createApp from '../src/templatetemplate'

async function main() {
  const app = createApp({logger})

  const address = await app.listen(parseInt(process.env.PORT || '3000', 10), '0.0.0.0')
  await app.ready()

  logger.info({action: 'listen-app', address, success: true})
}

main().catch(async err => {
  try {
    console.error(`Webserver crashed: ${err.stack || err.toString()}`)
    logger.error(err)
    await close()
  } finally {
    process.exit(1)
  }
})
