'use strict'
import fs from 'fs'
import os from 'os'
import path from 'path'
import stream from 'stream/promises'
import {makeError} from '@giltayar/functional-commons'

/** @param {string} pathOrFile */
export function pathComponents(pathOrFile) {
  const dirname = path.dirname(pathOrFile)
  const basename = path.basename(pathOrFile)
  const extname = path.extname(basename)
  const filename = path.basename(basename, extname)
  return {dirname, basename, extname, filename}
}

/**
 * @param {string | string[]} file
 * @param {Buffer|string|object} content
 * @param {{cwd: string}} options
 * @returns {Promise<void>}
 */
export async function writeFile(file, content, {cwd}) {
  if (Array.isArray(file)) {
    file = file.reduce((fileUpTillNow, segment) => path.join(fileUpTillNow, segment))
  }
  file = path.join(cwd, file)

  await fs.promises.mkdir(path.dirname(file), {recursive: true})
  await fs.promises.writeFile(file, typeof content === 'object' ? JSON.stringify(content) : content)
}

/**
 * @param {string | string[]} file
 * @param {{cwd: string}} options
 * @returns {Promise<string>}
 */
export async function readFileAsString(file, {cwd}) {
  if (Array.isArray(file)) {
    file = file.reduce((fileUpTillNow, segment) => path.join(fileUpTillNow, segment))
  }
  file = path.join(cwd, file)

  return await fs.promises.readFile(file, 'utf-8')
}

/**
 * @template [T=any]
 * @param {string | string[]} file
 * @param {{cwd: string}} options
 * @returns {Promise<T>}
 */
export async function readFileAsJson(file, {cwd}) {
  if (Array.isArray(file)) {
    file = file.reduce((fileUpTillNow, segment) => path.join(fileUpTillNow, segment))
  }
  return JSON.parse(await fs.promises.readFile(path.join(cwd, file), 'utf-8'))
}

/**
 * @param {string | undefined} [dirToCopy]
 * @param {Record<string, string>} [stringSubstitutions]
 * @returns {Promise<string>}
 */
export async function makeTemporaryDirectory(dirToCopy, stringSubstitutions) {
  const ret = await fs.promises.mkdtemp(os.tmpdir() + '/')

  if (dirToCopy != null) {
    await copyDirectory(dirToCopy, ret, stringSubstitutions)
  }

  return ret
}

/**
 * @param {string | string[]} file
 * @param {string} sourceString
 * @param {string} targetString
 * @param {{cwd: string}} options
 */
export async function replaceInFile(file, sourceString, targetString, {cwd}) {
  const content = await readFileAsString(file, {cwd})

  const transformedContent = content.replaceAll(sourceString, targetString)

  await writeFile(file, transformedContent, {cwd})

  return transformedContent
}

/**
 *
 * @param {string} dir
 * @param {RegExp} regex
 */
export async function findFileThatMatches(dir, regex) {
  const result = (await fs.promises.readdir(dir)).filter((s) => regex.test(s))

  if (result.length === 0) {
    return undefined
  } else if (result.length === 1) {
    return path.join(dir, result[0])
  } else {
    throw makeError(`more than one file matches ${regex}: ${result}`, {
      code: 'ERR_MORE_THAN_ONE_FILE_MATCH',
    })
  }
}

/**
 * @param {string} sourceDirectory
 * @param {string} targetDirectory
 * @param {Record<string, string> | undefined} [stringSubstitutions]
 */
export async function copyDirectory(sourceDirectory, targetDirectory, stringSubstitutions) {
  await fs.promises.mkdir(targetDirectory, {recursive: true})

  const filesAndDirs = await fs.promises.readdir(sourceDirectory, {withFileTypes: true})

  await Promise.all(
    filesAndDirs.map((f) =>
      f.isDirectory()
        ? copyDirectory(path.join(sourceDirectory, f.name), path.join(targetDirectory, f.name))
        : copyFile(
            path.join(sourceDirectory, f.name),
            path.join(targetDirectory, f.name),
            stringSubstitutions,
          ),
    ),
  )
}

/**
 * @param {string} sourceFile
 * @param {string} targetFile
 * @param {Record<string, string> | undefined} stringSubstitutions
 */
async function copyFile(sourceFile, targetFile, stringSubstitutions) {
  if (!stringSubstitutions || Object.keys(stringSubstitutions).length === 0) {
    await stream.pipeline(fs.createReadStream(sourceFile), fs.createWriteStream(targetFile))
  } else {
    const source = await fs.promises.readFile(sourceFile, 'utf8')

    const transformed = Object.entries(stringSubstitutions).reduce(
      (acc, [from, to]) => acc.replaceAll(from, to),
      source,
    )

    await fs.promises.writeFile(targetFile, transformed)
  }
}
