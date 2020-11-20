import fs from 'fs'
import path from 'path'
import ncu from 'npm-check-updates'

const __filename = new URL(import.meta.url).pathname
const __dirname = path.dirname(__filename)
const packageTemplatesDir = path.resolve(__dirname, '../src/package-templates')

for (const dir of await fs.promises.readdir(packageTemplatesDir, {
  withFileTypes: true,
})) {
  if (!dir.isDirectory) continue

  console.log(`upgrading template "${dir.name}"`)

  const upgraded = await ncu.run({cwd: path.join(packageTemplatesDir, dir.name), upgrade: true})

  for (const [packageName, version] of Object.entries(upgraded)) {
    console.log(packageName, '==>', version)
  }

  if (Object.entries(upgraded).length === 0) {
    console.log('nothing to upgrade')
  }
}
