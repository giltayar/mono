#!/usr/bin/env node
import {makeWebApp} from './templatetemplate.js'

const {app} = await makeWebApp({
  postgresConnectionString: process.env.POSTGRESS_CONNECTION_STRING ?? '',
})

await app.listen(process.env.PORT || 3000, '0.0.0.0')
