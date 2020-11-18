#!/usr/bin/env node
import {promisify as p} from 'util'
import fs from 'fs'
import path from 'path'
import ncpPackage from 'ncp'
const {ncp} = ncpPackage

const __filename = new URL(import.meta.url).pathname
const __dirname = path.dirname(__filename)

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

/**
 *
 * @param {string} string
 * @param {string} search
 * @param {string} replacement
 *
 * @returns {string}
 */
function replaceAll(string, search, replacement) {
  return string.replace(new RegExp(search, 'g'), replacement)
}

if (process.argv.length < 3) {
  console.error('usage: create <template-name>')
  process.exit(1)
}

const templateName = process.argv[2]

const templateDir = path.resolve(__dirname, 'package-templates', templateName)
if (!fs.existsSync(templateDir)) {
  console.error('could not find template', templateName)
  process.exit(1)
}
const targetDir = process.cwd()
const targetDirArr = targetDir.split('/')
const packageName = targetDirArr[targetDirArr.length - 1]

console.log(`Copying files from: ${templateDir} to: ${targetDir}...`)

await p(ncp)(templateDir, process.cwd())

await fs.promises.rename(`${targetDir}/.package.json`, `${targetDir}/package.json`)

const allFiles = walkSync(targetDir)

console.log('Replacing placeholders in files to package name: ' + packageName)

for (const file of allFiles) {
  const newFileName = replaceAll(file, 'templatetemplate', packageName)
  console.log('creating file', newFileName)
  const content = replaceAll(
    await fs.promises.readFile(file, 'utf8'),
    'templatetemplate',
    packageName,
  )

  await fs.promises.writeFile(file, content, 'utf8')

  if (newFileName != file) {
    await fs.promises.rename(file, newFileName)
  }
}

console.log('Done!')
