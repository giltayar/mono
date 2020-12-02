#!/usr/bin/env node
import {app} from './templatetemplate.js'

await app(process.argv.slice(2), {shouldExitOnError: true})
