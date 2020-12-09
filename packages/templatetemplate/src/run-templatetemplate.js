#!/usr/bin/env node
import {initializeLoggerOptions} from '@seasquared/pino-global'
import {makeWebApp} from './templatetemplate.js'

initializeLoggerOptions('templatetemplate:')

const {app} = await makeWebApp({
  postgresConnectionString: process.env.POSTGRESS_CONNECTION_STRING ?? '',
})

await app.listen(process.env.PORT || 3000, '0.0.0.0')
