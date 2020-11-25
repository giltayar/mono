#!/usr/bin/env node
import {app} from './kdeploy.js'

await app(process.argv.slice(2), {shouldExitOnError: true})
