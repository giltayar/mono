#!/usr/bin/env node
import {makeWebApp} from './templatetemplate.js'

await app(process.argv.slice(2), {shouldExitOnError: true})
