#!/usr/bin/env node
// eslint-disable-next-line node/shebang
import fs from 'fs'

const packageJson = JSON.parse(await fs.promises.readFile('package.json'))

packageJson.version = '0.0.1'

await fs.promises.writeFile('.temp/package.json', JSON.stringify(packageJson, null, 2))
