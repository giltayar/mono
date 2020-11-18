#!/usr/bin/env node
'use strict'

const app = require('../')

app(process.argv.slice(2), {shouldExitOnError: true}).catch((err) =>
  console.error(err.stack || err),
)
