#!/usr/bin/env node
import {promisify as p} from 'util'
import fs from 'fs'
import path from 'path'
import ncpPackage from 'ncp'
const {ncp} = ncpPackage

const __filename = new URL(import.meta.url).pathname
const __dirname = path.dirname(__filename)

if (process.argv.length < 3) {
  console.error('usage: create <template-name>')
  process.exit(1)
}

/**
 * @param {string} templateName
 * @param {{onlyCopyFiles?: boolean}} [options]
 */
async function createFromTemplate(templateName, {onlyCopyFiles = false} = {}) {
  const templateDir = path.resolve(__dirname, 'package-templates', templateName)
  const targetDir = process.cwd()

  if (!fs.existsSync(templateDir)) {
    console.error('could not find template', templateName)
    process.exit(1)
  }

  if (fs.existsSync(path.join(templateDir, '.base'))) {
    await createFromTemplate(
      (await fs.promises.readFile(path.join(templateDir, '.base'), 'utf-8')).trim(),
      {onlyCopyFiles: true},
    )
  }

  console.log(`Copying files from: ${templateDir} to: ${targetDir}`)

  await p(ncp)(templateDir, targetDir)

  if (onlyCopyFiles) {
    return
  }

  const targetDirArr = targetDir.split('/')
  const packageName = targetDirArr[targetDirArr.length - 1].toLowerCase()

  await fs.promises.rename(`${targetDir}/.package.json`, `${targetDir}/package.json`)
  if (fs.existsSync(`${targetDir}/..gitignore`)) {
    await fs.promises.rename(`${targetDir}/..gitignore`, `${targetDir}/.gitignore`)
  }

  const allFiles = walkSync(targetDir)

  for (const file of allFiles) {
    const newFileName = file.replaceAll('templatetemplate', packageName)
    console.log('creating file', newFileName)
    const content = (await fs.promises.readFile(file, 'utf8')).replaceAll(
      'templatetemplate',
      packageName,
    )

    await fs.promises.writeFile(file, content, 'utf8')

    if (newFileName != file) {
      await fs.promises.rename(file, newFileName)
    }
  }
}

await createFromTemplate(process.argv[2])

console.log('Done!')

/**
 *
 * @param {string} dir
 * @param {string[]} [filelist]
 *
 * returns {string[]}
 */
function walkSync(dir, filelist = []) {
  fs.readdirSync(dir).forEach((file) => {
    filelist = fs.statSync(path.join(dir, file)).isDirectory()
      ? walkSync(path.join(dir, file), filelist)
      : filelist.concat(path.join(dir, file))
  })
  return filelist
}
