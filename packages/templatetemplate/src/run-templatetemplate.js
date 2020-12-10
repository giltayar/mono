#!/usr/bin/env node
import makeLogger, {initializeLoggerOptions} from '@seasquared/pino-global'
import {makeWebApp} from './templatetemplate.js'

initializeLoggerOptions('templatetemplate:')
const logger = makeLogger({name: 'run'})

const config = {
  postgresConnectionString: process.env.POSTGRESS_CONNECTION_STRING ?? '',
}
const {app} = await makeWebApp(config)

const port = process.env.PORT || 3000
try {
  const baseUrl = await app.listen(port, '0.0.0.0')

  logger.info({event: 'app-listening', baseUrl, port, config, success: true})
} catch (error) {
  logger.error({event: 'app-listening', port, config, success: false})
}
